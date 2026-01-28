import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SessionMetrics } from '../../../../shared/sessionMetrics';
import { fetchSession } from '../api';
import { logTurnNav } from '../debug';
import { extractSessionIdFromPath, parseJsonl } from '../parsing';
import type {
  JumpToTurnOptions,
  LoadSessionOptions,
  SessionDetails,
  SessionFileEntry,
  SessionTree,
  Turn,
} from '../types';
import { getSessionParamsFromLocation, updateSessionUrl } from '../url';

interface UseSessionOptions {
  sessionsTree: SessionTree | null;
  onError?: (message: string | null) => void;
}

interface ParsedMeta {
  preview?: string;
  startedAt?: string;
  endedAt?: string;
  turnCount?: number;
  activeDurationMs?: number | null;
  filename?: string;
}

export const useSession = ({ sessionsTree, onError }: UseSessionOptions) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null);
  const [parsedMeta, setParsedMeta] = useState<ParsedMeta | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({});
  const [loadingSession, setLoadingSession] = useState(false);
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null);

  const buildParsedMeta = useCallback((sessionId: string, metrics: SessionMetrics) => {
    const filename = sessionId.split('/').pop() || sessionId;
    return {
      preview: metrics.firstUserMessage ?? undefined,
      startedAt: metrics.startedAt ?? undefined,
      endedAt: metrics.endedAt ?? undefined,
      turnCount: metrics.turnCount ?? undefined,
      activeDurationMs: metrics.activeDurationMs ?? null,
      filename,
    };
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionId(null);
    setActiveSearchQuery(null);
    setParsedMeta(null);
    setTurns([]);
    setParseErrors([]);
    setSessionDetails({});
    setScrollToTurnId(null);
    setLoadingSession(false);
  }, []);

  const findSessionById = useCallback(
    (sessionId: string) => {
      if (!sessionsTree) return null;
      for (const year of sessionsTree.years) {
        for (const month of year.months) {
          for (const day of month.days) {
            const file = day.files.find((entry) => entry.id === sessionId);
            if (file) return file;
          }
        }
      }
      return null;
    },
    [sessionsTree],
  );

  const loadSession = useCallback(
    async (sessionId: string, turnId?: number, options?: LoadSessionOptions) => {
      const historyMode = options?.historyMode ?? 'push';
      const searchQuery = options?.searchQuery ?? null;
      updateSessionUrl(sessionId, turnId ?? null, historyMode, searchQuery);
      setActiveSearchQuery(searchQuery);
      try {
        setLoadingSession(true);
        onError?.(null);
        const raw = await fetchSession(sessionId);
        const parsed = parseJsonl(raw);
        setTurns(parsed.turns);
        setParseErrors(parsed.errors);
        const derivedMeta = buildParsedMeta(sessionId, parsed.metrics);
        const indexed = findSessionById(sessionId);
        const metaFilename = indexed?.filename ?? derivedMeta.filename ?? sessionId;
        const fallbackSessionId = extractSessionIdFromPath(metaFilename);
        const resolvedSessionId = parsed.sessionInfo.sessionId || fallbackSessionId || undefined;
        const resolvedCwd = parsed.sessionInfo.cwd || indexed?.cwd || undefined;
        setSessionDetails({ sessionId: resolvedSessionId, cwd: resolvedCwd });
        setActiveSessionId(sessionId);
        setParsedMeta(derivedMeta);
        setScrollToTurnId(turnId ?? null);
      } catch (error: any) {
        const status = error?.status;
        if (status === 404 || status === 400) {
          onError?.(error?.message || 'Session file not found. Please reindex.');
        } else {
          onError?.(error?.message || 'Failed to load session.');
        }
      } finally {
        setLoadingSession(false);
      }
    },
    [buildParsedMeta, findSessionById, onError],
  );

  const jumpToTurn = useCallback(
    (turnId: number | null, options?: JumpToTurnOptions) => {
      if (!activeSessionId) return;
      const historyMode = options?.historyMode ?? 'replace';
      logTurnNav('jump', {
        sessionId: activeSessionId,
        turnId,
        historyMode,
        scroll: options?.scroll !== false,
      });
      updateSessionUrl(activeSessionId, turnId ?? null, historyMode, activeSearchQuery);
      if (typeof turnId === 'number' && Number.isFinite(turnId) && options?.scroll !== false) {
        setScrollToTurnId(turnId);
      }
    },
    [activeSearchQuery, activeSessionId],
  );

  const setSessionSearchQuery = useCallback(
    (searchQuery: string | null, historyMode: JumpToTurnOptions['historyMode'] = 'replace') => {
      if (!activeSessionId) return;
      const { turnId } = getSessionParamsFromLocation();
      updateSessionUrl(activeSessionId, turnId ?? null, historyMode, searchQuery);
      setActiveSearchQuery(searchQuery);
    },
    [activeSessionId],
  );

  const activeSession = useMemo<SessionFileEntry | null>(() => {
    if (!activeSessionId) return null;
    const indexed = findSessionById(activeSessionId);
    const extractedId = extractSessionIdFromPath(activeSessionId);
    const filename = indexed?.filename || parsedMeta?.filename || activeSessionId;
    const fallback: SessionFileEntry = {
      id: activeSessionId,
      filename,
      preview: parsedMeta?.preview ?? null,
      timestamp: parsedMeta?.startedAt ?? null,
      startedAt: parsedMeta?.startedAt ?? null,
      endedAt: parsedMeta?.endedAt ?? null,
      turnCount: parsedMeta?.turnCount ?? null,
      messageCount: indexed?.messageCount ?? null,
      thoughtCount: indexed?.thoughtCount ?? null,
      toolCallCount: indexed?.toolCallCount ?? null,
      metaCount: indexed?.metaCount ?? null,
      tokenCount: indexed?.tokenCount ?? null,
      activeDurationMs: parsedMeta?.activeDurationMs ?? indexed?.activeDurationMs ?? null,
      cwd: indexed?.cwd ?? null,
      gitBranch: indexed?.gitBranch ?? null,
      gitRepo: indexed?.gitRepo ?? null,
      gitCommitHash: indexed?.gitCommitHash ?? null,
      sessionId: indexed?.sessionId || extractedId || '',
    };

    if (!indexed) return fallback;

    return {
      ...fallback,
      ...indexed,
      preview: indexed.preview || fallback.preview,
      timestamp: indexed.timestamp || fallback.timestamp,
      startedAt: indexed.startedAt ?? fallback.startedAt,
      endedAt: indexed.endedAt ?? fallback.endedAt,
      turnCount: indexed.turnCount ?? fallback.turnCount,
      messageCount: indexed.messageCount ?? fallback.messageCount,
      thoughtCount: indexed.thoughtCount ?? fallback.thoughtCount,
      toolCallCount: indexed.toolCallCount ?? fallback.toolCallCount,
      metaCount: indexed.metaCount ?? fallback.metaCount,
      tokenCount: indexed.tokenCount ?? fallback.tokenCount,
      activeDurationMs: indexed.activeDurationMs ?? fallback.activeDurationMs,
      filename: indexed.filename || fallback.filename,
      sessionId: indexed.sessionId || fallback.sessionId,
    };
  }, [activeSessionId, findSessionById, parsedMeta]);

  useEffect(() => {
    if (scrollToTurnId === null) return;
    const element = document.getElementById(`turn-${scrollToTurnId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setScrollToTurnId(null);
  }, [scrollToTurnId]);

  return {
    turns,
    parseErrors,
    activeSession,
    sessionDetails,
    activeSearchQuery,
    loadingSession,
    loadSession,
    clearSession,
    jumpToTurn,
    setSessionSearchQuery,
  };
};
