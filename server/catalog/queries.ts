import path from 'node:path';
import type Database from 'better-sqlite3';
import type {
  SessionCatalogAppliedQuery,
  SessionCatalogExactFacetKey,
  SessionCatalogQuery,
  SessionCatalogResponse,
  SessionCatalogRow,
  SessionCatalogSort,
} from '../../shared/sessionCatalogTypes';
import { SESSION_CATALOG_UNKNOWN_VALUE } from '../../shared/sessionCatalogTypes';
import { buildSanitizedGitRepoSql, sanitizeGitRepo } from '../gitRepo';
import { normalizeFtsQuery } from '../search/normalize';
import { buildLocatorSql } from './locator';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const EXACT_FACET_COLUMNS: Record<SessionCatalogExactFacetKey, string> = {
  workspaces: 'sessions.cwd',
  gitRepos: buildSanitizedGitRepoSql('sessions.git_repo'),
  gitBranches: 'sessions.git_branch',
};

const EXACT_FACET_KEYS = Object.keys(EXACT_FACET_COLUMNS) as SessionCatalogExactFacetKey[];

export interface NormalizedSessionCatalogQuery extends SessionCatalogAppliedQuery {
  normalizedContentQuery: string | null;
  contentTokens: string[];
}

interface SessionCatalogScope {
  withClause: string;
  joinClause: string;
  whereClause: string;
  params: Array<string | number>;
  orderTerms: string[];
  orderParams: Array<string | number>;
}

const normalizeText = (value?: string | null) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeTextArray = (values: Array<string | null | undefined>, transform?: (value: string) => string | null) => {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const rawText = normalizeText(value);
    const text = rawText ? normalizeText(transform ? transform(rawText) : rawText) : null;
    if (!text) continue;
    if (text === SESSION_CATALOG_UNKNOWN_VALUE) {
      if (!seen.has(SESSION_CATALOG_UNKNOWN_VALUE)) {
        seen.add(SESSION_CATALOG_UNKNOWN_VALUE);
        normalized.push(SESSION_CATALOG_UNKNOWN_VALUE);
      }
      continue;
    }
    if (seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
};

const normalizePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
};

export const buildAppliedSessionCatalogQuery = (
  normalized: NormalizedSessionCatalogQuery,
  overrides?: Partial<Pick<SessionCatalogAppliedQuery, 'page' | 'pageSize'>>,
): SessionCatalogAppliedQuery => ({
  contentQuery: normalized.contentQuery,
  locatorQuery: normalized.locatorQuery,
  workspaces: [...normalized.workspaces],
  gitRepos: [...normalized.gitRepos],
  gitBranches: [...normalized.gitBranches],
  sort: normalized.sort,
  page: overrides?.page ?? normalized.page,
  pageSize: overrides?.pageSize ?? normalized.pageSize,
});

export const normalizeSessionCatalogQuery = (query: SessionCatalogQuery): NormalizedSessionCatalogQuery => {
  const contentQuery = normalizeText(query.contentQuery);
  const locatorQuery = normalizeText(query.locatorQuery);
  const workspaces = normalizeTextArray([...(query.workspaces ?? []), query.workspace]);
  const gitRepos = normalizeTextArray(query.gitRepos ?? [], sanitizeGitRepo);
  const gitBranches = normalizeTextArray(query.gitBranches ?? []);
  const sort: SessionCatalogSort =
    query.sort === 'oldest' ||
    query.sort === 'turns_desc' ||
    query.sort === 'messages_desc' ||
    query.sort === 'duration_desc'
      ? query.sort
      : 'recent';
  const page = normalizePositiveInt(query.page, DEFAULT_PAGE);
  const requestedPageSize = normalizePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  const normalizedContent = contentQuery ? normalizeFtsQuery(contentQuery) : null;

  return {
    contentQuery,
    locatorQuery,
    workspaces,
    gitRepos,
    gitBranches,
    sort,
    page,
    pageSize,
    normalizedContentQuery: normalizedContent?.normalized ?? null,
    contentTokens: normalizedContent?.tokens ?? [],
  };
};

