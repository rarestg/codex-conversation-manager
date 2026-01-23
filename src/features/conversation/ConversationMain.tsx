import { SessionHeaderVariantB } from './components/SessionHeaderVariantB';
import { SessionOverview } from './components/SessionOverview';
import { TurnList } from './components/TurnList';
import { useRenderDebug } from './hooks/useRenderDebug';
import { useSessionOverview } from './hooks/useSessionOverview';
import type { SessionDetails, SessionFileEntry, Turn } from './types';

interface ConversationMainProps {
  turns: Turn[];
  parseErrors: string[];
  activeSession: SessionFileEntry | null;
  sessionDetails: SessionDetails;
  sessionsRoot: string;
  loadingSession: boolean;
}

export const ConversationMain = ({
  turns,
  parseErrors,
  activeSession,
  sessionDetails,
  sessionsRoot,
  loadingSession,
}: ConversationMainProps) => {
  const {
    showThoughts,
    setShowThoughts,
    showTools,
    setShowTools,
    showMeta,
    setShowMeta,
    showFullContent,
    setShowFullContent,
    filteredTurns,
    visibleItemCount,
    stats,
  } = useSessionOverview(turns);

  useRenderDebug('ConversationMain', {
    activeSessionId: activeSession?.id ?? null,
    loadingSession,
    showThoughts,
    showTools,
    showMeta,
    showFullContent,
    filteredTurnCount: filteredTurns.length,
    visibleItemCount,
  });

  return (
    <main className="flex-1 min-w-0 space-y-6">
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
        showFullContent={showFullContent}
        onShowThoughtsChange={setShowThoughts}
        onShowToolsChange={setShowTools}
        onShowMetaChange={setShowMeta}
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
