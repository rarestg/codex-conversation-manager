import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionDetailSummary } from '../../../../shared/sessionDetailTypes';
import { fetchSessionDetail } from '../api';
import { logTurnNav } from '../debug';
import { extractSessionIdFromPath } from '../parsing';
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

export const useSession = ({ sessionsTree, onError }: UseSessionOptions) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string | null>(null);
  const [loadedSessionSummary, setLoadedSessionSummary] = useState<SessionDetailSummary | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({});
  const [loadingSession, setLoadingSession] = useState(false);
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null);
  const latestLoadRequestId = useRef(0);
  const activeLoadController = useRef<AbortController | null>(null);

  const clearSession = useCallback(() => {
    latestLoadRequestId.current += 1;
    activeLoadController.current?.abort();
    activeLoadController.current = null;
    setActiveSessionId(null);
    setActiveSearchQuery(null);
    setLoadedSessionSummary(null);
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
      latestLoadRequestId.current += 1;
      const requestId = latestLoadRequestId.current;
      activeLoadController.current?.abort();
      const controller = new AbortController();
      activeLoadController.current = controller;
      try {
        setLoadingSession(true);
        onError?.(null);
        const detail = await fetchSessionDetail(sessionId, { signal: controller.signal });
        if (controller.signal.aborted || requestId !== latestLoadRequestId.current) return;
        setTurns(detail.turns);
        setParseErrors(detail.parseErrors);
        setLoadedSessionSummary(detail.session);
        const indexed = findSessionById(sessionId);
        const metaFilename = indexed?.filename ?? detail.session.filename ?? sessionId;
        const fallbackSessionId = extractSessionIdFromPath(metaFilename);
        const resolvedSessionId = detail.session.sessionId || fallbackSessionId || undefined;
        const resolvedCwd = detail.session.cwd || indexed?.cwd || undefined;
        setSessionDetails({ sessionId: resolvedSessionId, cwd: resolvedCwd });
        setActiveSessionId(sessionId);
        setScrollToTurnId(turnId ?? null);
      } catch (error: any) {
        if (controller.signal.aborted || requestId !== latestLoadRequestId.current || error?.name === 'AbortError') {
          return;
        }
        const status = error?.status;
        if (status === 404 || status === 400) {
          onError?.(error?.message || 'Session file not found. Please reindex.');
        } else {
          onError?.(error?.message || 'Failed to load session.');
        }
      } finally {
        if (activeLoadController.current === controller) {
          activeLoadController.current = null;
        }
        if (!controller.signal.aborted && requestId === latestLoadRequestId.current) {
          setLoadingSession(false);
        }
      }
    },
    [findSessionById, onError],
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
    const filename = indexed?.filename || loadedSessionSummary?.filename || activeSessionId;
    const fallback: SessionFileEntry = {
      id: activeSessionId,
      filename,
      preview: loadedSessionSummary?.preview ?? indexed?.preview ?? null,
      timestamp: loadedSessionSummary?.timestamp ?? indexed?.timestamp ?? null,
      startedAt: loadedSessionSummary?.startedAt ?? indexed?.startedAt ?? null,
      endedAt: loadedSessionSummary?.endedAt ?? indexed?.endedAt ?? null,
      turnCount: loadedSessionSummary?.turnCount ?? indexed?.turnCount ?? null,
      messageCount: loadedSessionSummary?.messageCount ?? indexed?.messageCount ?? null,
      thoughtCount: loadedSessionSummary?.thoughtCount ?? indexed?.thoughtCount ?? null,
      toolCallCount: loadedSessionSummary?.toolCallCount ?? indexed?.toolCallCount ?? null,
      metaCount: loadedSessionSummary?.metaCount ?? indexed?.metaCount ?? null,
      tokenCount: loadedSessionSummary?.tokenCountCount ?? indexed?.tokenCount ?? null,
      activeDurationMs: loadedSessionSummary?.activeDurationMs ?? indexed?.activeDurationMs ?? null,
      cwd: loadedSessionSummary?.cwd ?? indexed?.cwd ?? null,
      gitBranch: loadedSessionSummary?.gitBranch ?? indexed?.gitBranch ?? null,
      gitRepo: loadedSessionSummary?.gitRepo ?? indexed?.gitRepo ?? null,
      gitCommitHash: loadedSessionSummary?.gitCommitHash ?? indexed?.gitCommitHash ?? null,
      sessionId: loadedSessionSummary?.sessionId ?? indexed?.sessionId ?? extractedId ?? '',
    };

    if (!indexed) return fallback;

    return {
      ...fallback,
      ...indexed,
      preview: loadedSessionSummary?.preview ?? indexed.preview ?? fallback.preview,
      timestamp: loadedSessionSummary?.timestamp ?? indexed.timestamp ?? fallback.timestamp,
      startedAt: loadedSessionSummary?.startedAt ?? indexed.startedAt ?? fallback.startedAt,
      endedAt: loadedSessionSummary?.endedAt ?? indexed.endedAt ?? fallback.endedAt,
      turnCount: loadedSessionSummary?.turnCount ?? indexed.turnCount ?? fallback.turnCount,
      messageCount: loadedSessionSummary?.messageCount ?? indexed.messageCount ?? fallback.messageCount,
      thoughtCount: loadedSessionSummary?.thoughtCount ?? indexed.thoughtCount ?? fallback.thoughtCount,
      toolCallCount: loadedSessionSummary?.toolCallCount ?? indexed.toolCallCount ?? fallback.toolCallCount,
      metaCount: loadedSessionSummary?.metaCount ?? indexed.metaCount ?? fallback.metaCount,
      tokenCount: loadedSessionSummary?.tokenCountCount ?? indexed.tokenCount ?? fallback.tokenCount,
      activeDurationMs: loadedSessionSummary?.activeDurationMs ?? indexed.activeDurationMs ?? fallback.activeDurationMs,
      filename: loadedSessionSummary?.filename ?? indexed.filename ?? fallback.filename,
      cwd: loadedSessionSummary?.cwd ?? indexed.cwd ?? fallback.cwd,
      gitBranch: loadedSessionSummary?.gitBranch ?? indexed.gitBranch ?? fallback.gitBranch,
      gitRepo: loadedSessionSummary?.gitRepo ?? indexed.gitRepo ?? fallback.gitRepo,
      gitCommitHash: loadedSessionSummary?.gitCommitHash ?? indexed.gitCommitHash ?? fallback.gitCommitHash,
      sessionId: loadedSessionSummary?.sessionId ?? indexed.sessionId ?? fallback.sessionId,
    };
  }, [activeSessionId, findSessionById, loadedSessionSummary]);

  useEffect(() => {
    if (scrollToTurnId === null) return;
    const element = document.getElementById(`turn-${scrollToTurnId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setScrollToTurnId(null);
  }, [scrollToTurnId]);

  useEffect(
    () => () => {
      activeLoadController.current?.abort();
    },
    [],
  );

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
