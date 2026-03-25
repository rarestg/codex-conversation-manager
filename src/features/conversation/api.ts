import type {
  SessionCatalogFacetsResponse,
  SessionCatalogQuery,
  SessionCatalogResponse,
} from '../../../shared/sessionCatalogTypes';
import type { SessionDetailResponse } from '../../../shared/sessionDetailTypes';
import type {
  IndexSummary,
  SearchGroupSort,
  SearchResponse,
  SearchResultSort,
  SessionMatchesResponse,
  SessionTree,
  WorkspaceSummary,
} from './types';

const parseError = async (res: Response, fallback: string): Promise<never> => {
  let message = fallback;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch (_error) {
    // ignore json parse failures
  }
  const error = new Error(message) as Error & { status?: number };
  error.status = res.status;
  throw error;
};

export const fetchConfig = async () => {
  const res = await fetch('/api/config');
  if (!res.ok) {
    throw new Error('Unable to load config.');
  }
  return (await res.json()) as { value?: string; source?: string };
};

export const fetchSessions = async (workspace?: string | null) => {
  const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : '';
  const res = await fetch(`/api/sessions${query}`);
  if (!res.ok) {
    await parseError(res, 'Unable to load sessions.');
  }
  return (await res.json()) as SessionTree;
};

export const fetchSession = async (sessionId: string) => {
  const res = await fetch(`/api/session?path=${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    await parseError(res, 'Unable to load session file.');
  }
  return await res.text();
};

export const fetchSessionDetail = async (sessionId: string, options?: { signal?: AbortSignal }) => {
  const res = await fetch(`/api/session-detail?id=${encodeURIComponent(sessionId)}`, {
    signal: options?.signal,
  });
  if (!res.ok) {
    await parseError(res, 'Unable to load session.');
  }
  return (await res.json()) as SessionDetailResponse;
};

const appendExactFilters = (params: URLSearchParams, query: SessionCatalogQuery) => {
  // Preserve the legacy workspace alias by mapping it into the repeated
  // workspaces params, while still avoiding sending both workspace and
  // workspaces to the catalog endpoints at the same time.
  const workspaces = [...(query.workspaces ?? []), query.workspace]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const workspace of workspaces) {
    params.append('workspaces', workspace);
  }
  for (const gitRepo of query.gitRepos ?? []) {
    params.append('gitRepos', gitRepo);
  }
  for (const gitBranch of query.gitBranches ?? []) {
    params.append('gitBranches', gitBranch);
  }
};

export const fetchSessionCatalog = async (query: SessionCatalogQuery = {}, options?: { signal?: AbortSignal }) => {
  const params = new URLSearchParams();
  const contentQuery = query.contentQuery?.trim();
  const locatorQuery = query.locatorQuery?.trim();
  if (contentQuery) {
    params.set('contentQuery', contentQuery);
  }
  if (locatorQuery) {
    params.set('locatorQuery', locatorQuery);
  }
  appendExactFilters(params, query);
  if (query.sort) {
    params.set('sort', query.sort);
  }
  if (query.page) {
    params.set('page', String(query.page));
  }
  if (query.pageSize) {
    params.set('pageSize', String(query.pageSize));
  }
  const queryString = params.toString();
  const res = await fetch(queryString ? `/api/session-catalog?${queryString}` : '/api/session-catalog', {
    signal: options?.signal,
  });
  if (!res.ok) {
    await parseError(res, 'Unable to load session catalog.');
  }
  return (await res.json()) as SessionCatalogResponse;
};

export const fetchSessionCatalogFacets = async (
  query: SessionCatalogQuery = {},
  options?: { signal?: AbortSignal },
) => {
  const params = new URLSearchParams();
  const contentQuery = query.contentQuery?.trim();
  const locatorQuery = query.locatorQuery?.trim();
  if (contentQuery) {
    params.set('contentQuery', contentQuery);
  }
  if (locatorQuery) {
    params.set('locatorQuery', locatorQuery);
  }
  appendExactFilters(params, query);
  const queryString = params.toString();
  const res = await fetch(queryString ? `/api/session-catalog-facets?${queryString}` : '/api/session-catalog-facets', {
    signal: options?.signal,
  });
  if (!res.ok) {
    await parseError(res, 'Unable to load catalog filters.');
  }
  return (await res.json()) as SessionCatalogFacetsResponse;
};

export const searchSessions = async (
  query: string,
  limit = 40,
  workspace?: string | null,
  requestId?: string | null,
  resultSort: SearchResultSort = 'relevance',
  groupSort: SearchGroupSort = 'last_seen',
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (workspace) {
    params.set('workspace', workspace);
  }
  if (requestId) {
    params.set('requestId', requestId);
  }
  params.set('resultSort', resultSort);
  params.set('groupSort', groupSort);
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) {
    await parseError(res, 'Search failed.');
  }
  const data = (await res.json()) as SearchResponse | null;
  return {
    groups: data?.groups ?? [],
    tokens: data?.tokens ?? [],
    requestId: data?.requestId,
  };
};

export const fetchWorkspaces = async (sort: 'last_seen' | 'session_count' = 'last_seen') => {
  const res = await fetch(`/api/workspaces?sort=${encodeURIComponent(sort)}`);
  if (!res.ok) {
    await parseError(res, 'Unable to load workspaces.');
  }
  const data = await res.json();
  return (data?.workspaces || []) as WorkspaceSummary[];
};

export const saveConfig = async (sessionsRoot: string) => {
  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionsRoot }),
  });
  if (!res.ok) {
    await parseError(res, 'Unable to update config.');
  }
  const data = await res.json();
  return data as { value?: string; source?: string };
};

export const reindexSessions = async () => {
  const res = await fetch('/api/reindex', { method: 'POST' });
  if (!res.ok) {
    await parseError(res, 'Reindex failed.');
  }
  const data = await res.json();
  return data.summary as IndexSummary;
};

export const clearIndex = async () => {
  const res = await fetch('/api/clear-index', { method: 'POST' });
  if (!res.ok) {
    await parseError(res, 'Clear index failed.');
  }
  const data = await res.json();
  return data.summary as IndexSummary;
};

export const resolveSession = async (query: string, workspace?: string | null, requestId?: string | null) => {
  const params = new URLSearchParams({ id: query });
  if (workspace) {
    params.set('workspace', workspace);
  }
  if (requestId) {
    params.set('requestId', requestId);
  }
  const res = await fetch(`/api/resolve-session?${params.toString()}`);
  if (!res.ok) {
    if (res.status === 404) {
      let message = 'Unable to resolve session.';
      try {
        const data = await res.json();
        if (data?.error === 'Session not found.') {
          return null;
        }
        if (data?.error) {
          message = data.error;
        }
      } catch (_error) {
        // ignore json parse failures
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    await parseError(res, 'Unable to resolve session.');
  }
  const data = await res.json();
  return data?.id ? (data.id as string) : null;
};

export const fetchSessionMatches = async (sessionId: string, query: string, requestId?: string | null) => {
  const params = new URLSearchParams({ session: sessionId, q: query });
  if (requestId) {
    params.set('requestId', requestId);
  }
  const res = await fetch(`/api/session-matches?${params.toString()}`);
  if (!res.ok) {
    await parseError(res, 'Unable to load session matches.');
  }
  const data = (await res.json()) as SessionMatchesResponse;
  return {
    session: data?.session ?? sessionId,
    tokens: data?.tokens ?? [],
    turn_ids: data?.turn_ids ?? [],
    requestId: data?.requestId,
  } as SessionMatchesResponse;
};
