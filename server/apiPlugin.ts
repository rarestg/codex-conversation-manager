import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';
import Database from 'better-sqlite3';
import type { Plugin } from 'vite';

const CONFIG_DIR = path.join(os.homedir(), '.codex-formatter');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_SESSIONS_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const DB_PATH = path.join(CONFIG_DIR, 'codex_index.db');
const MAX_PREVIEW_CHARS = 1000;
const MAX_PREVIEW_LINES = 50;

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
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  startedAt: string | null;
  endedAt: string | null;
  activeDurationMs: number | null;
  sessionId: string;
}

interface SessionTreeEntry {
  id: string;
  filename: string;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  sessionId: string;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  startedAt: string | null;
  endedAt: string | null;
  activeDurationMs: number | null;
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

const extractGithubSlug = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1];
  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  if (httpsMatch) return httpsMatch[1];
  const sshUrlMatch = trimmed.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshUrlMatch) return sshUrlMatch[1];
  return null;
};

const extractSessionIdFromPath = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || normalized;
  const withoutExt = filename.replace(/\.jsonl$/i, '');
  const match = withoutExt.match(SESSION_ID_REGEX);
  if (match) return match[0];
  const prefixMatch = withoutExt.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return null;
};

const normalizeCwd = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const normalized = path.normalize(trimmed);
    return path.isAbsolute(normalized) ? path.resolve(normalized) : normalized;
  } catch (_error) {
    return trimmed;
  }
};

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
      git_commit_hash TEXT,
      first_user_message TEXT,
      started_at TEXT,
      ended_at TEXT,
      turn_count INTEGER,
      message_count INTEGER,
      thought_count INTEGER,
      tool_call_count INTEGER,
      meta_count INTEGER,
      active_duration_ms INTEGER
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
    CREATE INDEX IF NOT EXISTS idx_sessions_cwd ON sessions(cwd);
  `);
  database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)');
};

const SESSION_COLUMNS: Record<string, string> = {
  started_at: 'TEXT',
  ended_at: 'TEXT',
  turn_count: 'INTEGER',
  message_count: 'INTEGER',
  thought_count: 'INTEGER',
  tool_call_count: 'INTEGER',
  meta_count: 'INTEGER',
  active_duration_ms: 'INTEGER',
};

const ensureSessionColumns = (database: Database.Database) => {
  const rows = database.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
  const existing = new Set(rows.map((row) => row.name));
  const missing = Object.entries(SESSION_COLUMNS).filter(([name]) => !existing.has(name));
  if (!missing.length) return;
  for (const [name, type] of missing) {
    database.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
  }
  logDebug('db migrate sessions', { added: missing.map(([name]) => name) });
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
  ensureSessionColumns(db);
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

const truncatePreview = (value?: string | null) => {
  if (value === null || value === undefined) return null;
  let truncated = value.slice(0, MAX_PREVIEW_CHARS);
  const lines = truncated.split(/\r?\n/);
  if (lines.length > MAX_PREVIEW_LINES) {
    truncated = lines.slice(0, MAX_PREVIEW_LINES).join('\n');
  }
  return truncated;
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
    obj.resumeSessionId ??
    obj.id;
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
    git_commit_hash?: string;
    timestamp?: string;
    session_id?: string;
  } = {};
  let currentTurn = 0;
  let turnCount = 0;
  let thoughtCount = 0;
  let toolCallCount = 0;
  let metaCount = 0;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let startedAtMs: number | null = null;
  let endedAtMs: number | null = null;
  let inTurn = false;
  let currentTurnStartMs: number | null = null;
  let lastAgentMs: number | null = null;
  let activeDurationMs = 0;
  let activeDurationPairs = 0;
  let sessionIdRank = 0;

  const parseTimestamp = (value?: string | null) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const updateTimestampBounds = (value?: string | null) => {
    if (!value) return;
    const parsed = parseTimestamp(value);
    if (parsed === null) return;
    if (startedAtMs === null || parsed < startedAtMs) {
      startedAtMs = parsed;
      startedAt = value;
    }
    if (endedAtMs === null || parsed > endedAtMs) {
      endedAtMs = parsed;
      endedAt = value;
    }
  };

  const closeActiveTurn = () => {
    if (!inTurn) return;
    if (currentTurnStartMs !== null && lastAgentMs !== null) {
      const diff = lastAgentMs - currentTurnStartMs;
      if (Number.isFinite(diff) && diff >= 0) {
        activeDurationMs += diff;
        activeDurationPairs += 1;
      }
    }
    inTurn = false;
    currentTurnStartMs = null;
    lastAgentMs = null;
  };

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
      updateTimestampBounds(entry.timestamp);
      if (entry.type === 'session_meta') {
        metaCount += 1;
        const payload = entry.payload ?? entry;
        const gitPayload = payload?.git ?? {};
        const nextCwd = payload?.cwd ?? sessionMeta.cwd;
        sessionMeta = {
          cwd: nextCwd ? normalizeCwd(nextCwd) : sessionMeta.cwd,
          git_branch: payload?.git_branch ?? payload?.gitBranch ?? gitPayload?.branch ?? sessionMeta.git_branch,
          git_repo:
            payload?.git_repo ??
            payload?.gitRepo ??
            gitPayload?.repository_url ??
            gitPayload?.repositoryUrl ??
            sessionMeta.git_repo,
          git_commit_hash:
            payload?.git_commit_hash ??
            payload?.gitCommitHash ??
            gitPayload?.commit_hash ??
            gitPayload?.commitHash ??
            sessionMeta.git_commit_hash,
          timestamp: payload?.timestamp ?? entry.timestamp ?? sessionMeta.timestamp,
          session_id: sessionMeta.session_id,
        };
        updateSessionId(payload, 2);
        continue;
      }

      if (entry.type === 'turn_context') {
        metaCount += 1;
        const payload = entry.payload ?? entry;
        updateSessionId(payload, 1);
        continue;
      }

      if (entry.type === 'event_msg') {
        const payload = entry.payload ?? {};
        if (payload.type === 'user_message') {
          closeActiveTurn();
          inTurn = true;
          currentTurnStartMs = parseTimestamp(entry.timestamp);
          lastAgentMs = null;
          currentTurn += 1;
          turnCount += 1;
          const content = String(payload.message ?? '');
          if (!firstUserMessage) {
            const trimmed = content.trim();
            if (trimmed) firstUserMessage = truncatePreview(trimmed) ?? '';
          }
          messages.push({
            turnId: currentTurn,
            role: 'user',
            timestamp: entry.timestamp,
            content,
          });
        } else if (payload.type === 'agent_message') {
          if (inTurn) {
            const agentMs = parseTimestamp(entry.timestamp);
            if (agentMs !== null) lastAgentMs = agentMs;
          }
          const content = String(payload.message ?? '');
          messages.push({
            turnId: currentTurn,
            role: 'assistant',
            timestamp: entry.timestamp,
            content,
          });
        } else if (payload.type === 'agent_reasoning' && payload.text) {
          thoughtCount += 1;
          messages.push({
            turnId: currentTurn,
            role: 'thought',
            timestamp: entry.timestamp,
            content: String(payload.text),
          });
        } else if (payload.type === 'token_count') {
          metaCount += 1;
        } else if (payload.type === 'turn_aborted') {
          continue;
        }
        continue;
      }

      const isResponseItem = entry.type === 'response_item';
      const item = isResponseItem ? (entry.item ?? entry.response_item ?? entry.payload ?? {}) : entry;
      const itemType = isResponseItem ? item.type : entry.type;

      if (['function_call', 'custom_tool_call', 'web_search_call'].includes(itemType)) {
        toolCallCount += 1;
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

  closeActiveTurn();

  return {
    messages,
    firstUserMessage: truncatePreview(firstUserMessage) ?? '',
    sessionMeta,
    metrics: {
      startedAt,
      endedAt,
      turnCount: turnCount > 0 ? turnCount : null,
      messageCount: messages.length,
      thoughtCount,
      toolCallCount,
      metaCount,
      activeDurationMs: activeDurationPairs > 0 ? activeDurationMs : null,
    },
  };
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
    INSERT INTO sessions (
      id,
      path,
      session_id,
      session_id_checked,
      timestamp,
      cwd,
      git_branch,
      git_repo,
      git_commit_hash,
      first_user_message,
      started_at,
      ended_at,
      turn_count,
      message_count,
      thought_count,
      tool_call_count,
      meta_count,
      active_duration_ms
    )
    VALUES (
      @id,
      @path,
      @session_id,
      @session_id_checked,
      @timestamp,
      @cwd,
      @git_branch,
      @git_repo,
      @git_commit_hash,
      @first_user_message,
      @started_at,
      @ended_at,
      @turn_count,
      @message_count,
      @thought_count,
      @tool_call_count,
      @meta_count,
      @active_duration_ms
    )
    ON CONFLICT(id) DO UPDATE SET
      session_id = excluded.session_id,
      session_id_checked = excluded.session_id_checked,
      timestamp = excluded.timestamp,
      cwd = excluded.cwd,
      git_branch = excluded.git_branch,
      git_repo = excluded.git_repo,
      git_commit_hash = excluded.git_commit_hash,
      first_user_message = excluded.first_user_message,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      turn_count = excluded.turn_count,
      message_count = excluded.message_count,
      thought_count = excluded.thought_count,
      tool_call_count = excluded.tool_call_count,
      meta_count = excluded.meta_count,
      active_duration_ms = excluded.active_duration_ms
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
          session_id: parsed.sessionMeta.session_id ?? extractSessionIdFromPath(file.relPath) ?? null,
          session_id_checked: 1,
          timestamp: parsed.sessionMeta.timestamp ?? null,
          cwd: parsed.sessionMeta.cwd ?? null,
          git_branch: parsed.sessionMeta.git_branch ?? null,
          git_repo: parsed.sessionMeta.git_repo ?? null,
          git_commit_hash: parsed.sessionMeta.git_commit_hash ?? null,
          first_user_message: parsed.firstUserMessage || null,
          started_at: parsed.metrics.startedAt ?? null,
          ended_at: parsed.metrics.endedAt ?? null,
          turn_count: parsed.metrics.turnCount ?? null,
          message_count: parsed.metrics.messageCount ?? null,
          thought_count: parsed.metrics.thoughtCount ?? null,
          tool_call_count: parsed.metrics.toolCallCount ?? null,
          meta_count: parsed.metrics.metaCount ?? null,
          active_duration_ms: parsed.metrics.activeDurationMs ?? null,
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

const getSessionsForTree = (database: Database.Database, workspace?: string | null): SessionTreeEntry[] => {
  const whereClause = workspace ? 'WHERE sessions.cwd = ?' : '';
  const stmt = database.prepare(
    `
      SELECT
        sessions.id AS id,
        sessions.path AS path,
        sessions.first_user_message AS first_user_message,
        sessions.timestamp AS timestamp,
        sessions.cwd AS cwd,
        sessions.git_branch AS git_branch,
        sessions.git_repo AS git_repo,
        sessions.git_commit_hash AS git_commit_hash,
        sessions.session_id AS session_id,
        sessions.turn_count AS turn_count,
        sessions.message_count AS message_count,
        sessions.thought_count AS thought_count,
        sessions.tool_call_count AS tool_call_count,
        sessions.meta_count AS meta_count,
        sessions.started_at AS started_at,
        sessions.ended_at AS ended_at,
        sessions.active_duration_ms AS active_duration_ms
      FROM sessions
      ${whereClause}
    `,
  );
  const rows = (workspace ? stmt.all(workspace) : stmt.all()) as Array<{
    id: string;
    path: string;
    first_user_message?: string | null;
    timestamp?: string | null;
    cwd?: string | null;
    git_branch?: string | null;
    git_repo?: string | null;
    git_commit_hash?: string | null;
    session_id?: string | null;
    turn_count?: number | null;
    message_count?: number | null;
    thought_count?: number | null;
    tool_call_count?: number | null;
    meta_count?: number | null;
    started_at?: string | null;
    ended_at?: string | null;
    active_duration_ms?: number | null;
  }>;

  return rows.map((row) => {
    const filename = path.basename(row.path || row.id);
    return {
      id: row.id,
      filename,
      preview: truncatePreview(row.first_user_message ?? undefined),
      timestamp: row.timestamp ?? null,
      cwd: row.cwd ?? null,
      gitBranch: row.git_branch ?? null,
      gitRepo: row.git_repo ?? null,
      gitCommitHash: row.git_commit_hash ?? null,
      sessionId: row.session_id ?? '',
      turnCount: row.turn_count ?? null,
      messageCount: row.message_count ?? null,
      thoughtCount: row.thought_count ?? null,
      toolCallCount: row.tool_call_count ?? null,
      metaCount: row.meta_count ?? null,
      startedAt: row.started_at ?? null,
      endedAt: row.ended_at ?? null,
      activeDurationMs: row.active_duration_ms ?? null,
    };
  });
};

const getWorkspaceSummaries = (database: Database.Database) => {
  const rows = database
    .prepare(
      `
        WITH summary AS (
          SELECT cwd, COUNT(*) AS session_count, MAX(timestamp) AS last_seen
          FROM sessions
          WHERE cwd IS NOT NULL AND cwd != ''
          GROUP BY cwd
        ),
        ranked AS (
          SELECT
            cwd,
            git_branch,
            git_repo,
            git_commit_hash,
            timestamp,
            ROW_NUMBER() OVER (PARTITION BY cwd ORDER BY timestamp DESC) AS rn
          FROM sessions
          WHERE cwd IS NOT NULL AND cwd != ''
        )
        SELECT
          summary.cwd AS cwd,
          summary.session_count AS session_count,
          summary.last_seen AS last_seen,
          ranked.git_branch AS git_branch,
          ranked.git_repo AS git_repo,
          ranked.git_commit_hash AS git_commit_hash
        FROM summary
        LEFT JOIN ranked ON ranked.cwd = summary.cwd AND ranked.rn = 1
      `,
    )
    .all() as Array<{
    cwd: string;
    session_count: number;
    last_seen?: string | null;
    git_branch?: string | null;
    git_repo?: string | null;
    git_commit_hash?: string | null;
  }>;
  return rows.map((row) => ({
    cwd: row.cwd,
    session_count: row.session_count,
    last_seen: row.last_seen ?? null,
    git_branch: row.git_branch ?? null,
    git_repo: row.git_repo ?? null,
    git_commit_hash: row.git_commit_hash ?? null,
    github_slug: extractGithubSlug(row.git_repo ?? undefined),
  }));
};

const buildSessionsTree = (root: string, entries: SessionTreeEntry[]) => {
  const yearsMap: YearsMap = new Map();

  for (const entry of entries) {
    const parts = entry.id.split('/');
    const [year = 'Unknown', month = 'Unknown', day = 'Unknown'] = parts;
    const filename = entry.filename || parts[parts.length - 1];

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
      id: entry.id,
      filename,
      preview: entry.preview ?? null,
      timestamp: entry.timestamp ?? null,
      cwd: entry.cwd ?? null,
      gitBranch: entry.gitBranch ?? null,
      gitRepo: entry.gitRepo ?? null,
      gitCommitHash: entry.gitCommitHash ?? null,
      sessionId: entry.sessionId ?? '',
      turnCount: entry.turnCount ?? null,
      messageCount: entry.messageCount ?? null,
      thoughtCount: entry.thoughtCount ?? null,
      toolCallCount: entry.toolCallCount ?? null,
      metaCount: entry.metaCount ?? null,
      startedAt: entry.startedAt ?? null,
      endedAt: entry.endedAt ?? null,
      activeDurationMs: entry.activeDurationMs ?? null,
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
              files: [...dayFiles].sort((a, b) => {
                const aTime = Date.parse(a.startedAt ?? a.timestamp ?? '');
                const bTime = Date.parse(b.startedAt ?? b.timestamp ?? '');
                const aValid = Number.isFinite(aTime);
                const bValid = Number.isFinite(bTime);
                if (aValid && bValid && aTime !== bTime) return bTime - aTime;
                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;
                return b.filename.localeCompare(a.filename);
              }),
            })),
        })),
    }));

  return { root, years };
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
            const startedAt = performance.now();
            const rootInfo = await resolveSessionsRoot();
            const rootExists = await ensureRootExists(rootInfo.value);
            const afterRoot = performance.now();
            if (!rootExists) {
              return sendJson(res, 404, {
                error: `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
              });
            }
            const database = ensureDb();
            const afterDbInit = performance.now();
            const workspace = url.searchParams.get('workspace')?.trim() || null;
            const entries = getSessionsForTree(database, workspace);
            const afterQuery = performance.now();
            const tree = buildSessionsTree(rootInfo.value, entries);
            const afterTree = performance.now();
            const payload = JSON.stringify(tree);
            const afterJson = performance.now();
            const payloadBytes = Buffer.byteLength(payload);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
              'Server-Timing',
              [
                `root;dur=${(afterRoot - startedAt).toFixed(2)}`,
                `dbinit;dur=${(afterDbInit - afterRoot).toFixed(2)}`,
                `query;dur=${(afterQuery - afterDbInit).toFixed(2)}`,
                `tree;dur=${(afterTree - afterQuery).toFixed(2)}`,
                `json;dur=${(afterJson - afterTree).toFixed(2)}`,
                `total;dur=${(afterJson - startedAt).toFixed(2)}`,
              ].join(', '),
            );
            res.end(payload);

            if (DEBUG_ENABLED) {
              const queryMs = afterQuery - afterDbInit;
              const totalMs = afterJson - startedAt;
              logDebug('/api/sessions timing', {
                rootMs: afterRoot - startedAt,
                dbInitMs: afterDbInit - afterRoot,
                queryMs,
                treeMs: afterTree - afterQuery,
                jsonMs: afterJson - afterTree,
                totalMs,
                entries: entries.length,
                payloadKb: Math.round(payloadBytes / 1024),
              });
              if (queryMs > 200) {
                try {
                  const rowCounts = database
                    .prepare(
                      `
                        SELECT
                          (SELECT COUNT(*) FROM sessions) AS sessions_count,
                          (SELECT COUNT(*) FROM messages) AS messages_count
                      `,
                    )
                    .get() as { sessions_count: number; messages_count: number };
                  logDebug('/api/sessions counts', rowCounts);

                  const whereClause = workspace ? 'WHERE sessions.cwd = ?' : '';
                  const explainStmt = database.prepare(
                    `
                      EXPLAIN QUERY PLAN
                      SELECT
                        sessions.id AS id,
                        sessions.path AS path,
                        sessions.first_user_message AS first_user_message,
                        sessions.timestamp AS timestamp,
                        sessions.cwd AS cwd,
                        sessions.git_branch AS git_branch,
                        sessions.git_repo AS git_repo,
                        sessions.git_commit_hash AS git_commit_hash,
                        sessions.session_id AS session_id,
                        sessions.turn_count AS turn_count,
                        sessions.message_count AS message_count,
                        sessions.thought_count AS thought_count,
                        sessions.tool_call_count AS tool_call_count,
                        sessions.meta_count AS meta_count,
                        sessions.started_at AS started_at,
                        sessions.ended_at AS ended_at,
                        sessions.active_duration_ms AS active_duration_ms
                      FROM sessions
                      ${whereClause}
                    `,
                  );
                  const plan = workspace ? explainStmt.all(workspace) : explainStmt.all();
                  logDebug('/api/sessions query plan', plan);
                } catch (error) {
                  logDebug('/api/sessions debug query failed', error);
                }
              }
            }
            return;
          }

          if (pathname === '/api/workspaces' && req.method === 'GET') {
            const sort = url.searchParams.get('sort');
            const sortBy = sort === 'session_count' ? 'session_count' : 'last_seen';
            const database = ensureDb();
            const workspaces = getWorkspaceSummaries(database);
            workspaces.sort((a, b) => {
              if (sortBy === 'session_count') {
                if (b.session_count !== a.session_count) {
                  return b.session_count - a.session_count;
                }
                const lastSeenCompare = (b.last_seen ?? '').localeCompare(a.last_seen ?? '');
                if (lastSeenCompare !== 0) return lastSeenCompare;
              } else {
                const lastSeenCompare = (b.last_seen ?? '').localeCompare(a.last_seen ?? '');
                if (lastSeenCompare !== 0) return lastSeenCompare;
                if (b.session_count !== a.session_count) {
                  return b.session_count - a.session_count;
                }
              }
              return a.cwd.localeCompare(b.cwd);
            });
            return sendJson(res, 200, { workspaces });
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
            let raw: string;
            try {
              raw = await fsp.readFile(resolvedPath, 'utf-8');
            } catch (error: any) {
              if (error?.code === 'ENOENT') {
                return sendJson(res, 404, { error: 'Session file not found. Please reindex.' });
              }
              if (error?.code === 'EACCES') {
                return sendJson(res, 403, { error: 'Unable to read session file.' });
              }
              throw error;
            }
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
            const workspace = url.searchParams.get('workspace')?.trim();
            const database = ensureDb();
            const escaped = id.replace(/[\\%_]/g, '\\$&');
            const likePattern = `%${escaped}%`;
            const params: Array<string> = [id, id, likePattern];
            let whereClause = "session_id = ? OR path = ? OR path LIKE ? ESCAPE '\\\\'";
            if (workspace) {
              whereClause = `(${whereClause}) AND cwd = ?`;
              params.push(workspace);
            }
            const row = database
              .prepare(
                `
                  SELECT id
                  FROM sessions
                  WHERE ${whereClause}
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
              .get(...params, id, id) as { id?: string } | undefined;
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
            const workspace = url.searchParams.get('workspace')?.trim() || null;
            if (!q) return sendJson(res, 400, { error: 'q is required.' });
            const database = ensureDb();
            const params: Array<string | number> = [q];
            let whereClause = 'messages_fts MATCH ?';
            if (workspace) {
              whereClause += ' AND sessions.cwd = ?';
              params.push(workspace);
            }
            params.push(Number.isFinite(limit) ? limit : 20);
            type SearchResultRow = {
              id: number;
              content: string;
              session_id: string;
              turn_id: number;
              role: string;
              timestamp?: string | null;
              session_timestamp?: string | null;
              cwd?: string | null;
              git_branch?: string | null;
              git_repo?: string | null;
              git_commit_hash?: string | null;
              snippet?: string | null;
            };
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
                sessions.git_commit_hash AS git_commit_hash,
                snippet(messages_fts, 0, '[[', ']]', '…', 18) AS snippet
              FROM messages_fts
              JOIN messages ON messages_fts.rowid = messages.id
              JOIN sessions ON sessions.id = messages_fts.session_id
              WHERE ${whereClause}
              ORDER BY bm25(messages_fts)
              LIMIT ?
            `);
            const results = stmt.all(...params) as SearchResultRow[];
            const summaries = getWorkspaceSummaries(database);
            const summaryMap = new Map(summaries.map((summary) => [summary.cwd, summary]));
            const groupsMap = new Map<
              string,
              {
                workspace: {
                  cwd: string;
                  session_count: number;
                  last_seen: string | null;
                  git_branch: string | null;
                  git_repo: string | null;
                  git_commit_hash: string | null;
                  github_slug: string | null;
                };
                match_count: number;
                results: SearchResultRow[];
              }
            >();

            for (const result of results) {
              const workspaceKey = result.cwd || 'Unknown workspace';
              const summary = summaryMap.get(workspaceKey);
              const workspaceSummary = summary
                ? summary
                : {
                    cwd: workspaceKey,
                    session_count: 0,
                    last_seen: result.session_timestamp ?? null,
                    git_branch: result.git_branch ?? null,
                    git_repo: result.git_repo ?? null,
                    git_commit_hash: result.git_commit_hash ?? null,
                    github_slug: extractGithubSlug(result.git_repo ?? undefined),
                  };
              const group = groupsMap.get(workspaceKey) ?? {
                workspace: workspaceSummary,
                match_count: 0,
                results: [] as SearchResultRow[],
              };
              group.results.push(result);
              group.match_count += 1;
              groupsMap.set(workspaceKey, group);
            }

            const groups = Array.from(groupsMap.values())
              .map((group) => {
                if (!group.workspace.last_seen) {
                  group.workspace.last_seen = group.results[0]?.session_timestamp ?? null;
                }
                if (!group.match_count) {
                  group.match_count = group.results.length;
                }
                return group;
              })
              .sort((a, b) => {
                const lastSeenCompare = (b.workspace.last_seen ?? '').localeCompare(a.workspace.last_seen ?? '');
                if (lastSeenCompare !== 0) return lastSeenCompare;
                if (b.workspace.session_count !== a.workspace.session_count) {
                  return b.workspace.session_count - a.workspace.session_count;
                }
                return a.workspace.cwd.localeCompare(b.workspace.cwd);
              });

            return sendJson(res, 200, { groups });
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
