import { useMemo, useState } from 'react';
import type { Turn } from '../types';

export const useSessionOverview = (turns: Turn[]) => {
  const [showThoughts, setShowThoughts] = useState(true);
  const [showTools, setShowTools] = useState(true);
  const [showMeta, setShowMeta] = useState(false);
  const [showTokenCounts, setShowTokenCounts] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const filteredTurns = useMemo(() => {
    return turns.map((turn) => {
      const items = turn.items.filter((item) => {
        if (item.type === 'thought' && !showThoughts) return false;
        if ((item.type === 'tool_call' || item.type === 'tool_output') && !showTools) return false;
        if (item.type === 'meta' && !showMeta) return false;
        if (item.type === 'token_count' && !showTokenCounts) return false;
        return true;
      });
      return { ...turn, items };
    });
  }, [turns, showThoughts, showTools, showMeta, showTokenCounts]);

  const visibleItemCount = useMemo(() => {
    return filteredTurns.reduce((count, turn) => count + turn.items.length, 0);
  }, [filteredTurns]);

  const stats = useMemo(() => {
    let thoughtCount = 0;
    let toolCallCount = 0;
    let metaCount = 0;
    let tokenCount = 0;

    for (const turn of turns) {
      for (const item of turn.items) {
        if (item.type === 'thought') thoughtCount += 1;
        if (item.type === 'tool_call') toolCallCount += 1;
        if (item.type === 'meta') metaCount += 1;
        if (item.type === 'token_count') tokenCount += 1;
      }
    }

    return { thoughtCount, toolCallCount, metaCount, tokenCount };
  }, [turns]);

  return {
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
  };
};
