import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  });

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

        <TurnList
          filteredTurns={filteredTurns}
          loadingSession={loadingSession}
          activeSession={activeSession}
          parseErrors={parseErrors}
          showFullContent={showFullContent}
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
