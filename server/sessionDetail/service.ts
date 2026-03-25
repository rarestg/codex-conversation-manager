import type Database from 'better-sqlite3';
import type { SessionDetailResponse, SessionDetailSummary } from '../../shared/sessionDetailTypes';
import { buildSanitizedGitRepoSql } from '../gitRepo';
import { parseSessionRaw } from './parser';

type IndexedSessionRow = {
  id: string;
  path: string;
  session_id?: string | null;
  first_user_message?: string | null;
  timestamp?: string | null;
  cwd?: string | null;
  git_branch?: string | null;
  git_repo?: string | null;
  git_commit_hash?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  turn_count?: number | null;
  message_count?: number | null;
  thought_count?: number | null;
  tool_call_count?: number | null;
  meta_count?: number | null;
  token_count_count?: number | null;
  active_duration_ms?: number | null;
};

const getIndexedSessionSummary = (database: Database.Database, id: string): SessionDetailSummary | null => {
  const row = database
    .prepare(
      `
        SELECT
          id,
          path,
          session_id,
          first_user_message,
          timestamp,
          cwd,
          git_branch,
          ${buildSanitizedGitRepoSql('git_repo')} AS git_repo,
          git_commit_hash,
          started_at,
          ended_at,
          turn_count,
          message_count,
          thought_count,
          tool_call_count,
          meta_count,
          token_count_count,
          active_duration_ms
        FROM sessions
        WHERE id = ?
      `,
    )
    .get(id) as IndexedSessionRow | undefined;

  if (!row) return null;
  const filename = row.path.split('/').pop() || row.id;
  return {
    id: row.id,
    path: row.path,
    filename,
    sessionId: row.session_id ?? null,
    preview: row.first_user_message ?? null,
    timestamp: row.timestamp ?? null,
    cwd: row.cwd ?? null,
    gitBranch: row.git_branch ?? null,
    gitRepo: row.git_repo ?? null,
    gitCommitHash: row.git_commit_hash ?? null,
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    turnCount: row.turn_count ?? null,
    messageCount: row.message_count ?? null,
    thoughtCount: row.thought_count ?? null,
    toolCallCount: row.tool_call_count ?? null,
    metaCount: row.meta_count ?? null,
    tokenCountCount: row.token_count_count ?? null,
    activeDurationMs: row.active_duration_ms ?? null,
  };
};

const mergeSummary = (parsed: SessionDetailSummary, indexed: SessionDetailSummary | null): SessionDetailSummary => {
  if (!indexed) return parsed;
  return {
    ...parsed,
    sessionId: parsed.sessionId ?? indexed.sessionId,
    preview: parsed.preview ?? indexed.preview,
    timestamp: parsed.timestamp ?? indexed.timestamp,
    cwd: parsed.cwd ?? indexed.cwd,
    gitBranch: parsed.gitBranch ?? indexed.gitBranch,
    gitRepo: parsed.gitRepo ?? indexed.gitRepo,
    gitCommitHash: parsed.gitCommitHash ?? indexed.gitCommitHash,
    startedAt: parsed.startedAt ?? indexed.startedAt,
    endedAt: parsed.endedAt ?? indexed.endedAt,
    turnCount: parsed.turnCount ?? indexed.turnCount,
    messageCount: parsed.messageCount ?? indexed.messageCount,
    thoughtCount: parsed.thoughtCount ?? indexed.thoughtCount,
    toolCallCount: parsed.toolCallCount ?? indexed.toolCallCount,
    metaCount: parsed.metaCount ?? indexed.metaCount,
    tokenCountCount: parsed.tokenCountCount ?? indexed.tokenCountCount,
    activeDurationMs: parsed.activeDurationMs ?? indexed.activeDurationMs,
  };
};

export const buildSessionDetailResponse = (
  database: Database.Database,
  sessionId: string,
  raw: string,
): SessionDetailResponse => {
  const parsed = parseSessionRaw({ raw, sessionPath: sessionId });
  const indexed = getIndexedSessionSummary(database, sessionId);
  return {
    session: mergeSummary(parsed.summary, indexed),
    turns: parsed.turns,
    parseErrors: parsed.parseErrors,
  };
};
