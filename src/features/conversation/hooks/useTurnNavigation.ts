import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logTurnNav } from '../debug';
import type { JumpToTurnOptions } from '../types';
import { useTurnObserver } from './useTurnObserver';

interface UseTurnNavigationOptions {
  turnIds: number[];
  jumpToTurn: (turnId: number | null, options?: JumpToTurnOptions) => void;
  initialTurnId?: number | null;
  enabled?: boolean;
  containerRef?: RefObject<HTMLElement | null>;
  topSentinelRef?: RefObject<HTMLElement | null>;
  sessionKey?: string | null;
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
  topSentinelRef,
  sessionKey,
}: UseTurnNavigationOptions) => {
  const [activeTurnId, setActiveTurnId] = useState<number | null>(initialTurnId ?? null);
  const isAtTopRef = useRef(false);
  const activeTurnIdRef = useRef<number | null>(initialTurnId ?? null);
  const lastUrlTurnRef = useRef<number | null>(initialTurnId ?? null);
  const lastSessionKeyRef = useRef<string | null>(sessionKey ?? null);

  useEffect(() => {
    if (sessionKey === lastSessionKeyRef.current) return;
    lastSessionKeyRef.current = sessionKey ?? null;
    lastUrlTurnRef.current = null;
    activeTurnIdRef.current = initialTurnId ?? null;
    isAtTopRef.current = false;
    setActiveTurnId(initialTurnId ?? null);
    logTurnNav('session:reset', { sessionKey, initialTurnId });
  }, [initialTurnId, sessionKey]);

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
      activeTurnIdRef.current = turnId;
      if (!isAtTopRef.current) {
        if (lastUrlTurnRef.current !== turnId) {
          logTurnNav('turn:update', { turnId, source: 'observer' });
          jumpToTurn(turnId, { historyMode: 'replace', scroll: false });
          lastUrlTurnRef.current = turnId;
        } else {
          logTurnNav('turn:update', { turnId, source: 'observer', skipped: true });
        }
      } else {
        logTurnNav('turn:update', { turnId, source: 'observer', suppressed: true });
      }
    },
    [jumpToTurn],
  );

  useEffect(() => {
    activeTurnIdRef.current = activeTurnId;
    logTurnNav('turn:state', { activeTurnId });
  }, [activeTurnId]);

  useEffect(() => {
    if (!enabled) return;
    if (!topSentinelRef?.current) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextAtTop = entry.isIntersecting;
        if (nextAtTop === isAtTopRef.current) return;
        isAtTopRef.current = nextAtTop;
        if (nextAtTop) {
          logTurnNav('top:enter', { clearing: true });
          jumpToTurn(null, { historyMode: 'replace', scroll: false });
          lastUrlTurnRef.current = null;
          return;
        }
        const nextTurn = activeTurnIdRef.current;
        if (typeof nextTurn === 'number' && Number.isFinite(nextTurn)) {
          if (lastUrlTurnRef.current !== nextTurn) {
            logTurnNav('top:exit', { restoringTurn: nextTurn });
            jumpToTurn(nextTurn, { historyMode: 'replace', scroll: false });
            lastUrlTurnRef.current = nextTurn;
          } else {
            logTurnNav('top:exit', { restoringTurn: nextTurn, skipped: true });
          }
        } else {
          logTurnNav('top:exit', { restoringTurn: null });
        }
      },
      { rootMargin: '0px 0px -80% 0px' },
    );

    observer.observe(topSentinelRef.current);
    return () => {
      logTurnNav('top:disconnect');
      observer.disconnect();
    };
  }, [enabled, jumpToTurn, topSentinelRef]);

  useTurnObserver({
    turnIds,
    enabled,
    onActiveTurnChange: handleActiveTurnChange,
    rootMargin: '0px 0px -90% 0px',
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
      logTurnNav('turn:navigate', { from: turnIds[currentIndex], to: nextId, key: event.key });
      jumpToTurn(nextId, { historyMode: 'replace', scroll: true });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTurnIndex, containerRef, enabled, jumpToTurn, totalTurns, turnIds]);

  return { activeTurnId, activeTurnIndex, totalTurns };
};
