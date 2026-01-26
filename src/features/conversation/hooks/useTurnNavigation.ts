import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import type { JumpToTurnOptions } from '../types';
import { useTurnObserver } from './useTurnObserver';

interface UseTurnNavigationOptions {
  turnIds: number[];
  jumpToTurn: (turnId: number, options?: JumpToTurnOptions) => void;
  initialTurnId?: number | null;
  enabled?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
}

const isEditableElement = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
};

export const useTurnNavigation = ({
  turnIds,
  jumpToTurn,
  initialTurnId,
  enabled = true,
  containerRef,
}: UseTurnNavigationOptions) => {
  const [activeTurnId, setActiveTurnId] = useState<number | null>(initialTurnId ?? null);

  useEffect(() => {
    if (!enabled) return;
    if (turnIds.length === 0) {
      setActiveTurnId(null);
      return;
    }
    if (activeTurnId !== null && turnIds.includes(activeTurnId)) return;

    const fallback =
      typeof initialTurnId === 'number' && Number.isFinite(initialTurnId) && turnIds.includes(initialTurnId)
        ? initialTurnId
        : turnIds[0];
    setActiveTurnId(fallback ?? null);
  }, [activeTurnId, enabled, initialTurnId, turnIds]);

  const handleActiveTurnChange = useCallback(
    (turnId: number) => {
      setActiveTurnId(turnId);
      jumpToTurn(turnId, { historyMode: 'replace', scroll: false });
    },
    [jumpToTurn],
  );

  useTurnObserver({
    turnIds,
    enabled,
    onActiveTurnChange: handleActiveTurnChange,
  });

  const totalTurns = turnIds.length;
  const activeTurnIndex = useMemo(
    () => (activeTurnId !== null ? turnIds.indexOf(activeTurnId) : -1),
    [activeTurnId, turnIds],
  );

  useEffect(() => {
    if (!enabled || totalTurns === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (isEditableElement(event.target)) return;
      if (containerRef?.current) {
        const activeElement = document.activeElement;
        const targetNode = event.target instanceof Node ? event.target : null;
        const containsTarget = targetNode ? containerRef.current.contains(targetNode) : false;
        const containsActive = activeElement ? containerRef.current.contains(activeElement) : false;
        if (!containsTarget && !containsActive) return;
      }

      event.preventDefault();

      const currentIndex = activeTurnIndex >= 0 ? activeTurnIndex : 0;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), totalTurns - 1);
      const nextId = turnIds[nextIndex];
      if (typeof nextId !== 'number') return;
      jumpToTurn(nextId, { historyMode: 'replace', scroll: true });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTurnIndex, containerRef, enabled, jumpToTurn, totalTurns, turnIds]);

  return { activeTurnId, activeTurnIndex, totalTurns };
};
