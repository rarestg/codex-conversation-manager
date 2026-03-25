import type Database from 'better-sqlite3';
import type {
  SessionCatalogExactFacetKey,
  SessionCatalogFacetsResponse,
  SessionCatalogFacetValue,
  SessionCatalogQuery,
} from '../../shared/sessionCatalogTypes';
import { SESSION_CATALOG_UNKNOWN_VALUE } from '../../shared/sessionCatalogTypes';
import { buildAppliedSessionCatalogQuery, buildSessionCatalogScope, normalizeSessionCatalogQuery } from './queries';

const FACET_LABELS: Record<SessionCatalogExactFacetKey, string> = {
  workspaces: 'workspace',
  gitRepos: 'repo',
  gitBranches: 'branch',
};

const FACET_COLUMNS: Record<SessionCatalogExactFacetKey, string> = {
  workspaces: 'sessions.cwd',
  gitRepos: 'sessions.git_repo',
  gitBranches: 'sessions.git_branch',
};

const EMPTY_FACETS: Pick<SessionCatalogFacetsResponse, 'workspaces' | 'gitRepos' | 'gitBranches'> = {
  workspaces: [],
  gitRepos: [],
  gitBranches: [],
};

const getFacetLabel = (key: SessionCatalogExactFacetKey, value: string) =>
  value === SESSION_CATALOG_UNKNOWN_VALUE ? `Unknown ${FACET_LABELS[key]}` : value;

const getFacetBuckets = (
  database: Database.Database,
  normalized: ReturnType<typeof normalizeSessionCatalogQuery>,
  facetKey: SessionCatalogExactFacetKey,
): SessionCatalogFacetValue[] => {
  const scope = buildSessionCatalogScope(normalized, { excludeFacet: facetKey });
  const valueExpression = `NULLIF(TRIM(${FACET_COLUMNS[facetKey]}), '')`;
  const rows = database
    .prepare(
      `
        ${scope.withClause}
        SELECT
          ${valueExpression} AS value,
          COUNT(*) AS count
        FROM sessions
        ${scope.joinClause}
        ${scope.whereClause}
        GROUP BY ${valueExpression}
        ORDER BY
          CASE WHEN ${valueExpression} IS NULL THEN 1 ELSE 0 END ASC,
          count DESC,
          LOWER(${valueExpression}) ASC
      `,
    )
    .all(...scope.params) as Array<{ value?: string | null; count?: number | null }>;

  return rows.map((row) => {
    const value = row.value ?? SESSION_CATALOG_UNKNOWN_VALUE;
    return {
      value,
      label: getFacetLabel(facetKey, value),
      count: row.count ?? 0,
    };
  });
};

export const getSessionCatalogFacets = (
  database: Database.Database,
  query: SessionCatalogQuery,
): SessionCatalogFacetsResponse => {
  const normalized = normalizeSessionCatalogQuery(query);

  if (normalized.contentQuery && !normalized.normalizedContentQuery) {
    return {
      ...EMPTY_FACETS,
      appliedQuery: buildAppliedSessionCatalogQuery(normalized),
    };
  }

  return {
    workspaces: getFacetBuckets(database, normalized, 'workspaces'),
    gitRepos: getFacetBuckets(database, normalized, 'gitRepos'),
    gitBranches: getFacetBuckets(database, normalized, 'gitBranches'),
    appliedQuery: buildAppliedSessionCatalogQuery(normalized),
  };
};
