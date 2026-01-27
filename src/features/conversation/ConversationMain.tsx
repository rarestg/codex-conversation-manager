import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSessionMatches } from './api';
import { SessionHeaderVariantB } from './components/SessionHeaderVariantB';
import { SessionOverview } from './components/SessionOverview';
import { TurnJumpModal } from './components/TurnJumpModal';
import { TurnList } from './components/TurnList';
import { useRenderDebug } from './hooks/useRenderDebug';
import { useSessionOverview } from './hooks/useSessionOverview';
import { useTurnNavigation } from './hooks/useTurnNavigation';
import { TURN_JUMP_EVENT } from './turnNavigation';
import type { JumpToTurnOptions, SessionDetails, SessionFileEntry, Turn } from './types';
import { getSessionParamsFromLocation } from './url';

interface ConversationMainProps {
  turns: Turn[];
  parseErrors: string[];
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  sessionsRoot: string;
  loadingSession: boolean;
  activeSearchQuery?: string | null;
  jumpToTurn: (turnId: number | null, options?: JumpToTurnOptions) => void;
}

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export const ConversationMain = ({
  turns,
  parseErrors,
  activeSession,
  sessionDetails,
  sessionsRoot,
  loadingSession,
  activeSearchQuery,
  jumpToTurn,
}: ConversationMainProps) => {
  const mainRef = useRef<HTMLElement | null>(null);
  const topSentinelRef = useRef<HTMLSpanElement | null>(null);
  const [turnJumpOpen, setTurnJumpOpen] = useState(false);
  const {
    showThoughts,
    setShowThoughts,
    showTools,
    setShowTools,
    showMeta,
    setShowMeta,
    showTokenCounts,
    setShowTokenCounts,
    showFullContent,
    setShowFullContent,
    filteredTurns,
    visibleItemCount,
    stats,
  } = useSessionOverview(turns);
  const [matchTurnIds, setMatchTurnIds] = useState<number[]>([]);
  const [matchTokens, setMatchTokens] = useState<string[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const matchRequestId = useRef(0);

  const navigableTurnIds = useMemo(
    () => filteredTurns.filter((turn) => !turn.isPreamble).map((turn) => turn.id),
    [filteredTurns],
  );
  const { turnId: urlTurnId } = getSessionParamsFromLocation();
  const { activeTurnId, activeTurnIndex, totalTurns } = useTurnNavigation({
    turnIds: navigableTurnIds,
    jumpToTurn,
    initialTurnId: urlTurnId ?? null,
    enabled: Boolean(activeSession) && !loadingSession,
    containerRef: mainRef,
    topSentinelRef,
    sessionKey: activeSession?.id ?? null,
  });

  useEffect(() => {
    if (!activeSession || !activeSearchQuery) {
      setMatchTurnIds([]);
      setMatchTokens([]);
      setMatchesError(null);
      setMatchesLoading(false);
      return;
    }
    matchRequestId.current += 1;
    const requestId = matchRequestId.current;
    const requestKey = `matches-${Date.now().toString(36)}-${requestId}`;
    setMatchesLoading(true);
    setMatchTurnIds([]);
    setMatchTokens([]);
    setMatchesError(null);
    // Server intentionally excludes preamble (turn_id <= 0) from match results.
    fetchSessionMatches(activeSession.id, activeSearchQuery, requestKey)
      .then((data) => {
        if (requestId !== matchRequestId.current) return;
        setMatchTurnIds(data.turn_ids);
        setMatchTokens(data.tokens);
      })
      .catch((error: any) => {
        if (requestId !== matchRequestId.current) return;
        setMatchesError(error?.message || 'Unable to load matches.');
        setMatchTurnIds([]);
        setMatchTokens([]);
      })
      .finally(() => {
        if (requestId !== matchRequestId.current) return;
        setMatchesLoading(false);
      });
  }, [activeSearchQuery, activeSession]);

  useEffect(() => {
    if (!activeSession || loadingSession) {
      setTurnJumpOpen(false);
    }
  }, [activeSession, loadingSession]);

  useEffect(() => {
    if (!activeSession || loadingSession) return;
    const handleRequestJump = () => {
      if (navigableTurnIds.length === 0) return;
      setTurnJumpOpen(true);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      if (isEditableElement(event.target)) return;
      event.preventDefault();
      handleRequestJump();
    };
    const handleCustomEvent = () => handleRequestJump();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(TURN_JUMP_EVENT, handleCustomEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(TURN_JUMP_EVENT, handleCustomEvent);
    };
  }, [activeSession, loadingSession, navigableTurnIds.length]);

  const handleJump = useCallback(
    (requestedTurn: number) => {
      if (navigableTurnIds.length === 0) return;
      const numeric = Math.round(requestedTurn);
      const clamped = Math.min(Math.max(numeric, 1), navigableTurnIds.length);
      const nextId = navigableTurnIds[clamped - 1];
      if (typeof nextId !== 'number') return;
      jumpToTurn(nextId, { historyMode: 'replace', scroll: true });
      setTurnJumpOpen(false);
    },
    [jumpToTurn, navigableTurnIds],
  );

  useRenderDebug('ConversationMain', {
    activeSessionId: activeSession?.id ?? null,
    loadingSession,
    activeSearchQuery: activeSearchQuery ?? null,
    showThoughts,
    showTools,
    showMeta,
    showTokenCounts,
    showFullContent,
    filteredTurnCount: filteredTurns.length,
    visibleItemCount,
    navigableTurnCount: navigableTurnIds.length,
    activeTurnId,
    activeTurnIndex,
    totalTurns,
  });

  const matchCount = matchTurnIds.length;
  const currentMatchIndex = activeTurnId ? matchTurnIds.indexOf(activeTurnId) : -1;
  const matchPosition = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;

  const handlePrevMatch = useCallback(() => {
    if (!matchCount) return;
    const index = currentMatchIndex >= 0 ? currentMatchIndex - 1 : matchCount - 1;
    const targetIndex = index < 0 ? matchCount - 1 : index;
    const targetId = matchTurnIds[targetIndex];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [currentMatchIndex, jumpToTurn, matchCount, matchTurnIds]);

  const handleNextMatch = useCallback(() => {
    if (!matchCount) return;
    const index = currentMatchIndex >= 0 ? currentMatchIndex + 1 : 0;
    const targetIndex = index >= matchCount ? 0 : index;
    const targetId = matchTurnIds[targetIndex];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [currentMatchIndex, jumpToTurn, matchCount, matchTurnIds]);

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
        mainRef.current?.focus({ preventScroll: true });
      }}
      className="relative flex-1 min-w-0 focus:outline-none focus-visible:outline-none"
    >
      <span ref={topSentinelRef} className="absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <div className="space-y-6">
        <SessionOverview
          HeaderComponent={SessionHeaderVariantB}
          toggleVariant="compact"
          showToggleCountsWhenOff
          activeSession={activeSession}
          sessionDetails={sessionDetails}
          sessionsRoot={sessionsRoot}
          filteredTurns={filteredTurns}
          visibleItemCount={visibleItemCount}
          stats={stats}
          showThoughts={showThoughts}
          showTools={showTools}
          showMeta={showMeta}
          showTokenCounts={showTokenCounts}
          showFullContent={showFullContent}
          onShowThoughtsChange={setShowThoughts}
          onShowToolsChange={setShowTools}
          onShowMetaChange={setShowMeta}
          onShowTokenCountsChange={setShowTokenCounts}
          onShowFullContentChange={setShowFullContent}
        />

        {activeSearchQuery && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Search matches
              </span>
              <span className="text-sm text-slate-800">{activeSearchQuery}</span>
            </div>
            {matchesLoading ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Finding matches…</span>
            ) : matchesError ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{matchesError}</span>
            ) : matchCount === 0 ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                No matches in this session
              </span>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Match {matchPosition} of {matchCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <TurnList
          filteredTurns={filteredTurns}
          loadingSession={loadingSession}
          activeSession={activeSession}
          parseErrors={parseErrors}
          showFullContent={showFullContent}
          highlightTokens={activeSearchQuery ? matchTokens : undefined}
          matchTurnIds={matchTurnIds}
        />
      </div>

      <TurnJumpModal
        open={turnJumpOpen}
        totalTurns={totalTurns}
        currentTurnIndex={activeTurnIndex}
        onClose={() => setTurnJumpOpen(false)}
        onJump={handleJump}
      />
    </main>
  );
};
