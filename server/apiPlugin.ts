import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import Database from 'better-sqlite3';
import type { Plugin } from 'vite';

const CONFIG_DIR = path.join(os.homedir(), '.codex-formatter');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_SESSIONS_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const DB_PATH = path.join(CONFIG_DIR, 'codex_index.db');
const MAX_PREVIEW_LINES = 200;

interface ConfigFile {
  sessionsRoot?: string;
}

interface FileEntry {
  absPath: string;
  relPath: string;
  size: number;
  mtimeMs: number;
}

interface SessionFileInfo {
  id: string;
  filename: string;
  size: number;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
}

type DaysMap = Map<string, SessionFileInfo[]>;
type MonthsMap = Map<string, DaysMap>;
type YearsMap = Map<string, MonthsMap>;

let cachedConfig: ConfigFile | null = null;
let cachedRoot: { value: string; source: 'env' | 'config' | 'default' } | null = null;
let db: Database.Database | null = null;

const toPosix = (value: string) => value.split(path.sep).join('/');
const DEBUG_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.CODEX_DEBUG).toLowerCase());
const logDebug = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return;
  console.log('[debug]', ...args);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const ensureDir = async (dir: string) => {
  await fsp.mkdir(dir, { recursive: true });
};

const readConfigFile = async (): Promise<ConfigFile> => {
  if (cachedConfig) return cachedConfig;
  let config: ConfigFile;
  try {
    const raw = await fsp.readFile(CONFIG_PATH, 'utf-8');
    config = JSON.parse(raw) as ConfigFile;
  } catch (_error) {
    config = {};
  }
  cachedConfig = config;
  return config;
};

const writeConfigFile = async (config: ConfigFile) => {
  await ensureDir(CONFIG_DIR);
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
};

const resolveSessionsRoot = async () => {
  if (cachedRoot) return cachedRoot;
  if (process.env.CODEX_SESSIONS_ROOT) {
    cachedRoot = { value: process.env.CODEX_SESSIONS_ROOT, source: 'env' };
    return cachedRoot;
  }
  const config = await readConfigFile();
  if (config.sessionsRoot) {
    cachedRoot = { value: config.sessionsRoot, source: 'config' };
    return cachedRoot;
  }
  cachedRoot = { value: DEFAULT_SESSIONS_ROOT, source: 'default' };
  return cachedRoot;
};

const setSessionsRoot = async (root: string) => {
  cachedRoot = { value: root, source: 'config' };
  await writeConfigFile({ sessionsRoot: root });
};

