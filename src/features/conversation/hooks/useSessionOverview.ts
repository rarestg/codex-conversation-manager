import { useMemo, useState } from 'react';
import type { Turn } from '../types';

export const useSessionOverview = (turns: Turn[]) => {
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

  const stats = useMemo(() => {
    let thoughtCount = 0;
    let toolCallCount = 0;
    let metaCount = 0;

    for (const turn of turns) {
      for (const item of turn.items) {
        if (item.type === 'thought') thoughtCount += 1;
        if (item.type === 'tool_call' || item.type === 'tool_output') toolCallCount += 1;
        if (item.type === 'meta' || item.type === 'token_count') metaCount += 1;
      }
    }

    return { thoughtCount, toolCallCount, metaCount };
  }, [turns]);

  return {
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
  };
};
