export type SessionCatalogSort = 'recent' | 'oldest' | 'turns_desc' | 'messages_desc' | 'duration_desc';
export type SessionCatalogExactFacetKey = 'workspaces' | 'gitRepos' | 'gitBranches';
export const SESSION_CATALOG_UNKNOWN_VALUE = '__codex_unknown_facet__';

export interface SessionCatalogQuery {
  contentQuery?: string;
  locatorQuery?: string;
  workspace?: string | null;
  workspaces?: string[];
  gitRepos?: string[];
  gitBranches?: string[];
  sort?: SessionCatalogSort;
  page?: number;
  pageSize?: number;
}

export interface SessionCatalogRow {
  id: string;
  path: string;
  filename: string;
  sessionId: string | null;
  preview: string | null;
  timestamp: string | null;
  cwd: string | null;
  gitBranch: string | null;
  gitRepo: string | null;
  gitCommitHash: string | null;
  startedAt: string | null;
  endedAt: string | null;
  turnCount: number | null;
  messageCount: number | null;
  thoughtCount: number | null;
  toolCallCount: number | null;
  metaCount: number | null;
  tokenCountCount: number | null;
  activeDurationMs: number | null;
  matchCount: number | null;
  firstMatchTurnId: number | null;
  snippet: string | null;
}

export interface SessionCatalogAppliedQuery {
  contentQuery: string | null;
  locatorQuery: string | null;
  workspaces: string[];
  gitRepos: string[];
  gitBranches: string[];
  sort: SessionCatalogSort;
  page: number;
  pageSize: number;
}

export interface SessionCatalogFacetValue {
  value: string;
  label: string;
  count: number;
}

export interface SessionCatalogResponse {
  rows: SessionCatalogRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  appliedQuery: SessionCatalogAppliedQuery;
  contentTokens?: string[];
}

export interface SessionCatalogFacetsResponse {
  workspaces: SessionCatalogFacetValue[];
  gitRepos: SessionCatalogFacetValue[];
  gitBranches: SessionCatalogFacetValue[];
  appliedQuery: SessionCatalogAppliedQuery;
}
