import fsp from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '../db';
import { logDebug } from '../logging';
import { extractSessionIdFromPath, parseSessionRaw, readSessionMetadataFromFile } from '../sessionDetail/parser';
import type { FileEntry } from '../types';

const toPosix = (value: string) => value.split(path.sep).join('/');

const parseSessionFile = async (filePath: string, sessionPath: string) => {
  const raw = await fsp.readFile(filePath, 'utf-8');
  return parseSessionRaw({ raw, sessionPath });
};

const readSessionIdFromFile = async (filePath: string) => {
  const metadata = await readSessionMetadataFromFile(filePath);
  return metadata.sessionId;
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
    (file: FileEntry, parsed: Awaited<ReturnType<typeof parseSessionFile>>) => {
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
          session_id: parsed.summary.sessionId ?? null,
          session_id_checked: 1,
          timestamp: parsed.summary.timestamp ?? null,
          cwd: parsed.summary.cwd ?? null,
          git_branch: parsed.summary.gitBranch ?? null,
          git_repo: parsed.summary.gitRepo ?? null,
          git_commit_hash: parsed.summary.gitCommitHash ?? null,
          first_user_message: parsed.summary.preview ?? null,
          started_at: parsed.summary.startedAt ?? null,
          ended_at: parsed.summary.endedAt ?? null,
          turn_count: parsed.summary.turnCount ?? null,
          message_count: parsed.summary.messageCount ?? null,
          thought_count: parsed.summary.thoughtCount ?? null,
          tool_call_count: parsed.summary.toolCallCount ?? null,
          meta_count: parsed.summary.metaCount ?? null,
          token_count_count: parsed.summary.tokenCountCount ?? null,
          active_duration_ms: parsed.summary.activeDurationMs ?? null,
        });
      } catch (error) {
        console.error('[reindex] insertSession failed', file.relPath, error);
        throw error;
      }

      for (const [index, message] of parsed.messagesForIndex.entries()) {
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

    const parsed = await parseSessionFile(file.absPath, file.relPath);
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
