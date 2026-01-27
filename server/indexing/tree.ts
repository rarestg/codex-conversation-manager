import path from 'node:path';
import type Database from 'better-sqlite3';
import type { SessionTreeEntry } from '../types';

type SessionFileInfo = SessionTreeEntry;
type DaysMap = Map<string, SessionFileInfo[]>;
type MonthsMap = Map<string, DaysMap>;
type YearsMap = Map<string, MonthsMap>;

const MAX_PREVIEW_CHARS = 1000;
const MAX_PREVIEW_LINES = 50;

export const truncatePreview = (value?: string | null) => {
  if (value === null || value === undefined) return null;
  let truncated = value.slice(0, MAX_PREVIEW_CHARS);
  const lines = truncated.split(/\r?\n/);
  if (lines.length > MAX_PREVIEW_LINES) {
    truncated = lines.slice(0, MAX_PREVIEW_LINES).join('\n');
  }
  return truncated;
};

export const getSessionsForTree = (database: Database.Database, workspace?: string | null): SessionTreeEntry[] => {
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
        sessions.token_count_count AS token_count_count,
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
    token_count_count?: number | null;
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
      tokenCount: row.token_count_count ?? null,
      startedAt: row.started_at ?? null,
      endedAt: row.ended_at ?? null,
      activeDurationMs: row.active_duration_ms ?? null,
    };
  });
};

export const buildSessionsTree = (root: string, entries: SessionTreeEntry[]) => {
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
      tokenCount: entry.tokenCount ?? null,
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
