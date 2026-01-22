import { useEffect, useRef } from 'react';

type DebugSnapshot = Record<string, unknown>;

export const useRenderDebug = (label: string, snapshot: DebugSnapshot) => {
  const prevSnapshot = useRef<DebugSnapshot>(snapshot);
  const renderCount = useRef(0);

  renderCount.current += 1;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const keys = new Set([...Object.keys(prevSnapshot.current), ...Object.keys(snapshot)]);
    for (const key of keys) {
      if (!Object.is(prevSnapshot.current[key], snapshot[key])) {
        changes[key] = { from: prevSnapshot.current[key], to: snapshot[key] };
      }
    }
    const changeKeys = Object.keys(changes);
    const title = changeKeys.length
      ? `[render] ${label} #${renderCount.current} (${changeKeys.length} changes)`
      : `[render] ${label} #${renderCount.current} (no tracked prop changes)`;
    console.groupCollapsed(title);
    if (changeKeys.length) {
      console.log(changes);
    }
    console.groupEnd();
    prevSnapshot.current = snapshot;
  });
};
