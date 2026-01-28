import { type ClipboardEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { resolveSession, searchSessions } from '../api';
import { logSearch } from '../debug';
import type {
  LoadSessionOptions,
  SearchGroupSort,
  SearchResultSort,
  SearchStatus,
  WorkspaceSearchGroup,
} from '../types';

interface UseSearchOptions {
  onError?: (message: string | null) => void;
  onLoadSession: (sessionId: string, turnId?: number, options?: LoadSessionOptions) => Promise<void> | void;
  workspace?: string | null;
}

const UUID_EXACT_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const FTS_TOKEN_REGEX = /[\p{L}\p{N}\p{M}]+/gu;
const MAX_FTS_TOKENS = 32;
const MIN_LATIN_TOKEN_LENGTH = 3;
const MIN_NON_LATIN_TOKEN_LENGTH = 1;
const MIN_NUMERIC_TOKEN_LENGTH = 2;
const LATIN_SCRIPT_REGEX = /\p{Script=Latin}/u;
const NUMERIC_TOKEN_REGEX = /^\p{N}+$/u;

const getSearchTokens = (value: string) =>
  (value.trim().match(FTS_TOKEN_REGEX) ?? []).filter(Boolean).slice(0, MAX_FTS_TOKENS);

const isSearchableToken = (token: string) => {
  if (!token) return false;
  if (LATIN_SCRIPT_REGEX.test(token)) {
    return token.length >= MIN_LATIN_TOKEN_LENGTH;
  }
  if (NUMERIC_TOKEN_REGEX.test(token)) {
    return token.length >= MIN_NUMERIC_TOKEN_LENGTH;
  }
  return token.length >= MIN_NON_LATIN_TOKEN_LENGTH;
};

const hasSearchableToken = (value: string) => getSearchTokens(value).some(isSearchableToken);

export const useSearch = ({ onError, onLoadSession, workspace }: UseSearchOptions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGroups, setSearchGroups] = useState<WorkspaceSearchGroup[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultSort, setResultSort] = useState<SearchResultSort>('relevance');
  const [groupSort, setGroupSort] = useState<SearchGroupSort>('last_seen');
  const searchTimeout = useRef<number | null>(null);
  const latestRequestId = useRef(0);
  const latestQuery = useRef('');
  const requestCounter = useRef(0);
  const skipNextSearchRef = useRef<string | null>(null);
  const pendingPasteRequestId = useRef<number | null>(null);
  const statusRef = useRef<SearchStatus>('idle');
  const searchTooShort = Boolean(searchQuery.trim()) && !hasSearchableToken(searchQuery);

  const updateStatus = useCallback((next: SearchStatus, context?: Record<string, unknown>) => {
    const prev = statusRef.current;
    if (prev !== next) {
      logSearch('status:set', { from: prev, to: next, ...context });
      statusRef.current = next;
    }
    setSearchStatus(next);
  }, []);

  const clearSearch = useCallback(
    (reason = 'manual') => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
      }
      latestRequestId.current += 1;
      latestQuery.current = '';
      pendingPasteRequestId.current = null;
      skipNextSearchRef.current = null;
      setSearchQuery('');
      setSearchGroups([]);
      setSearchError(null);
      updateStatus('idle', { reason });
      logSearch('clear', { reason });
    },
    [updateStatus],
  );

  const nextRequestId = useCallback((prefix: string) => {
    requestCounter.current += 1;
    return `${prefix}-${Date.now().toString(36)}-${requestCounter.current.toString(36)}`;
  }, []);

  const executeSearch = useCallback(
    async ({
      trimmedQuery,
      requestId,
      searchRequestId,
      source,
    }: {
      trimmedQuery: string;
      requestId: number;
      searchRequestId: string;
      source: 'debounce' | 'paste-fallback';
    }) => {
      const isStaleStart = requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery;
      if (isStaleStart) {
        logSearch('request:stale:skip', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          latestRequestId: latestRequestId.current,
          latestQuery: latestQuery.current,
          source,
        });
        return;
      }
      updateStatus('loading', { requestId, searchRequestId, query: trimmedQuery, source });
      logSearch('request:start', {
        requestId,
        searchRequestId,
        query: trimmedQuery,
        workspace,
        resultSort,
        groupSort,
        source,
      });
      try {
        const results = await searchSessions(trimmedQuery, 40, workspace, searchRequestId, resultSort, groupSort);
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        setSearchGroups(results.groups);
        setSearchError(null);
        updateStatus('success', { requestId, searchRequestId, query: trimmedQuery, source });
        logSearch('request:success', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          workspace,
          resultSort,
          groupSort,
          groupCount: results.groups.length,
          results,
          source,
        });
        logSearch('state:groups:set', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          groupCount: results.groups.length,
          resultCount: results.groups.reduce((total, group) => total + group.results.length, 0),
          source,
        });
      } catch (error: any) {
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        const message = error?.message || 'Search failed.';
        setSearchError(message);
        updateStatus('error', { requestId, searchRequestId, query: trimmedQuery, source });
        logSearch('request:error', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          workspace,
          resultSort,
          groupSort,
          message,
          error,
          source,
        });
        onError?.(message);
      } finally {
        const isStale = requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery;
        if (isStale) {
          logSearch('request:stale', {
            requestId,
            searchRequestId,
            query: trimmedQuery,
            latestRequestId: latestRequestId.current,
            latestQuery: latestQuery.current,
            source,
          });
        }
        if (!isStale) {
          logSearch('request:complete', { requestId, searchRequestId, query: trimmedQuery, source });
        }
      }
    },
    [groupSort, onError, resultSort, updateStatus, workspace],
  );

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const isSearchable = hasSearchableToken(trimmedQuery);
    logSearch('input', { query: searchQuery, trimmedQuery, workspace, resultSort, groupSort });
    latestQuery.current = trimmedQuery;
    const nextRequestIdValue = pendingPasteRequestId.current ?? latestRequestId.current + 1;
    pendingPasteRequestId.current = null;
    latestRequestId.current = nextRequestIdValue;
    const requestId = latestRequestId.current;
    if (!trimmedQuery) {
      logSearch('clear', { requestId, reason: 'empty-query' });
      setSearchGroups([]);
      setSearchError(null);
      updateStatus('idle', { requestId, reason: 'empty-query' });
      return;
    }
    if (!isSearchable) {
      logSearch('clear', { requestId, reason: 'too-short' });
      setSearchGroups([]);
      setSearchError(null);
      updateStatus('idle', { requestId, reason: 'too-short' });
      return;
    }
    setSearchGroups([]);
    setSearchError(null);
    updateStatus('debouncing', { requestId, query: trimmedQuery });
    if (skipNextSearchRef.current === trimmedQuery) {
      skipNextSearchRef.current = null;
      logSearch('debounce:skip', { requestId, query: trimmedQuery, reason: 'paste-uuid' });
      updateStatus('debouncing', { requestId, query: trimmedQuery, reason: 'paste-uuid' });
      return;
    }
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
      logSearch('debounce:clear', { requestId, query: trimmedQuery });
    }
    const searchRequestId = nextRequestId('search');
    logSearch('debounce:start', { requestId, searchRequestId, query: trimmedQuery, delayMs: 350 });
    searchTimeout.current = window.setTimeout(async () => {
      await executeSearch({ trimmedQuery, requestId, searchRequestId, source: 'debounce' });
    }, 350);

    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
        logSearch('debounce:cleanup', { requestId, query: trimmedQuery });
      }
    };
  }, [executeSearch, groupSort, nextRequestId, resultSort, searchQuery, updateStatus, workspace]);

  const handleSearchKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      const query = searchQuery.trim();
      if (!query) return;
      event.preventDefault();
      const resolveRequestId = nextRequestId('resolve');
      logSearch('resolve:start', { resolveRequestId, query, workspace });
      try {
        const resolved = await resolveSession(query, workspace, resolveRequestId);
        if (!resolved) return;
        logSearch('resolve:found', { resolveRequestId, query, resolved, workspace });
        clearSearch('session-loaded');
        await onLoadSession(resolved);
        logSearch('resolve:clear', { resolveRequestId, reason: 'session-loaded' });
      } catch (error: any) {
        logSearch('resolve:error', {
          resolveRequestId,
          query,
          workspace,
          message: error?.message || 'Unable to resolve session.',
          error,
        });
        onError?.(error?.message || 'Unable to resolve session.');
      }
    },
    [clearSearch, nextRequestId, onError, onLoadSession, searchQuery, workspace],
  );

  const handleSearchPasteUuid = useCallback(
    async (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData?.getData('text')?.trim() ?? '';
      if (!pasted || !UUID_EXACT_REGEX.test(pasted)) return;
      event.preventDefault();
      logSearch('paste:uuid', { query: pasted, workspace });
      const requestId = latestRequestId.current + 1;
      latestRequestId.current = requestId;
      latestQuery.current = pasted;
      pendingPasteRequestId.current = requestId;
      skipNextSearchRef.current = pasted;
      setSearchQuery(pasted);
      setSearchGroups([]);
      setSearchError(null);
      updateStatus('debouncing', { query: pasted, reason: 'paste-uuid' });
      const resolveRequestId = nextRequestId('resolve');
      logSearch('resolve:start', { resolveRequestId, query: pasted, workspace, source: 'paste' });
      try {
        const resolved = await resolveSession(pasted, workspace, resolveRequestId);
        if (latestQuery.current !== pasted || latestRequestId.current !== requestId) {
          logSearch('resolve:stale', {
            resolveRequestId,
            query: pasted,
            workspace,
            source: 'paste',
            latestQuery: latestQuery.current,
            latestRequestId: latestRequestId.current,
            requestId,
          });
          return;
        }
        if (resolved) {
          logSearch('resolve:found', { resolveRequestId, query: pasted, resolved, workspace, source: 'paste' });
          clearSearch('session-loaded');
          await onLoadSession(resolved);
          logSearch('resolve:clear', { resolveRequestId, reason: 'session-loaded', source: 'paste' });
          return;
        }
        logSearch('resolve:miss', { resolveRequestId, query: pasted, workspace, source: 'paste' });
        if (latestQuery.current !== pasted || latestRequestId.current !== requestId) {
          logSearch('paste:search-skip', {
            resolveRequestId,
            query: pasted,
            reason: 'stale-query',
            latestQuery: latestQuery.current,
            latestRequestId: latestRequestId.current,
            requestId,
          });
          return;
        }
        const searchRequestId = nextRequestId('search');
        await executeSearch({
          trimmedQuery: pasted,
          requestId,
          searchRequestId,
          source: 'paste-fallback',
        });
      } catch (error: any) {
        const message = error?.message || 'Unable to resolve session.';
        if (latestQuery.current !== pasted || latestRequestId.current !== requestId) {
          logSearch('resolve:error:stale', {
            resolveRequestId,
            query: pasted,
            workspace,
            message,
            error,
            source: 'paste',
            latestQuery: latestQuery.current,
            latestRequestId: latestRequestId.current,
            requestId,
          });
          return;
        }
        setSearchError(message);
        updateStatus('error', { query: pasted, reason: 'resolve-error', source: 'paste' });
        logSearch('resolve:error', {
          resolveRequestId,
          query: pasted,
          workspace,
          message,
          error,
          source: 'paste',
        });
        onError?.(message);
      }
    },
    [clearSearch, executeSearch, nextRequestId, onError, onLoadSession, updateStatus, workspace],
  );

  return {
    searchQuery,
    setSearchQuery,
    clearSearch,
    searchTooShort,
    searchGroups,
    searchStatus,
    searchError,
    resultSort,
    setResultSort,
    groupSort,
    setGroupSort,
    handleSearchKeyDown,
    handleSearchPasteUuid,
  };
};
