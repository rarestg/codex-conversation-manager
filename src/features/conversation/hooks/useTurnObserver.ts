import { useEffect, useRef } from 'react';

interface UseTurnObserverOptions {
  turnIds: number[];
  onActiveTurnChange: (turnId: number) => void;
  rootMargin?: string;
  enabled?: boolean;
}

export const useTurnObserver = ({
  turnIds,
  onActiveTurnChange,
  rootMargin = '-35% 0px -55% 0px',
  enabled = true,
}: UseTurnObserverOptions) => {
  const activeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || turnIds.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    activeRef.current = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        if (intersecting.length === 0) return;

        const next = intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const idAttr = (next.target as HTMLElement).dataset.turnAnchor;
        const nextId = idAttr ? Number(idAttr) : NaN;
        if (!Number.isFinite(nextId) || activeRef.current === nextId) return;

        activeRef.current = nextId;
        onActiveTurnChange(nextId);
      },
      { rootMargin },
    );

    for (const id of turnIds) {
      const el = document.querySelector<HTMLElement>(`[data-turn-anchor="${id}"]`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [enabled, onActiveTurnChange, rootMargin, turnIds]);
};
