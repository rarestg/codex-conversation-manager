import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSession } from '../api';
import { logTurnNav } from '../debug';
import { MAX_PREVIEW_CHARS, MAX_PREVIEW_LINES } from '../format';
import { extractSessionIdFromPath, parseJsonl } from '../parsing';
import type {
  JumpToTurnOptions,
  LoadSessionOptions,
  SessionDetails,
  SessionFileEntry,
  SessionTree,
  Turn,
} from '../types';
import { updateSessionUrl } from '../url';

interface UseSessionOptions {
  sessionsTree: SessionTree | null;
  onError?: (message: string | null) => void;
}

interface ParsedMeta {
  preview?: string;
  startedAt?: string;
  endedAt?: string;
  turnCount?: number;
  filename?: string;
}

export const useSession = ({ sessionsTree, onError }: UseSessionOptions) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [parsedMeta, setParsedMeta] = useState<ParsedMeta | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({});
  const [loadingSession, setLoadingSession] = useState(false);
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null);

  const buildDerivedMeta = useCallback((sessionId: string, turns: Turn[]) => {
    // Fallback metadata uses min/max timestamps (total span), not active duration.
    let preview: string | undefined;
    let startedAt: string | undefined;
    let endedAt: string | undefined;
    let turnCount = 0;
    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;
    const truncatePreview = (value: string) => {
      let truncated = value.slice(0, MAX_PREVIEW_CHARS);
      const lines = truncated.split(/\r?\n/);
      if (lines.length > MAX_PREVIEW_LINES) {
        truncated = lines.slice(0, MAX_PREVIEW_LINES).join('\n');
      }
      return truncated;
    };

    for (const turn of turns) {
      if (!turn.isPreamble) turnCount += 1;
      for (const item of turn.items) {
        if (!preview && item.type === 'user' && item.content) {
          const trimmed = item.content.trim();
          if (trimmed) preview = truncatePreview(trimmed);
        }
        if (!item.timestamp) continue;
        const parsed = Date.parse(item.timestamp);
        if (!Number.isFinite(parsed)) continue;
        if (firstTimestamp === null || parsed < firstTimestamp) firstTimestamp = parsed;
        if (lastTimestamp === null || parsed > lastTimestamp) lastTimestamp = parsed;
      }
    }

    if (firstTimestamp !== null) startedAt = new Date(firstTimestamp).toISOString();
    if (lastTimestamp !== null) endedAt = new Date(lastTimestamp).toISOString();
    const filename = sessionId.split('/').pop() || sessionId;
    const turnCountValue = turnCount > 0 ? turnCount : undefined;

    return {
      preview,
      startedAt,
      endedAt,
      turnCount: turnCountValue,
      filename,
    };
  }, []);

  const clearSession = useCallback(() => {
    setActiveSessionId(null);
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
      updateSessionUrl(sessionId, turnId ?? null, historyMode);
      try {
        setLoadingSession(true);
        onError?.(null);
        const raw = await fetchSession(sessionId);
        const parsed = parseJsonl(raw);
        setTurns(parsed.turns);
        setParseErrors(parsed.errors);
        const derivedMeta = buildDerivedMeta(sessionId, parsed.turns);
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
    [buildDerivedMeta, findSessionById, onError],
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
      updateSessionUrl(activeSessionId, turnId ?? null, historyMode);
      if (typeof turnId === 'number' && Number.isFinite(turnId) && options?.scroll !== false) {
        setScrollToTurnId(turnId);
      }
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
      activeDurationMs: indexed?.activeDurationMs ?? null,
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
    loadingSession,
    loadSession,
    clearSession,
    jumpToTurn,
  };
};
