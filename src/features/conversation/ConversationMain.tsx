import { useMemo, useRef } from 'react';
import { SessionHeaderVariantB } from './components/SessionHeaderVariantB';
import { SessionOverview } from './components/SessionOverview';
import { TurnList } from './components/TurnList';
import { useRenderDebug } from './hooks/useRenderDebug';
import { useSessionOverview } from './hooks/useSessionOverview';
import { useTurnNavigation } from './hooks/useTurnNavigation';
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
      className="flex-1 min-w-0 space-y-6 focus:outline-none focus-visible:outline-none"
    >
      <span ref={topSentinelRef} className="block h-px w-full" aria-hidden="true" />
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
    </main>
  );
};
