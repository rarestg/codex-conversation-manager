import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { getDb } from '../db';
import { logDebug } from '../logging';
import type { FileEntry } from '../types';
import { truncatePreview } from './tree';

const toPosix = (value: string) => value.split(path.sep).join('/');

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

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
  let tokenCountCount = 0;
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
  let sessionMetaSeen = false;
  let malformedLines = 0;

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
    if (extracted && rank > sessionIdRank) {
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
        // Branch ancestry can append older session_meta entries; keep the first (newest) metadata canonical.
        const nextCwd = sessionMetaSeen ? (sessionMeta.cwd ?? payload?.cwd) : (payload?.cwd ?? sessionMeta.cwd);
        sessionMeta = {
          cwd: nextCwd ? normalizeCwd(nextCwd) : sessionMeta.cwd,
          git_branch: sessionMetaSeen
            ? (sessionMeta.git_branch ?? payload?.git_branch ?? payload?.gitBranch ?? gitPayload?.branch)
            : (payload?.git_branch ?? payload?.gitBranch ?? gitPayload?.branch ?? sessionMeta.git_branch),
          git_repo: sessionMetaSeen
            ? (sessionMeta.git_repo ??
              payload?.git_repo ??
              payload?.gitRepo ??
              gitPayload?.repository_url ??
              gitPayload?.repositoryUrl)
            : (payload?.git_repo ??
              payload?.gitRepo ??
              gitPayload?.repository_url ??
              gitPayload?.repositoryUrl ??
              sessionMeta.git_repo),
          git_commit_hash: sessionMetaSeen
            ? (sessionMeta.git_commit_hash ??
              payload?.git_commit_hash ??
              payload?.gitCommitHash ??
              gitPayload?.commit_hash ??
              gitPayload?.commitHash)
            : (payload?.git_commit_hash ??
              payload?.gitCommitHash ??
              gitPayload?.commit_hash ??
              gitPayload?.commitHash ??
              sessionMeta.git_commit_hash),
          timestamp: sessionMetaSeen
            ? (sessionMeta.timestamp ?? payload?.timestamp ?? entry.timestamp)
            : (payload?.timestamp ?? entry.timestamp ?? sessionMeta.timestamp),
          session_id: sessionMeta.session_id,
        };
        updateSessionId(payload, 2);
        sessionMetaSeen = true;
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
          tokenCountCount += 1;
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
    } catch (error) {
      if (malformedLines < 3) {
        logDebug('parseJsonlFile: malformed line', { filePath, error });
      } else if (malformedLines === 3) {
        logDebug('parseJsonlFile: further malformed lines suppressed', { filePath });
      }
      malformedLines += 1;
    }
  }

  closeActiveTurn();

  return {
    messages,
    firstUserMessage: firstUserMessage || '',
    sessionMeta,
    metrics: {
      startedAt,
      endedAt,
      turnCount: turnCount > 0 ? turnCount : null,
      messageCount: messages.length,
      thoughtCount,
      toolCallCount,
      metaCount,
      tokenCountCount,
      activeDurationMs: activeDurationPairs > 0 ? activeDurationMs : null,
    },
  };
};

const readSessionIdFromFile = async (filePath: string) => {
  let sessionId: string | null = null;
  let sessionIdRank = 0;
  let malformedLines = 0;

  const updateSessionId = (value: unknown, rank: number) => {
    const extracted = extractSessionIdFromObject(value);
    if (extracted && rank > sessionIdRank) {
      sessionId = extracted;
      sessionIdRank = rank;
    }
  };

  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  try {
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
      } catch (error) {
        if (malformedLines < 3) {
          logDebug('readSessionIdFromFile: malformed line', { filePath, error });
        } else if (malformedLines === 3) {
          logDebug('readSessionIdFromFile: further malformed lines suppressed', { filePath });
        }
        malformedLines += 1;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  return sessionId;
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

export const indexSessions = async (root: string) => {
  const startedAt = Date.now();
  const database = getDb();
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
      token_count_count,
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
      @token_count_count,
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
      token_count_count = excluded.token_count_count,
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
        const fileSessionId = extractSessionIdFromPath(file.relPath);
        // Filename session ID is authoritative; session_meta is only a fallback when filename lacks an ID.
        if (fileSessionId && parsed.sessionMeta.session_id && fileSessionId !== parsed.sessionMeta.session_id) {
          logDebug('session:id:mismatch', {
            path: file.relPath,
            filenameId: fileSessionId,
            parsedId: parsed.sessionMeta.session_id,
          });
        }
        insertSession.run({
          id: file.relPath,
          path: file.relPath,
          session_id: fileSessionId ?? parsed.sessionMeta.session_id ?? null,
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
          token_count_count: parsed.metrics.tokenCountCount ?? null,
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
      const filenameSessionId = extractSessionIdFromPath(file.relPath);
      const resolvedSessionId = filenameSessionId ?? (await readSessionIdFromFile(file.absPath));
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