const buildSortTerms = (sort: SessionCatalogSort) => {
  switch (sort) {
    case 'oldest':
      return ['CASE WHEN sessions.timestamp IS NULL THEN 1 ELSE 0 END', 'sessions.timestamp ASC'];
    case 'turns_desc':
      return [
        'CASE WHEN sessions.turn_count IS NULL THEN 1 ELSE 0 END',
        'sessions.turn_count DESC',
        'CASE WHEN sessions.timestamp IS NULL THEN 1 ELSE 0 END',
        'sessions.timestamp DESC',
      ];
    case 'messages_desc':
      return [
        'CASE WHEN sessions.message_count IS NULL THEN 1 ELSE 0 END',
        'sessions.message_count DESC',
        'CASE WHEN sessions.timestamp IS NULL THEN 1 ELSE 0 END',
        'sessions.timestamp DESC',
      ];
    case 'duration_desc':
      return [
        'CASE WHEN sessions.active_duration_ms IS NULL THEN 1 ELSE 0 END',
        'sessions.active_duration_ms DESC',
        'CASE WHEN sessions.timestamp IS NULL THEN 1 ELSE 0 END',
        'sessions.timestamp DESC',
      ];
    default:
      return ['CASE WHEN sessions.timestamp IS NULL THEN 1 ELSE 0 END', 'sessions.timestamp DESC'];
  }
};

const mapRow = (row: {
  id: string;
  path: string;
  session_id?: string | null;
  preview?: string | null;
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
  match_count?: number | null;
  first_match_turn_id?: number | null;
  snippet?: string | null;
}): SessionCatalogRow => ({
  id: row.id,
  path: row.path,
  filename: path.basename(row.path || row.id),
  sessionId: row.session_id ?? null,
  preview: row.preview ?? null,
  timestamp: row.timestamp ?? null,
  cwd: row.cwd ?? null,
  gitBranch: row.git_branch ?? null,
  gitRepo: sanitizeGitRepo(row.git_repo) ?? null,
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
  matchCount: row.match_count ?? null,
  firstMatchTurnId: row.first_match_turn_id ?? null,
  snippet: row.snippet ?? null,
});

const appendExactFacetFilters = (
  normalized: NormalizedSessionCatalogQuery,
  whereParts: string[],
  params: Array<string | number>,
  excludeFacet?: SessionCatalogExactFacetKey,
) => {
  for (const facetKey of EXACT_FACET_KEYS) {
    if (excludeFacet === facetKey) continue;
    const values = normalized[facetKey];
    if (!values.length) continue;
    const column = EXACT_FACET_COLUMNS[facetKey];
    const knownValues = values.filter((value) => value !== SESSION_CATALOG_UNKNOWN_VALUE);
    const includeUnknown = values.includes(SESSION_CATALOG_UNKNOWN_VALUE);
    const predicates: string[] = [];

    if (knownValues.length > 0) {
      const placeholders = knownValues.map(() => '?').join(', ');
      predicates.push(`${column} IN (${placeholders})`);
      params.push(...knownValues);
    }

    if (includeUnknown) {
      predicates.push(`NULLIF(TRIM(${column}), '') IS NULL`);
    }

    if (predicates.length === 1) {
      whereParts.push(predicates[0]);
    } else if (predicates.length > 1) {
      whereParts.push(`(${predicates.join(' OR ')})`);
    }
  }
};

export const buildSessionCatalogScope = (
  normalized: NormalizedSessionCatalogQuery,
  options?: { excludeFacet?: SessionCatalogExactFacetKey },
): SessionCatalogScope => {
  const withClauses: string[] = [];
  const joins: string[] = [];
  const whereParts: string[] = [];
  const params: Array<string | number> = [];
  const orderTerms: string[] = [];
  const orderParams: Array<string | number> = [];

  if (normalized.normalizedContentQuery) {
    withClauses.push(`
      matches AS (
        SELECT
          messages.id AS message_id,
          messages_fts.session_id AS session_id,
          messages_fts.turn_id AS turn_id,
          bm25(messages_fts) AS score,
          snippet(messages_fts, 0, '[[', ']]', '…', 18) AS snippet
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.id
        WHERE messages_fts MATCH ? AND messages_fts.turn_id > 0
      )
    `);
    withClauses.push(`
      ranked AS (
        SELECT
          session_id,
          turn_id,
          score,
          snippet,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY score ASC, turn_id ASC, message_id ASC) AS rn
        FROM matches
      )
    `);
    withClauses.push(`
      aggregated AS (
        SELECT
          session_id,
          COUNT(*) AS match_count,
          COALESCE(
            MIN(CASE WHEN rn = 1 AND turn_id > 0 THEN turn_id END),
            MIN(CASE WHEN turn_id > 0 THEN turn_id END)
          ) AS first_match_turn_id,
          MIN(CASE WHEN rn = 1 THEN snippet END) AS snippet
        FROM ranked
        GROUP BY session_id
      )
    `);
    params.push(normalized.normalizedContentQuery);
    joins.push('JOIN aggregated ON aggregated.session_id = sessions.id');
  }

  if (normalized.locatorQuery) {
    const locator = buildLocatorSql('sessions', normalized.locatorQuery);
    whereParts.push(locator.whereClause);
    params.push(...locator.whereParams);
    orderTerms.push(locator.orderClause);
    orderParams.push(...locator.orderParams);
  }

  appendExactFacetFilters(normalized, whereParts, params, options?.excludeFacet);

  return {
    withClause: withClauses.length ? `WITH ${withClauses.join(',\n')}` : '',
    joinClause: joins.length ? `\n${joins.join('\n')}` : '',
    whereClause: whereParts.length ? `\nWHERE ${whereParts.join(' AND ')}` : '',
    params,
    orderTerms,
    orderParams,
  };
};

