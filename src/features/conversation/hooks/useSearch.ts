import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { resolveSession, searchSessions } from '../api';
import { logSearch } from '../debug';
import type { WorkspaceSearchGroup } from '../types';

interface UseSearchOptions {
  onError?: (message: string | null) => void;
  onLoadSession: (sessionId: string, turnId?: number) => Promise<void> | void;
  workspace?: string | null;
}

export const useSearch = ({ onError, onLoadSession, workspace }: UseSearchOptions) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchGroups, setSearchGroups] = useState<WorkspaceSearchGroup[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<number | null>(null);
  const latestRequestId = useRef(0);
  const latestQuery = useRef('');
  const requestCounter = useRef(0);

  const nextRequestId = useCallback((prefix: string) => {
    requestCounter.current += 1;
    return `${prefix}-${Date.now().toString(36)}-${requestCounter.current.toString(36)}`;
  }, []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    logSearch('input', { query: searchQuery, trimmedQuery, workspace });
    latestQuery.current = trimmedQuery;
    latestRequestId.current += 1;
    const requestId = latestRequestId.current;
    if (!trimmedQuery) {
      logSearch('clear', { requestId, reason: 'empty-query' });
      setSearchGroups([]);
      setSearchLoading(false);
      return;
    }
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
      logSearch('debounce:clear', { requestId, query: trimmedQuery });
    }
    const searchRequestId = nextRequestId('search');
    logSearch('debounce:start', { requestId, searchRequestId, query: trimmedQuery, delayMs: 350 });
    searchTimeout.current = window.setTimeout(async () => {
      logSearch('state:loading:set', { requestId, searchRequestId, query: trimmedQuery, value: true });
      setSearchLoading(true);
      logSearch('request:start', { requestId, searchRequestId, query: trimmedQuery, workspace });
      try {
        const results = await searchSessions(trimmedQuery, 40, workspace, searchRequestId);
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        setSearchGroups(results);
        logSearch('request:success', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          workspace,
          groupCount: results.length,
          results,
        });
        logSearch('state:groups:set', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          groupCount: results.length,
          resultCount: results.reduce((total, group) => total + group.results.length, 0),
        });
      } catch (error: any) {
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        logSearch('request:error', {
          requestId,
          searchRequestId,
          query: trimmedQuery,
          workspace,
          message: error?.message || 'Search failed.',
          error,
        });
        onError?.(error?.message || 'Search failed.');
      } finally {
        const isStale = requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery;
        if (isStale) {
          logSearch('request:stale', {
            requestId,
            searchRequestId,
            query: trimmedQuery,
            latestRequestId: latestRequestId.current,
            latestQuery: latestQuery.current,
          });
        }
        if (!isStale) {
          logSearch('state:loading:set', { requestId, searchRequestId, query: trimmedQuery, value: false });
          setSearchLoading(false);
          logSearch('request:complete', { requestId, searchRequestId, query: trimmedQuery });
        }
      }
    }, 350);

    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
        logSearch('debounce:cleanup', { requestId, query: trimmedQuery });
      }
    };
  }, [nextRequestId, onError, searchQuery, workspace]);

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
        await onLoadSession(resolved);
        setSearchQuery('');
        setSearchGroups([]);
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
    [nextRequestId, onError, onLoadSession, searchQuery, workspace],
  );

  const clearSearch = useCallback(() => {
    logSearch('clear', { reason: 'manual' });
    setSearchQuery('');
    setSearchGroups([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchGroups,
    searchLoading,
    handleSearchKeyDown,
    clearSearch,
  };
};
