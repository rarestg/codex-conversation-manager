import { useCallback, useEffect, useState } from 'react';
import { fetchWorkspaces } from '../api';
import type { WorkspaceSummary } from '../types';

interface UseWorkspacesOptions {
  onError?: (message: string | null) => void;
}

export const useWorkspaces = ({ onError }: UseWorkspacesOptions = {}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [sort, setSort] = useState<'last_seen' | 'session_count'>('last_seen');
  const [loading, setLoading] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      onError?.(null);
      const data = await fetchWorkspaces(sort);
      setWorkspaces(data);
    } catch (error: any) {
      onError?.(error?.message || 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }, [onError, sort]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return {
    workspaces,
    loading,
    sort,
    setSort,
    loadWorkspaces,
  };
};
