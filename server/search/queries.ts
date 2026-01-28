import { performance } from 'node:perf_hooks';
import type Database from 'better-sqlite3';
import type {
  SearchGroupSort,
  SearchResponse,
  SearchResultSort,
  SessionMatchesResponse,
  SessionSearchResult,
  WorkspaceSearchGroup,
} from '../../shared/apiTypes';
import { logDebug, logSearchDebug } from '../logging';
import type { WorkspaceSummary } from '../workspaces';
import { normalizeFtsQuery } from './normalize';

type SearchResultRow = SessionSearchResult;

export type SearchTimings = {
  normalizeMs: number;
  queryMs: number;
  groupMs: number;
  totalMs: number;
};

export type SearchQueryResult = {
  response: SearchResponse;
  timings: SearchTimings;
};

export type SessionMatchTimings = {
  normalizeMs: number;
  queryMs: number;
  totalMs: number;
};

export type SessionMatchResult = {
  response: SessionMatchesResponse;
  timings: SessionMatchTimings;
};

type SearchSessionsOptions = {
  query: string;
  limit: number;
  workspace?: string | null;
  requestId?: string | null;
  resultSort: SearchResultSort;
  groupSort: SearchGroupSort;
  getWorkspaceSummaries: (database: Database.Database, workspaces?: string[]) => WorkspaceSummary[];
};