export const getSessionCatalog = (database: Database.Database, query: SessionCatalogQuery): SessionCatalogResponse => {
  const normalized = normalizeSessionCatalogQuery(query);

  if (normalized.contentQuery && !normalized.normalizedContentQuery) {
    return {
      rows: [],
      totalRows: 0,
      page: normalized.page,
      pageSize: normalized.pageSize,
      totalPages: 0,
      appliedQuery: buildAppliedSessionCatalogQuery(normalized),
      contentTokens: normalized.contentTokens,
    };
  }

  const scope = buildSessionCatalogScope(normalized);
  const totalRowResult = database
    .prepare(
      `
        ${scope.withClause}
        SELECT COUNT(*) AS total_rows
        FROM sessions
        ${scope.joinClause}
        ${scope.whereClause}
      `,
    )
    .get(...scope.params) as { total_rows?: number } | undefined;

  const totalRows = totalRowResult?.total_rows ?? 0;
  const totalPages = totalRows > 0 ? Math.ceil(totalRows / normalized.pageSize) : 0;
  const appliedPage = totalPages > 0 ? Math.min(normalized.page, totalPages) : DEFAULT_PAGE;
  const appliedQuery = buildAppliedSessionCatalogQuery(normalized, { page: appliedPage });
  const offset = (appliedPage - 1) * normalized.pageSize;
  const orderTerms = [...scope.orderTerms, ...buildSortTerms(normalized.sort), 'sessions.id ASC'];

  const rows = database
    .prepare(
      `
        ${scope.withClause}
        SELECT
          sessions.id AS id,
          sessions.path AS path,
          sessions.session_id AS session_id,
          sessions.first_user_message AS preview,
          sessions.timestamp AS timestamp,
          sessions.cwd AS cwd,
          sessions.git_branch AS git_branch,
          ${buildSanitizedGitRepoSql('sessions.git_repo')} AS git_repo,
          sessions.git_commit_hash AS git_commit_hash,
          sessions.started_at AS started_at,
          sessions.ended_at AS ended_at,
          sessions.turn_count AS turn_count,
          sessions.message_count AS message_count,
          sessions.thought_count AS thought_count,
          sessions.tool_call_count AS tool_call_count,
          sessions.meta_count AS meta_count,
          sessions.token_count_count AS token_count_count,
          sessions.active_duration_ms AS active_duration_ms,
          ${normalized.normalizedContentQuery ? 'aggregated.match_count' : 'NULL'} AS match_count,
          ${normalized.normalizedContentQuery ? 'aggregated.first_match_turn_id' : 'NULL'} AS first_match_turn_id,
          ${normalized.normalizedContentQuery ? 'aggregated.snippet' : 'NULL'} AS snippet
        FROM sessions
        ${scope.joinClause}
        ${scope.whereClause}
        ORDER BY ${orderTerms.join(', ')}
        LIMIT ? OFFSET ?
      `,
    )
    .all(...scope.params, ...scope.orderParams, normalized.pageSize, offset) as Array<Parameters<typeof mapRow>[0]>;

  return {
    rows: rows.map(mapRow),
    totalRows,
    page: appliedPage,
    pageSize: normalized.pageSize,
    totalPages,
    appliedQuery,
    ...(normalized.contentQuery ? { contentTokens: normalized.contentTokens } : {}),
  };
};
