import { useCallback, useEffect, useState } from 'react';
import { clearIndex, fetchConfig, fetchSessions, reindexSessions, saveConfig } from '../api';
import type { SessionTree } from '../types';

interface UseSessionsOptions {
  onError?: (message: string | null) => void;
}

export const useSessions = ({ onError }: UseSessionsOptions = {}) => {
  const [sessionsTree, setSessionsTree] = useState<SessionTree | null>(null);
  const [sessionsRoot, setSessionsRoot] = useState('');
  const [sessionsRootSource, setSessionsRootSource] = useState<string>('');
  const [reindexing, setReindexing] = useState(false);
  const [clearingIndex, setClearingIndex] = useState(false);
  const [indexSummary, setIndexSummary] = useState('');

  const loadConfig = useCallback(async () => {
    try {
      const data = await fetchConfig();
      setSessionsRoot(data.value || '');
      setSessionsRootSource(data.source || '');
    } catch (error: any) {
      onError?.(error?.message || 'Failed to load config.');
    }
  }, [onError]);

  const loadSessions = useCallback(async () => {
    try {
      onError?.(null);
      const data = await fetchSessions();
      setSessionsTree(data);
    } catch (error: any) {
      onError?.(error?.message || 'Failed to load sessions.');
    }
  }, [onError]);

  useEffect(() => {
    loadConfig();
    loadSessions();
  }, [loadConfig, loadSessions]);

  const saveRoot = useCallback(async () => {
    try {
      onError?.(null);
      await saveConfig(sessionsRoot);
      setSessionsRootSource('config');
      await loadSessions();
      await loadConfig();
    } catch (error: any) {
      onError?.(error?.message || 'Failed to update config.');
    }
  }, [loadConfig, loadSessions, onError, sessionsRoot]);

  const reindex = useCallback(async () => {
    try {
      setReindexing(true);
      onError?.(null);
      const summary = await reindexSessions();
      setIndexSummary(
        `Scanned ${summary.scanned} files · Updated ${summary.updated} · Removed ${summary.removed} · ${summary.messageCount} messages`,
      );
      await loadSessions();
    } catch (error: any) {
      onError?.(error?.message || 'Reindex failed.');
    } finally {
      setReindexing(false);
    }
  }, [loadSessions, onError]);

  const rebuildIndex = useCallback(async () => {
    try {
      setClearingIndex(true);
      onError?.(null);
      const summary = await clearIndex();
      setIndexSummary(
        `Cleared index · Scanned ${summary.scanned} files · Updated ${summary.updated} · Removed ${summary.removed} · ${summary.messageCount} messages`,
      );
      await loadSessions();
    } catch (error: any) {
      onError?.(error?.message || 'Clear index failed.');
    } finally {
      setClearingIndex(false);
    }
  }, [loadSessions, onError]);

  return {
    sessionsTree,
    sessionsRoot,
    setSessionsRoot,
    sessionsRootSource,
    loadSessions,
    loadConfig,
    saveRoot,
    reindex,
    rebuildIndex,
    reindexing,
    clearingIndex,
    indexSummary,
  };
};
