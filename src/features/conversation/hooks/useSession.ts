import { useCallback, useEffect, useState } from 'react';
import { fetchSession } from '../api';
import { extractSessionIdFromPath, parseJsonl } from '../parsing';
import type { LoadSessionOptions, SessionDetails, SessionFileEntry, SessionTree, Turn } from '../types';
import { updateSessionUrl } from '../url';

interface UseSessionOptions {
  sessionsTree: SessionTree | null;
  onError?: (message: string | null) => void;
}

export const useSession = ({ sessionsTree, onError }: UseSessionOptions) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<SessionFileEntry | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({});
  const [loadingSession, setLoadingSession] = useState(false);
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null);

  const buildDerivedMeta = useCallback((sessionId: string, turns: Turn[]) => {
    let preview: string | undefined;
    let startedAt: string | undefined;
    let endedAt: string | undefined;
    let turnCount = 0;
    let firstTimestamp: number | null = null;
    let lastTimestamp: number | null = null;

    for (const turn of turns) {
      if (!turn.isPreamble) turnCount += 1;
      for (const item of turn.items) {
        if (!preview && item.type === 'user' && item.content) {
          preview = item.content.trim();
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

    return {
      preview,
      startedAt,
      endedAt,
      turnCount,
      filename,
    };
  }, []);

  const clearSession = useCallback(() => {
    setActiveSession(null);
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
        const meta =
          findSessionById(sessionId) ??
          ({
            id: sessionId,
            filename: derivedMeta.filename || sessionId,
            size: 0,
          } as SessionFileEntry);
        const fallbackSessionId = extractSessionIdFromPath(meta.filename || meta.id);
        const resolvedSessionId = parsed.sessionInfo.sessionId || fallbackSessionId || undefined;
        const resolvedCwd = parsed.sessionInfo.cwd || meta.cwd || undefined;
        setSessionDetails({ sessionId: resolvedSessionId, cwd: resolvedCwd });
        setActiveSession((prev) => {
          const next = { ...meta };
          if (!next.preview && derivedMeta.preview) next.preview = derivedMeta.preview;
          if (!next.timestamp && derivedMeta.startedAt) next.timestamp = derivedMeta.startedAt;
          if (!next.startedAt && derivedMeta.startedAt) next.startedAt = derivedMeta.startedAt;
          if (!next.endedAt && derivedMeta.endedAt) next.endedAt = derivedMeta.endedAt;
          if ((next.turnCount === null || next.turnCount === undefined) && derivedMeta.turnCount > 0) {
            next.turnCount = derivedMeta.turnCount;
          }
          if (!next.filename && derivedMeta.filename) next.filename = derivedMeta.filename;
          if (prev?.id && prev.id === next.id) return { ...prev, ...next };
          return next;
        });
        setScrollToTurnId(turnId ?? null);
      } catch (error: any) {
        onError?.(error?.message || 'Failed to load session.');
      } finally {
        setLoadingSession(false);
      }
    },
    [buildDerivedMeta, findSessionById, onError],
  );

  useEffect(() => {
    if (scrollToTurnId === null) return;
    const element = document.getElementById(`turn-${scrollToTurnId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setScrollToTurnId(null);
  }, [scrollToTurnId]);

  useEffect(() => {
    if (!activeSession || !sessionsTree) return;
    const updated = findSessionById(activeSession.id);
    if (!updated) return;
    setActiveSession((prev) => {
      if (!prev) return updated;
      return {
        ...prev,
        ...updated,
        preview: updated.preview ?? prev.preview,
        timestamp: updated.timestamp ?? prev.timestamp,
        startedAt: updated.startedAt ?? prev.startedAt,
        endedAt: updated.endedAt ?? prev.endedAt,
        turnCount: updated.turnCount ?? prev.turnCount,
        filename: updated.filename || prev.filename,
      };
    });
  }, [activeSession, findSessionById, sessionsTree]);

  return {
    turns,
    parseErrors,
    activeSession,
    sessionDetails,
    loadingSession,
    loadSession,
    clearSession,
  };
};
