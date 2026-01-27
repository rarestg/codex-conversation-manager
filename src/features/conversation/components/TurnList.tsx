import { memo, useEffect, useMemo } from 'react';
import { isRenderDebugEnabled } from '../debug';
import { useRenderDebug } from '../hooks/useRenderDebug';
import { useWhyDidYouRender } from '../hooks/useWhyDidYouRender';
import type { SessionFileEntry, Turn } from '../types';
import { TurnCard } from './TurnCard';

interface TurnListProps {
  filteredTurns: Turn[];
  loadingSession: boolean;
  activeSession: SessionFileEntry | null;
  parseErrors: string[];
  showFullContent: boolean;
  highlightTokens?: string[];
  matchTurnIds?: number[];
}

const TurnListComponent = ({
  filteredTurns,
  loadingSession,
  activeSession,
  parseErrors,
  showFullContent,
  highlightTokens,
  matchTurnIds,
}: TurnListProps) => {
  const renderStart = isRenderDebugEnabled ? performance.now() : 0;
  useRenderDebug('TurnList', {
    loadingSession,
    activeSessionId: activeSession?.id ?? null,
    parseErrorsCount: parseErrors.length,
    showFullContent,
    filteredTurnCount: filteredTurns.length,
  });
  useWhyDidYouRender(
    'TurnList',
    {
      filteredTurns,
      loadingSession,
      activeSession,
      parseErrors,
      showFullContent,
    },
    { includeFunctions: true },
  );
  const matchTurnIdSet = useMemo(() => new Set(matchTurnIds ?? []), [matchTurnIds]);
  useEffect(() => {
    if (!isRenderDebugEnabled) return;
    const duration = performance.now() - renderStart;
    console.debug('[render cost] TurnList', { duration });
  });

  return (
    <div className="space-y-6">
      {loadingSession && (
        <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-slate-600 shadow-card">
          Loading session…
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
          <div className="font-semibold">Parse warnings</div>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {parseErrors.slice(0, 6).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {parseErrors.length > 6 && <li>…and {parseErrors.length - 6} more</li>}
          </ul>
        </div>
      )}

      {!loadingSession && activeSession && filteredTurns.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          No conversation messages found in this session.
        </div>
      )}

      {!activeSession && (
        <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
          Pick a session from the sidebar to view the conversation.
        </div>
      )}

      {filteredTurns.map((turn) => (
        <TurnCard
          key={`turn-${turn.id}`}
          turn={turn}
          showFullContent={showFullContent}
          highlightTokens={highlightTokens}
          isMatch={matchTurnIdSet.has(turn.id)}
        />
      ))}
    </div>
  );
};

export const TurnList = memo(TurnListComponent);