export const searchSessions = (database: Database.Database, options: SearchSessionsOptions): SearchQueryResult => {
  const { query, limit, workspace, requestId, resultSort, groupSort, getWorkspaceSummaries } = options;
  const totalStart = performance.now();
  logSearchDebug('search:request', { requestId, q: query, limit, workspace, resultSort, groupSort });
  const normalizeStart = performance.now();
  const normalized = normalizeFtsQuery(query);
  const normalizeMs = performance.now() - normalizeStart;
  if (!normalized.normalized) {
    logSearchDebug('search:normalized:empty', {
      requestId,
      q: query,
      tokens: normalized.tokens,
      truncated: normalized.truncated,
      resultSort,
      groupSort,
    });
    const totalMs = performance.now() - totalStart;
    return {
      response: { groups: [], tokens: normalized.tokens },
      timings: { normalizeMs, queryMs: 0, groupMs: 0, totalMs },
    };
  }
  logSearchDebug('search:normalized', {
    requestId,
    q: query,
    normalized: normalized.normalized,
    tokens: normalized.tokens,
    truncated: normalized.truncated,
    resultSort,
    groupSort,
  });
  const params: Array<string | number> = [normalized.normalized];
  const workspaceFilter = workspace ? 'AND sessions.cwd = ?' : '';
  if (workspace) {
    params.push(workspace);
  }
  params.push(Number.isFinite(limit) ? limit : 20);
  const orderBy =
    resultSort === 'matches'
      ? 'aggregated.match_message_count DESC, aggregated.match_turn_count DESC, sessions.timestamp DESC, sessions.id ASC'
      : resultSort === 'recent'
        ? 'sessions.timestamp DESC, aggregated.best_score ASC, sessions.id ASC'
        : 'aggregated.best_score ASC, sessions.timestamp DESC, sessions.id ASC';
  try {
    const stmt = database.prepare(`
      WITH matches AS (
        SELECT
          messages_fts.session_id AS session_id,
          messages_fts.turn_id AS turn_id,
          bm25(messages_fts) AS score,
          snippet(messages_fts, 0, '[[', ']]', '…', 18) AS snippet
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.id
        JOIN sessions ON sessions.id = messages_fts.session_id
        -- Intentionally exclude preamble (turn_id <= 0) to keep search + match navigation consistent.
        WHERE messages_fts MATCH ? AND messages_fts.turn_id > 0
        ${workspaceFilter}
      ),
      ranked AS (
        SELECT
          session_id,
          turn_id,
          score,
          snippet,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY score ASC) AS rn
        FROM matches
      ),
      aggregated AS (
        SELECT
          session_id,
          COUNT(*) AS match_message_count,
          COUNT(DISTINCT CASE WHEN turn_id > 0 THEN turn_id END) AS match_turn_count,
          COALESCE(
            MIN(CASE WHEN rn = 1 AND turn_id > 0 THEN turn_id END),
            MIN(CASE WHEN turn_id > 0 THEN turn_id END)
          ) AS first_match_turn_id,
          MIN(CASE WHEN rn = 1 THEN snippet END) AS snippet,
          MIN(score) AS best_score
        FROM ranked
        GROUP BY session_id
      )
      SELECT
        sessions.id AS session_path,
        sessions.session_id AS session_id,
        sessions.first_user_message AS first_user_message,
        sessions.timestamp AS session_timestamp,
        sessions.cwd AS cwd,
        sessions.git_branch AS git_branch,
        sessions.git_repo AS git_repo,
        sessions.git_commit_hash AS git_commit_hash,
        sessions.turn_count AS turn_count,
        sessions.started_at AS started_at,
        sessions.ended_at AS ended_at,
        sessions.active_duration_ms AS active_duration_ms,
        aggregated.match_message_count AS match_message_count,
        aggregated.match_turn_count AS match_turn_count,
        aggregated.first_match_turn_id AS first_match_turn_id,
        aggregated.snippet AS snippet
      FROM aggregated
      JOIN sessions ON sessions.id = aggregated.session_id
      ORDER BY ${orderBy}
      LIMIT ?
    `);
    const queryStart = performance.now();
    const results = stmt.all(...params) as SearchResultRow[];
    const queryMs = performance.now() - queryStart;
    if (results.length === 0) {
      const totalMs = performance.now() - totalStart;
      logSearchDebug('search:results', {
        requestId,
        q: query,
        normalized: normalized.normalized,
        tokens: normalized.tokens,
        workspace,
        limit,
        resultSort,
        groupSort,
        workspaceFilter,
        orderBy,
        params,
        resultCount: 0,
        groupCount: 0,
        results: [],
        groups: [],
        durationMs: Number(totalMs.toFixed(2)),
      });
      return {
        response: { groups: [], tokens: normalized.tokens },
        timings: { normalizeMs, queryMs, groupMs: 0, totalMs },
      };
    }
    const groupStart = performance.now();
    const workspaceValues = Array.from(
      new Set(results.map((result) => result.cwd).filter((value): value is string => Boolean(value?.trim()))),
    );
    const summaries = workspaceValues.length ? getWorkspaceSummaries(database, workspaceValues) : [];
    const summaryMap = new Map(summaries.map((summary) => [summary.cwd, summary]));
    const groupsMap = new Map<string, WorkspaceSearchGroup>();

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
            github_slug: null,
          };
      const group = groupsMap.get(workspaceKey) ?? {
        workspace: workspaceSummary,
        match_count: 0,
        results: [] as SearchResultRow[],
      };
      group.results.push(result);
      group.match_count += result.match_message_count || 0;
      if (result.session_timestamp) {
        const currentLastSeen = group.workspace.last_seen;
        if (!currentLastSeen || result.session_timestamp > currentLastSeen) {
          group.workspace.last_seen = result.session_timestamp;
        }
      }
      groupsMap.set(workspaceKey, group);
    }

    const groups = Array.from(groupsMap.values())
      .map((group) => {
        if (!group.match_count) {
          group.match_count = group.results.length;
        }
        return group;
      })
      .sort((a, b) => {
        if (groupSort === 'matches') {
          if (b.match_count !== a.match_count) {
            return b.match_count - a.match_count;
          }
          const lastSeenCompare = (b.workspace.last_seen ?? '').localeCompare(a.workspace.last_seen ?? '');
          if (lastSeenCompare !== 0) return lastSeenCompare;
          return a.workspace.cwd.localeCompare(b.workspace.cwd);
        }
        const lastSeenCompare = (b.workspace.last_seen ?? '').localeCompare(a.workspace.last_seen ?? '');
        if (lastSeenCompare !== 0) return lastSeenCompare;
        if (b.workspace.session_count !== a.workspace.session_count) {
          return b.workspace.session_count - a.workspace.session_count;
        }
        return a.workspace.cwd.localeCompare(b.workspace.cwd);
      });

    const groupMs = performance.now() - groupStart;
    const totalMs = performance.now() - totalStart;
    logSearchDebug('search:results', {
      requestId,
      q: query,
      normalized: normalized.normalized,
      tokens: normalized.tokens,
      workspace,
      limit,
      resultSort,
      groupSort,
      workspaceFilter,
      orderBy,
      params,
      resultCount: results.length,
      groupCount: groups.length,
      results,
      groups,
      durationMs: Number(totalMs.toFixed(2)),
    });

    return {
      response: { groups, tokens: normalized.tokens },
      timings: { normalizeMs, queryMs, groupMs, totalMs },
    };
  } catch (error) {
    logSearchDebug('search:error', {
      requestId,
      q: query,
      normalized: normalized.normalized,
      tokens: normalized.tokens,
      workspace,
      limit,
      resultSort,
      groupSort,
      workspaceFilter,
      orderBy,
      params,
      error,
    });
    throw error;
  }
};

