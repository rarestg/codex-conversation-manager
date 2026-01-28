import { Keyboard, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSessionMatches } from './api';
import { SessionHeaderVariantB } from './components/SessionHeaderVariantB';
import { SessionOverview, SessionToggleRow } from './components/SessionOverview';
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
  setSessionSearchQuery: (query: string | null) => void;
  onGoHome: () => void;
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
  setSessionSearchQuery,
  onGoHome,
}: ConversationMainProps) => {
  const mainRef = useRef<HTMLElement | null>(null);
  const topSentinelRef = useRef<HTMLSpanElement | null>(null);
  const [turnJumpOpen, setTurnJumpOpen] = useState(false);
  const [isMessagesFocused, setIsMessagesFocused] = useState(false);
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
  const activeSearchQueryRef = useRef<string | null>(activeSearchQuery ?? null);

  useEffect(() => {
    activeSearchQueryRef.current = activeSearchQuery ?? null;
  }, [activeSearchQuery]);

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

  const openTurnJump = useCallback(() => {
    if (navigableTurnIds.length === 0) return;
    setTurnJumpOpen(true);
  }, [navigableTurnIds.length]);

  const handleFocusCapture = useCallback(() => {
    setIsMessagesFocused(true);
  }, []);

  const handleBlurCapture = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as HTMLElement | null;
    if (next && mainRef.current?.contains(next)) return;
    setIsMessagesFocused(false);
  }, []);

  useEffect(() => {
    if (!activeSession || !activeSearchQuery) {
      matchRequestId.current += 1;
      setMatchTurnIds([]);
      setMatchTokens([]);
      setMatchesError(null);
      setMatchesLoading(false);
      return;
    }
    matchRequestId.current += 1;
    const requestId = matchRequestId.current;
    const requestQuery = activeSearchQuery;
    const requestKey = `matches-${Date.now().toString(36)}-${requestId}`;
    setMatchesLoading(true);
    setMatchTurnIds([]);
    setMatchTokens([]);
    setMatchesError(null);
    // Server intentionally excludes preamble (turn_id <= 0) from match results.
    fetchSessionMatches(activeSession.id, activeSearchQuery, requestKey)
      .then((data) => {
        if (requestId !== matchRequestId.current) return;
        if (activeSearchQueryRef.current !== requestQuery) return;
        setMatchTurnIds(data.turn_ids);
        setMatchTokens(data.tokens);
      })
      .catch((error: any) => {
        if (requestId !== matchRequestId.current) return;
        if (activeSearchQueryRef.current !== requestQuery) return;
        setMatchesError(error?.message || 'Unable to load matches.');
        setMatchTurnIds([]);
        setMatchTokens([]);
      })
      .finally(() => {
        if (requestId !== matchRequestId.current) return;
        if (activeSearchQueryRef.current !== requestQuery) return;
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isShortcut) return;
      if (isEditableElement(event.target)) return;
      event.preventDefault();
      openTurnJump();
    };
    const handleCustomEvent = () => openTurnJump();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener(TURN_JUMP_EVENT, handleCustomEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener(TURN_JUMP_EVENT, handleCustomEvent);
    };
  }, [activeSession, loadingSession, openTurnJump]);

  useEffect(() => {
    if (!activeSession || loadingSession) return;
    if (navigableTurnIds.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (isEditableElement(event.target)) return;

      if (mainRef.current) {
        const activeElement = document.activeElement;
        const targetNode = event.target instanceof Node ? event.target : null;
        const containsTarget = targetNode ? mainRef.current.contains(targetNode) : false;
        const containsActive = activeElement ? mainRef.current.contains(activeElement) : false;
        if (!containsTarget && !containsActive) return;
      }

      const isArrowUp = event.key === 'ArrowUp';
      const isArrowDown = event.key === 'ArrowDown';
      const isHomeShortcut = event.key.toLowerCase() === 'h' && event.shiftKey;
      if (!isArrowUp && !isArrowDown && !isHomeShortcut) return;

      event.preventDefault();
      if (isHomeShortcut) {
        onGoHome();
        return;
      }

      const targetId = isArrowUp ? navigableTurnIds[0] : navigableTurnIds[navigableTurnIds.length - 1];
      if (typeof targetId !== 'number') return;
      jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, jumpToTurn, loadingSession, navigableTurnIds, onGoHome]);

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

  const handleClearSearchQuery = useCallback(() => {
    setSessionSearchQuery(null);
  }, [setSessionSearchQuery]);

  const handleJumpFirst = useCallback(() => {
    if (navigableTurnIds.length === 0) return;
    const targetId = navigableTurnIds[0];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [jumpToTurn, navigableTurnIds]);

  const handleJumpPrev = useCallback(() => {
    if (navigableTurnIds.length === 0) return;
    const currentIndex = activeTurnIndex >= 0 ? activeTurnIndex : 0;
    const targetIndex = Math.max(currentIndex - 1, 0);
    const targetId = navigableTurnIds[targetIndex];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [activeTurnIndex, jumpToTurn, navigableTurnIds]);

  const handleJumpNext = useCallback(() => {
    if (navigableTurnIds.length === 0) return;
    const currentIndex = activeTurnIndex >= 0 ? activeTurnIndex : 0;
    const targetIndex = Math.min(currentIndex + 1, navigableTurnIds.length - 1);
    const targetId = navigableTurnIds[targetIndex];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [activeTurnIndex, jumpToTurn, navigableTurnIds]);

  const handleJumpLast = useCallback(() => {
    if (navigableTurnIds.length === 0) return;
    const targetId = navigableTurnIds[navigableTurnIds.length - 1];
    if (typeof targetId !== 'number') return;
    jumpToTurn(targetId, { historyMode: 'replace', scroll: true });
  }, [jumpToTurn, navigableTurnIds]);

  const canNavigateTurns = navigableTurnIds.length > 0;
  const canJumpPrev = canNavigateTurns && activeTurnIndex > 0;
  const canJumpNext = canNavigateTurns && activeTurnIndex >= 0 && activeTurnIndex < navigableTurnIds.length - 1;

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

  const matchStatusContent = matchesLoading ? (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">Finding matches…</span>
  ) : matchesError ? (
    <span className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700">{matchesError}</span>
  ) : matchCount === 0 ? (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">No matches in this session</span>
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
  );

  const matchActionRow = (
    <div className="flex flex-wrap items-center gap-2">
      {matchStatusContent}
      <button
        type="button"
        onClick={handleClearSearchQuery}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Clear session search"
        title="Clear search"
      >
        <X className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Clear</span>
      </button>
    </div>
  );

  const renderToggleBar = (className?: string) => (
    <div
      className={['rounded-2xl border border-white/70 bg-white/90 px-4 py-2 shadow-sm backdrop-blur', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <SessionToggleRow
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
          variant="compact"
          showToggleCountsWhenOff
        />
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span
            title={isMessagesFocused ? 'Shortcuts active' : 'Click Messages pane to enable'}
            className={[
              'inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] shadow-sm transition',
              isMessagesFocused
                ? 'border-slate-200 bg-white text-slate-600'
                : 'border-slate-200 bg-white/80 text-slate-400',
            ].join(' ')}
          >
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
            <span
              className={['h-1.5 w-1.5 rounded-full', isMessagesFocused ? 'bg-emerald-500' : 'bg-slate-300'].join(' ')}
              aria-hidden="true"
            />
            <span className="sr-only">{isMessagesFocused ? 'Shortcuts active' : 'Click Messages pane to enable'}</span>
          </span>
          <div className={['flex flex-wrap items-center gap-2', isMessagesFocused ? '' : 'opacity-50'].join(' ')}>
            <button
              type="button"
              onClick={handleJumpFirst}
              title="Jump to first message (⌘↑ / Ctrl↑)"
              aria-label="Jump to first message (⌘↑ / Ctrl↑)"
              disabled={!canNavigateTurns}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘↑ / Ctrl↑
              </span>
              <span>First</span>
            </button>
            <button
              type="button"
              onClick={handleJumpPrev}
              title="Jump to previous message (⌘← / Ctrl←)"
              aria-label="Jump to previous message (⌘← / Ctrl←)"
              disabled={!canJumpPrev}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘← / Ctrl←
              </span>
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleJumpNext}
              title="Jump to next message (⌘→ / Ctrl→)"
              aria-label="Jump to next message (⌘→ / Ctrl→)"
              disabled={!canJumpNext}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘→ / Ctrl→
              </span>
              <span>Next</span>
            </button>
            <button
              type="button"
              onClick={handleJumpLast}
              title="Jump to last message (⌘↓ / Ctrl↓)"
              aria-label="Jump to last message (⌘↓ / Ctrl↓)"
              disabled={!canNavigateTurns}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘↓ / Ctrl↓
              </span>
              <span>Last</span>
            </button>
            <button
              type="button"
              onClick={openTurnJump}
              title="Go to turn… (⌘K / Ctrl+K)"
              aria-label="Go to turn… (⌘K / Ctrl+K)"
              disabled={!canNavigateTurns}
              className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] text-slate-600 shadow-sm">
                ⌘K / Ctrl+K
              </span>
              <span>Go to turn…</span>
            </button>
          </div>
        </div>
        {activeSearchQuery && <div className="ml-auto">{matchActionRow}</div>}
      </div>
    </div>
  );

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
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
          showToggles={false}
        />
        <div className="sticky top-[calc(env(safe-area-inset-top)+0.75rem)] z-20">{renderToggleBar()}</div>

        {activeSearchQuery && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Search matches
              </span>
              <span className="text-sm text-slate-800">{activeSearchQuery}</span>
            </div>
            {matchActionRow}
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
