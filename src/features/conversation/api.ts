import type { IndexSummary, SearchResult, SessionTree } from './types';

const parseError = async (res: Response, fallback: string): Promise<never> => {
  let message = fallback;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch (_error) {
    // ignore json parse failures
  }
  throw new Error(message);
};

export const fetchConfig = async () => {
  const res = await fetch('/api/config');
  if (!res.ok) {
    throw new Error('Unable to load config.');
  }
  return (await res.json()) as { value?: string; source?: string };
};

export const fetchSessions = async () => {
  const res = await fetch('/api/sessions');
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

export const searchSessions = async (query: string, limit = 40) => {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) {
    await parseError(res, 'Search failed.');
  }
  const data = await res.json();
  return (data?.results || []) as SearchResult[];
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

export const resolveSession = async (query: string) => {
  const res = await fetch(`/api/resolve-session?id=${encodeURIComponent(query)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    await parseError(res, 'Unable to resolve session.');
  }
  const data = await res.json();
  return data?.id ? (data.id as string) : null;
};
