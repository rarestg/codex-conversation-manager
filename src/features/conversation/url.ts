import type { HistoryMode } from './types';

export const SESSION_ID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
export const SESSION_ID_PREFIX_REGEX = /\b(?:sess(?:ion)?[_-])[a-zA-Z0-9_-]{6,}\b/;

export const normalizeSessionId = (value: string) => {
  const trimmed = value.trim();
  const uuidMatch = trimmed.match(SESSION_ID_REGEX);
  if (uuidMatch) return uuidMatch[0];
  const prefixMatch = trimmed.match(SESSION_ID_PREFIX_REGEX);
  if (prefixMatch) return prefixMatch[0];
  return trimmed;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
};

export const getSessionParamsFromLocation = () => {
  const search = window.location.search;
  if (!search || search.length <= 1) return { sessionId: null as string | null, turnId: null as number | null };
  const pairs = search.slice(1).split('&');
  let sessionId: string | null = null;
  let turnId: number | null = null;
  for (const pair of pairs) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);
    if (rawKey === 'session') {
      sessionId = safeDecode(rawValue);
    } else if (rawKey === 'turn') {
      const decoded = safeDecode(rawValue);
      const numeric = Number(decoded);
      if (Number.isFinite(numeric)) {
        turnId = numeric;
      }
    }
  }
  return { sessionId, turnId };
};

export const buildSessionUrl = (sessionId: string, turnId?: number | null) => {
  const encodedSession = encodeURIComponent(sessionId);
  const queryParts = [`session=${encodedSession}`];
  if (typeof turnId === 'number' && Number.isFinite(turnId)) {
    queryParts.push(`turn=${encodeURIComponent(String(turnId))}`);
  }
  const query = queryParts.length ? `?${queryParts.join('&')}` : '';
  const hash = window.location.hash || '';
  return `${window.location.pathname}${query}${hash}`;
};

export const updateSessionUrl = (sessionId: string, turnId?: number | null, mode: HistoryMode = 'push') => {
  const nextUrl = buildSessionUrl(sessionId, turnId);
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
  if (nextUrl === currentUrl && mode === 'push') {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  window.history.pushState(null, '', nextUrl);
};
