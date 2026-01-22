import { useMemo, useState } from 'react';
import { SessionHeader } from './components/SessionHeader';
import { Toggle } from './components/Toggle';
import { TurnList } from './components/TurnList';
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
  const [showThoughts, setShowThoughts] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showMeta, setShowMeta] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const filteredTurns = useMemo(() => {
    return turns.map((turn) => {
      const items = turn.items.filter((item) => {
        if (item.type === 'thought' && !showThoughts) return false;
        if ((item.type === 'tool_call' || item.type === 'tool_output') && !showTools) return false;
        if ((item.type === 'meta' || item.type === 'token_count') && !showMeta) return false;
        return true;
      });
      return { ...turn, items };
    });
  }, [turns, showThoughts, showTools, showMeta]);

  const visibleItemCount = useMemo(() => {
    return filteredTurns.reduce((count, turn) => count + turn.items.length, 0);
  }, [filteredTurns]);

  const sessionStats = useMemo(() => {
    let thoughtCount = 0;
    let toolCallCount = 0;
    let metaCount = 0;

    for (const turn of turns) {
      for (const item of turn.items) {
        if (item.type === 'thought') thoughtCount += 1;
        if (item.type === 'tool_call') toolCallCount += 1;
        if (item.type === 'meta' || item.type === 'token_count') metaCount += 1;
      }
    }

    return { thoughtCount, toolCallCount, metaCount };
  }, [turns]);

  return (
    <main className="flex-1 min-w-0 space-y-6">
      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
        <SessionHeader
          activeSession={activeSession}
          sessionDetails={sessionDetails}
          sessionsRoot={sessionsRoot}
          visibleItemCount={visibleItemCount}
          stats={sessionStats}
          filteredTurns={filteredTurns}
        />

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Toggle
            label="Show thoughts"
            description="Include agent reasoning inline."
            checked={showThoughts}
            onChange={setShowThoughts}
          />
          <Toggle
            label="Show tools"
            description="Tool calls and outputs inline."
            checked={showTools}
            onChange={setShowTools}
          />
          <Toggle
            label="Show metadata"
            description="turn_context, session_meta, token_count."
            checked={showMeta}
            onChange={setShowMeta}
          />
          <Toggle
            label="Show full content"
            description="Disable truncation for long messages."
            checked={showFullContent}
            onChange={setShowFullContent}
          />
        </div>
      </div>

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