const initSchema = (database: Database.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      session_id TEXT,
      session_id_checked INTEGER,
      timestamp TEXT,
      cwd TEXT,
      git_branch TEXT,
      git_repo TEXT,
      first_user_message TEXT
    );

    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      size INTEGER,
      mtime INTEGER,
      hash TEXT,
      indexed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_id INTEGER,
      role TEXT NOT NULL,
      timestamp TEXT,
      content TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      session_id UNINDEXED,
      turn_id UNINDEXED,
      role UNINDEXED,
      tokenize = 'porter'
    );
    DROP TRIGGER IF EXISTS messages_ai;
    DROP TRIGGER IF EXISTS messages_ad;
    DROP TRIGGER IF EXISTS messages_au;

    CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content, session_id, turn_id, role)
      VALUES (new.id, new.content, new.session_id, new.turn_id, new.role);
    END;

    CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.id;
    END;

    CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.id;
      INSERT INTO messages_fts(rowid, content, session_id, turn_id, role)
      VALUES (new.id, new.content, new.session_id, new.turn_id, new.role);
    END;

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_turn ON messages(session_id, turn_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp);
  `);
  const sessionColumns = database.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
  const hasSessionId = sessionColumns.some((column) => column.name === 'session_id');
  if (!hasSessionId) {
    database.exec('ALTER TABLE sessions ADD COLUMN session_id TEXT');
  }
  const hasSessionIdChecked = sessionColumns.some((column) => column.name === 'session_id_checked');
  if (!hasSessionIdChecked) {
    database.exec('ALTER TABLE sessions ADD COLUMN session_id_checked INTEGER');
    database.exec(
      'UPDATE sessions SET session_id_checked = CASE WHEN session_id IS NOT NULL THEN 1 ELSE 0 END WHERE session_id_checked IS NULL',
    );
  }
  database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)');
};

const ensureDb = () => {
  if (db) return db;
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('trusted_schema = ON');
  logDebug('db open', DB_PATH);
  initSchema(db);
  return db;
};

const clearDbSchema = (database: Database.Database) => {
  database.exec(`
    DROP TRIGGER IF EXISTS messages_ai;
    DROP TRIGGER IF EXISTS messages_ad;
    DROP TRIGGER IF EXISTS messages_au;
    DROP TABLE IF EXISTS messages_fts;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS schema_version;
  `);
};

const scanSessionFiles = async (root: string): Promise<FileEntry[]> => {
  const entries: FileEntry[] = [];
  const walk = async (dir: string) => {
    const dirents = await fsp.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(dir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(fullPath);
      } else if (dirent.isFile() && dirent.name.endsWith('.jsonl')) {
        const stat = await fsp.stat(fullPath);
        const relPath = toPosix(path.relative(root, fullPath));
        entries.push({ absPath: fullPath, relPath, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  };
  await walk(root);
  return entries;
};

const parseTimestampFromFilename = (name: string) => {
  const match = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}[-:]\d{2}[-:]\d{2})/);
  if (!match) return null;
  return match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
};

const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
};

const formatToolCall = (item: unknown) => {
  const obj = asRecord(item);
  const tool = asRecord(obj.tool);
  const name = getString(obj.name) ?? getString(obj.tool_name) ?? getString(tool.name) ?? 'tool';
  const args = obj.arguments ?? obj.args ?? obj.input ?? obj.parameters;
  const parts = [`name: ${name}`];
  const callId = getString(obj.call_id) ?? getString(obj.id) ?? getString(obj.callId);
  if (callId) {
    parts.push(`call_id: ${callId}`);
  }
  const argText = formatJsonValue(args);
  if (argText) {
    parts.push(`arguments:\n${argText}`);
  }
  return parts.join('\n');
};

const formatToolOutput = (item: unknown) => {
  const obj = asRecord(item);
  const output = obj.output ?? obj.result ?? obj.content ?? obj.text ?? obj.value;
  const parts = [] as string[];
  const callId = getString(obj.call_id) ?? getString(obj.id) ?? getString(obj.callId);
  if (callId) {
    parts.push(`call_id: ${callId}`);
  }
  const outputText = formatJsonValue(output);
  if (outputText) {
    parts.push(`output:\n${outputText}`);
  }
  return parts.join('\n');
};

const SESSION_ID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
const SESSION_ID_PREFIX_REGEX = /\b(?:sess(?:ion)?[_-])[a-zA-Z0-9_-]{6,}\b/;

const normalizeSessionId = (value: string) => {
  const trimmed = value.trim();
  const uuidMatch = trimmed.match(SESSION_ID_REGEX);
  if (uuidMatch) return uuidMatch[0];
  const prefixMatch = trimmed.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return trimmed;
};

const extractSessionIdFromObject = (value: unknown, depth = 0): string | null => {
  if (!value || typeof value !== 'object' || depth > 2) return null;
  const obj = value as Record<string, unknown>;
  const direct =
    obj.session_id ??
    obj.sessionId ??
    obj.conversation_id ??
    obj.conversationId ??
    obj.resume_session_id ??
    obj.resumeSessionId;
  if (typeof direct === 'string' && direct.trim()) return normalizeSessionId(direct);
  if (typeof obj.session === 'string' && obj.session.trim()) return normalizeSessionId(obj.session);
  if (obj.session && typeof obj.session === 'object') {
    const nestedId = (obj.session as Record<string, unknown>).id;
    if (typeof nestedId === 'string' && nestedId.trim()) return normalizeSessionId(nestedId);
    const nested = extractSessionIdFromObject(obj.session, depth + 1);
    if (nested) return nested;
  }
  const containers = [obj.session_info, obj.sessionInfo, obj.metadata, obj.context, obj.payload];
  for (const container of containers) {
    const nested = extractSessionIdFromObject(container, depth + 1);
    if (nested) return nested;
  }
  return null;
};

const parseJsonlFile = async (filePath: string) => {
  const messages: Array<{
    turnId: number;
    role: string;
    timestamp?: string;
    content: string;
  }> = [];
  let firstUserMessage = '';
  let sessionMeta: {
    cwd?: string;
    git_branch?: string;
    git_repo?: string;
    timestamp?: string;
    session_id?: string;
  } = {};
  let currentTurn = 0;
  let sessionIdRank = 0;

  const updateSessionId = (value: unknown, rank: number) => {
    const extracted = extractSessionIdFromObject(value);
    if (extracted && rank >= sessionIdRank) {
      sessionMeta.session_id = extracted;
      sessionIdRank = rank;
    }
  };

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'session_meta') {
        const payload = entry.payload ?? entry;
        sessionMeta = {
          cwd: payload?.cwd ?? sessionMeta.cwd,
          git_branch: payload?.git_branch ?? payload?.gitBranch ?? sessionMeta.git_branch,
          git_repo: payload?.git_repo ?? payload?.gitRepo ?? sessionMeta.git_repo,
          timestamp: payload?.timestamp ?? entry.timestamp ?? sessionMeta.timestamp,
          session_id: sessionMeta.session_id,
        };
        updateSessionId(payload, 2);
        continue;
      }

      if (entry.type === 'turn_context') {
        const payload = entry.payload ?? entry;
        updateSessionId(payload, 1);
        continue;
      }

      if (entry.type === 'event_msg') {
        const payload = entry.payload ?? {};
        if (payload.type === 'user_message' && payload.message) {
          currentTurn += 1;
          const content = String(payload.message);
          if (!firstUserMessage) firstUserMessage = content;
          messages.push({
            turnId: currentTurn,
            role: 'user',
            timestamp: entry.timestamp,
            content,
          });
        } else if (payload.type === 'agent_message' && payload.message) {
          messages.push({
            turnId: currentTurn,
            role: 'assistant',
            timestamp: entry.timestamp,
            content: String(payload.message),
          });
        } else if (payload.type === 'agent_reasoning' && payload.text) {
          messages.push({
            turnId: currentTurn,
            role: 'thought',
            timestamp: entry.timestamp,
            content: String(payload.text),
          });
        }
        continue;
      }

      const isResponseItem = entry.type === 'response_item';
      const item = isResponseItem ? (entry.item ?? entry.response_item ?? entry.payload ?? {}) : entry;
      const itemType = isResponseItem ? item.type : entry.type;

      if (['function_call', 'custom_tool_call', 'web_search_call'].includes(itemType)) {
        messages.push({
          turnId: currentTurn,
          role: 'tool_call',
          timestamp: entry.timestamp,
          content: formatToolCall(item),
        });
        continue;
      }

      if (['function_call_output', 'custom_tool_call_output'].includes(itemType)) {
        messages.push({
          turnId: currentTurn,
          role: 'tool_output',
          timestamp: entry.timestamp,
          content: formatToolOutput(item),
        });
      }
    } catch (_error) {}
  }

  return { messages, firstUserMessage, sessionMeta };
};

const readSessionIdFromFile = async (filePath: string) => {
  let sessionId: string | null = null;
  let sessionIdRank = 0;

  const updateSessionId = (value: unknown, rank: number) => {
    const extracted = extractSessionIdFromObject(value);
    if (extracted && rank >= sessionIdRank) {
      sessionId = extracted;
      sessionIdRank = rank;
    }
  };

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'session_meta') {
        const payload = entry.payload ?? entry;
        updateSessionId(payload, 2);
        if (sessionId && sessionIdRank >= 2) break;
        continue;
      }
      if (entry.type === 'turn_context') {
        const payload = entry.payload ?? entry;
        updateSessionId(payload, 1);
      }
    } catch (_error) {}
  }

  rl.close();
  stream.close();

  return sessionId;
};

const indexSessions = async (root: string) => {
  const startedAt = Date.now();
  const database = ensureDb();
  const files = await scanSessionFiles(root);
  const existingFiles = database
    .prepare(
      `
        SELECT files.path AS path,
          files.size AS size,
          files.mtime AS mtime,
          sessions.session_id AS session_id,
          sessions.session_id_checked AS session_id_checked,
          sessions.id IS NOT NULL AS has_session
        FROM files
        LEFT JOIN sessions ON sessions.id = files.path
      `,
    )
    .all() as Array<{
    path: string;
    size: number;
    mtime: number;
    session_id?: string | null;
    session_id_checked?: number | null;
    has_session?: number | null;
  }>;
  const existingMap = new Map(existingFiles.map((row) => [row.path, row]));
  const currentPaths = new Set(files.map((file) => file.relPath));

  const insertSession = database.prepare(`
    INSERT INTO sessions (id, path, session_id, session_id_checked, timestamp, cwd, git_branch, git_repo, first_user_message)
    VALUES (@id, @path, @session_id, @session_id_checked, @timestamp, @cwd, @git_branch, @git_repo, @first_user_message)
    ON CONFLICT(id) DO UPDATE SET
      session_id = excluded.session_id,
      session_id_checked = excluded.session_id_checked,
      timestamp = excluded.timestamp,
      cwd = excluded.cwd,
      git_branch = excluded.git_branch,
      git_repo = excluded.git_repo,
      first_user_message = excluded.first_user_message
  `);
  const insertFile = database.prepare(`
    INSERT INTO files (path, size, mtime, hash, indexed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      size = excluded.size,
      mtime = excluded.mtime,
      hash = excluded.hash,
      indexed_at = excluded.indexed_at
  `);
  const deleteMessages = database.prepare('DELETE FROM messages WHERE session_id = ?');
  const deleteSession = database.prepare('DELETE FROM sessions WHERE id = ?');
  const deleteFile = database.prepare('DELETE FROM files WHERE path = ?');
  const insertMessage = database.prepare(
    'INSERT INTO messages (session_id, turn_id, role, timestamp, content) VALUES (?, ?, ?, ?, ?)',
  );
  const updateSessionId = database.prepare('UPDATE sessions SET session_id = ?, session_id_checked = 1 WHERE id = ?');
  const markSessionChecked = database.prepare('UPDATE sessions SET session_id_checked = 1 WHERE id = ?');

  let scanned = 0;
  let updated = 0;
  let removed = 0;
  let messageCount = 0;
  let skipped = 0;
  let metadataChecked = 0;

  const indexTransaction = database.transaction(
    (file: FileEntry, parsed: Awaited<ReturnType<typeof parseJsonlFile>>) => {
      try {
        deleteMessages.run(file.relPath);
      } catch (error) {
        console.error('[reindex] deleteMessages failed', file.relPath, error);
        throw error;
      }

      try {
        insertSession.run({
          id: file.relPath,
          path: file.relPath,
          session_id: parsed.sessionMeta.session_id ?? null,
          session_id_checked: 1,
          timestamp: parsed.sessionMeta.timestamp ?? null,
          cwd: parsed.sessionMeta.cwd ?? null,
          git_branch: parsed.sessionMeta.git_branch ?? null,
          git_repo: parsed.sessionMeta.git_repo ?? null,
          first_user_message: parsed.firstUserMessage || null,
        });
      } catch (error) {
        console.error('[reindex] insertSession failed', file.relPath, error);
        throw error;
      }

      for (const [index, message] of parsed.messages.entries()) {
        try {
          insertMessage.run(file.relPath, message.turnId, message.role, message.timestamp ?? null, message.content);
          messageCount += 1;
        } catch (error) {
          console.error('[reindex] insertMessage failed', {
            file: file.relPath,
            index,
            turnId: message.turnId,
            role: message.role,
            contentPreview: message.content?.slice(0, 120),
            error,
          });
          throw error;
        }
      }

      try {
        insertFile.run(file.relPath, file.size, Math.floor(file.mtimeMs), null, new Date().toISOString());
      } catch (error) {
        console.error('[reindex] insertFile failed', file.relPath, error);
        throw error;
      }
    },
  );

  for (const file of files) {
    scanned += 1;
    const existing = existingMap.get(file.relPath);
    const sameFile = existing && existing.size === file.size && existing.mtime === Math.floor(file.mtimeMs);
    if (sameFile && existing?.has_session && existing.session_id_checked) {
      skipped += 1;
      continue;
    }
    if (sameFile && existing?.has_session && !existing.session_id_checked) {
      metadataChecked += 1;
      const resolvedSessionId = await readSessionIdFromFile(file.absPath);
      if (resolvedSessionId) {
        updateSessionId.run(resolvedSessionId, file.relPath);
      } else {
        markSessionChecked.run(file.relPath);
      }
      continue;
    }
    updated += 1;

    const parsed = await parseJsonlFile(file.absPath);
    const filename = path.basename(file.relPath);
    parsed.sessionMeta.timestamp = parsed.sessionMeta.timestamp ?? parseTimestampFromFilename(filename) ?? undefined;

    indexTransaction(file, parsed);
  }

  for (const existing of existingFiles) {
    if (!currentPaths.has(existing.path)) {
      removed += 1;
      deleteMessages.run(existing.path);
      deleteSession.run(existing.path);
      deleteFile.run(existing.path);
    }
  }

  const summary = { scanned, updated, removed, messageCount, skipped, metadataChecked };
  logDebug('index complete', {
    root,
    ...summary,
    durationMs: Date.now() - startedAt,
  });
  return summary;
};

const getSessionsPreviewMap = (database: Database.Database) => {
  const rows = database
    .prepare('SELECT id, first_user_message, timestamp, cwd, git_branch, git_repo FROM sessions')
    .all() as Array<{ id: string; first_user_message?: string; timestamp?: string; cwd?: string }>;
  const map = new Map<string, { preview?: string; timestamp?: string; cwd?: string }>();
  for (const row of rows) {
    map.set(row.id, {
      preview: row.first_user_message,
      timestamp: row.timestamp,
      cwd: row.cwd,
    });
  }
  return map;
};

const buildSessionsTree = (
  root: string,
  files: FileEntry[],
  previewMap: Map<string, { preview?: string; timestamp?: string; cwd?: string }>,
) => {
  const yearsMap: YearsMap = new Map();

  for (const file of files) {
    const parts = file.relPath.split('/');
    const [year = 'Unknown', month = 'Unknown', day = 'Unknown'] = parts;
    const filename = parts[parts.length - 1];
    const preview = previewMap.get(file.relPath);

    let monthsMap = yearsMap.get(year);
    if (!monthsMap) {
      monthsMap = new Map();
      yearsMap.set(year, monthsMap);
    }

    let daysMap = monthsMap.get(month);
    if (!daysMap) {
      daysMap = new Map();
      monthsMap.set(month, daysMap);
    }

    let dayFiles = daysMap.get(day);
    if (!dayFiles) {
      dayFiles = [];
      daysMap.set(day, dayFiles);
    }

    dayFiles.push({
      id: file.relPath,
      filename,
      size: file.size,
      preview: preview?.preview ?? null,
      timestamp: preview?.timestamp ?? null,
      cwd: preview?.cwd ?? null,
    });
  }

  const years = Array.from(yearsMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, monthsMap]) => ({
      year,
      months: Array.from(monthsMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, daysMap]) => ({
          month,
          days: Array.from(daysMap.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, dayFiles]) => ({
              day,
              files: [...dayFiles].sort((a, b) => b.filename.localeCompare(a.filename)),
            })),
        })),
    }));

  return { root, years };
};

const readFirstUserMessage = async (filePath: string) => {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let linesRead = 0;
  for await (const line of rl) {
    linesRead += 1;
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'event_msg') {
        const payload = entry.payload ?? {};
        if (payload.type === 'user_message' && payload.message) {
          rl.close();
          stream.close();
          return String(payload.message);
        }
      }
    } catch (_error) {
      continue;
    }
    if (linesRead > MAX_PREVIEW_LINES) break;
  }
  rl.close();
  stream.close();
  return '';
};

const ensureRootExists = async (root: string) => {
  try {
    const stat = await fsp.stat(root);
    return stat.isDirectory();
  } catch (_error) {
    return false;
  }
};

const ensurePathSafe = (root: string, relativePath: string) => {
  if (!relativePath || relativePath.includes('\0')) return null;
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized)) return null;
  if (normalized.split(path.sep).includes('..')) return null;
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(root, normalized);
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    return null;
  }
  return resolvedPath;
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
};

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

export const apiPlugin = (): Plugin => {
  return {
    name: 'codex-formatter-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();
        if (!req.url.startsWith('/api/')) return next();

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;

        try {
          if (pathname === '/api/config' && req.method === 'GET') {
            const root = await resolveSessionsRoot();
            return sendJson(res, 200, root);
          }

          if (pathname === '/api/config' && req.method === 'POST') {
            if (process.env.CODEX_SESSIONS_ROOT) {
              return sendJson(res, 400, {
                error: 'CODEX_SESSIONS_ROOT is set; config updates are disabled until it is unset.',
              });
            }
            const body = await readJsonBody(req);
            const sessionsRoot =
              typeof body === 'object' && body ? (body as Record<string, unknown>).sessionsRoot : undefined;
            if (!sessionsRoot || typeof sessionsRoot !== 'string') {
              return sendJson(res, 400, { error: 'sessionsRoot is required.' });
            }
            if (!path.isAbsolute(sessionsRoot)) {
              return sendJson(res, 400, { error: 'sessionsRoot must be an absolute path.' });
            }
            const exists = await ensureRootExists(sessionsRoot);
            if (!exists) {
              return sendJson(res, 400, { error: 'sessionsRoot does not exist or is not a directory.' });
            }
            await setSessionsRoot(sessionsRoot);
            return sendJson(res, 200, { ok: true, sessionsRoot });
          }

          if (pathname === '/api/sessions' && req.method === 'GET') {
            const rootInfo = await resolveSessionsRoot();
            const rootExists = await ensureRootExists(rootInfo.value);
            if (!rootExists) {
              return sendJson(res, 404, {
                error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
              });
            }
            const files = await scanSessionFiles(rootInfo.value);
            const database = ensureDb();
            const previewMap = getSessionsPreviewMap(database);

            for (const file of files) {
              if (!previewMap.has(file.relPath)) {
                const preview = await readFirstUserMessage(file.absPath);
                previewMap.set(file.relPath, { preview });
              }
            }

            const tree = buildSessionsTree(rootInfo.value, files, previewMap);
            return sendJson(res, 200, tree);
          }

          if (pathname === '/api/session' && req.method === 'GET') {
            const rootInfo = await resolveSessionsRoot();
            const rootExists = await ensureRootExists(rootInfo.value);
            if (!rootExists) {
              return sendJson(res, 404, {
                error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
              });
            }
            const relativePath = url.searchParams.get('path') || '';
            const resolvedPath = ensurePathSafe(rootInfo.value, relativePath);
            if (!resolvedPath) {
              return sendJson(res, 400, { error: 'Invalid session path.' });
            }
            const raw = await fsp.readFile(resolvedPath, 'utf-8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end(raw);
            return;
          }

          if (pathname === '/api/reindex' && req.method === 'POST') {
            const rootInfo = await resolveSessionsRoot();
            const rootExists = await ensureRootExists(rootInfo.value);
            if (!rootExists) {
              return sendJson(res, 404, {
                error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
              });
            }
            logDebug('reindex start', { root: rootInfo.value });
            const summary = await indexSessions(rootInfo.value);
            logDebug('reindex done', summary);
            return sendJson(res, 200, { ok: true, summary });
          }

          if (pathname === '/api/clear-index' && req.method === 'POST') {
            const rootInfo = await resolveSessionsRoot();
            const rootExists = await ensureRootExists(rootInfo.value);
            if (!rootExists) {
              return sendJson(res, 404, {
                error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
              });
            }
            const database = ensureDb();
            const clearTransaction = database.transaction(() => {
              clearDbSchema(database);
              initSchema(database);
            });
            logDebug('clear-index start', { root: rootInfo.value });
            clearTransaction();
            const summary = await indexSessions(rootInfo.value);
            logDebug('clear-index done', summary);
            return sendJson(res, 200, { ok: true, summary });
          }

          if (pathname === '/api/resolve-session' && req.method === 'GET') {
            const id = url.searchParams.get('id')?.trim();
            if (!id) return sendJson(res, 400, { error: 'id is required.' });
            const database = ensureDb();
            const escaped = id.replace(/[\\%_]/g, '\\$&');
            const likePattern = `%${escaped}%`;
            const row = database
              .prepare(
                `
                  SELECT id
                  FROM sessions
                  WHERE session_id = ? OR path = ? OR path LIKE ? ESCAPE '\\\\'
                  ORDER BY
                    CASE
                      WHEN session_id = ? THEN 0
                      WHEN path = ? THEN 1
                      ELSE 2
                    END,
                    LENGTH(path) ASC,
                    path ASC
                  LIMIT 1
                `,
              )
              .get(id, id, likePattern, id, id) as { id?: string } | undefined;
            if (!row?.id) {
              logDebug('resolve-session miss', { id });
              return sendJson(res, 404, { error: 'Session not found.' });
            }
            logDebug('resolve-session hit', { id, resolved: row.id });
            return sendJson(res, 200, { id: row.id });
          }

          if (pathname === '/api/search' && req.method === 'GET') {
            const q = url.searchParams.get('q');
            const limit = Number(url.searchParams.get('limit') || '20');
            if (!q) return sendJson(res, 400, { error: 'q is required.' });
            const database = ensureDb();
            const stmt = database.prepare(`
              SELECT
                messages_fts.rowid AS id,
                messages_fts.content AS content,
                messages_fts.session_id AS session_id,
                messages_fts.turn_id AS turn_id,
                messages_fts.role AS role,
                messages.timestamp AS timestamp,
                sessions.timestamp AS session_timestamp,
                sessions.cwd AS cwd,
                sessions.git_branch AS git_branch,
                sessions.git_repo AS git_repo,
                snippet(messages_fts, 0, '[[', ']]', '…', 18) AS snippet
              FROM messages_fts
              JOIN messages ON messages_fts.rowid = messages.id
              JOIN sessions ON sessions.id = messages_fts.session_id
              WHERE messages_fts MATCH ?
              ORDER BY bm25(messages_fts)
              LIMIT ?
            `);
            const results = stmt.all(q, Number.isFinite(limit) ? limit : 20);
            return sendJson(res, 200, { results });
          }

          return sendJson(res, 404, { error: 'Not found' });
        } catch (error: unknown) {
          console.error('[api]', req.method, pathname, error);
          const message = error instanceof Error ? error.message : 'Server error';
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
};
