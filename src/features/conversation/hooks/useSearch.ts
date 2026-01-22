import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { resolveSession, searchSessions } from '../api';
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

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    latestQuery.current = trimmedQuery;
    latestRequestId.current += 1;
    const requestId = latestRequestId.current;
    if (!trimmedQuery) {
      setSearchGroups([]);
      setSearchLoading(false);
      return;
    }
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchSessions(trimmedQuery, 40, workspace);
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        setSearchGroups(results);
      } catch (error: any) {
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return;
        onError?.(error?.message || 'Search failed.');
      } finally {
        const isStale = requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery;
        if (!isStale) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current);
      }
    };
  }, [onError, searchQuery, workspace]);

  const handleSearchKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      const query = searchQuery.trim();
      if (!query) return;
      event.preventDefault();
      try {
        const resolved = await resolveSession(query);
        if (!resolved) return;
        await onLoadSession(resolved);
        setSearchQuery('');
        setSearchGroups([]);
      } catch (error: any) {
        onError?.(error?.message || 'Unable to resolve session.');
      }
    },
    [onError, onLoadSession, searchQuery],
  );

  const clearSearch = useCallback(() => {
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
