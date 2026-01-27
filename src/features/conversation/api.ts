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
    if (res.status === 404) return null;
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