type ResolveSessionOptions = {
  id: string;
  workspace?: string | null;
  requestId?: string | null;
};

export const resolveSession = (database: Database.Database, options: ResolveSessionOptions) => {
  const { id, workspace, requestId } = options;
  const escaped = id.replace(/[\\%_]/g, '\\$&');
  const likePattern = `%${escaped}%`;
  const params: Array<string> = [id, id, likePattern];
  // ESCAPE must be a single character; JS string literal yields a single backslash in SQL.
  let whereClause = "session_id = ? OR path = ? OR path LIKE ? ESCAPE '\\'";
  if (workspace) {
    whereClause = `(${whereClause}) AND cwd = ?`;
    params.push(workspace);
  }
  logSearchDebug('resolve:request', {
    requestId,
    id,
    workspace,
    whereClause,
    params,
  });
  try {
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
      logSearchDebug('resolve:miss', { requestId, id, workspace });
      return null;
    }
    logDebug('resolve-session hit', { id, resolved: row.id });
    logSearchDebug('resolve:hit', { requestId, id, workspace, resolved: row.id });
    return { id: row.id };
  } catch (error) {
    logSearchDebug('resolve:error', { requestId, id, workspace, error });
    throw error;
  }
};

type SessionMatchesOptions = {
  session: string;
  query: string;
  requestId?: string | null;
};

export const sessionMatches = (database: Database.Database, options: SessionMatchesOptions): SessionMatchResult => {
  const { session, query, requestId } = options;
  const totalStart = performance.now();
  const normalizeStart = performance.now();
  const normalized = normalizeFtsQuery(query);
  const normalizeMs = performance.now() - normalizeStart;
  logSearchDebug('session-matches:request', {
    requestId,
    session,
    q: query,
    normalized: normalized.normalized,
    tokens: normalized.tokens,
    truncated: normalized.truncated,
  });
  if (!normalized.normalized) {
    const totalMs = performance.now() - totalStart;
    return {
      response: { session, tokens: normalized.tokens, turn_ids: [] },
      timings: { normalizeMs, queryMs: 0, totalMs },
    };
  }
  try {
    const queryStart = performance.now();
    const rows = database
      .prepare(
        `
          SELECT DISTINCT turn_id AS turn_id
          FROM messages_fts
          -- Keep match navigation aligned with search results by excluding preamble entries.
          WHERE messages_fts MATCH ? AND session_id = ? AND turn_id > 0
          ORDER BY turn_id ASC
        `,
      )
      .all(normalized.normalized, session) as Array<{ turn_id: number | null }>;
    const queryMs = performance.now() - queryStart;
    const turnIds = rows
      .map((row) => row.turn_id)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const totalMs = performance.now() - totalStart;
    logSearchDebug('session-matches:results', {
      requestId,
      session,
      q: query,
      normalized: normalized.normalized,
      tokens: normalized.tokens,
      turnCount: turnIds.length,
    });
    return {
      response: { session, tokens: normalized.tokens, turn_ids: turnIds },
      timings: { normalizeMs, queryMs, totalMs },
    };
  } catch (error) {
    logSearchDebug('session-matches:error', {
      requestId,
      session,
      q: query,
      normalized: normalized.normalized,
      tokens: normalized.tokens,
      error,
    });
    throw error;
  }
};
