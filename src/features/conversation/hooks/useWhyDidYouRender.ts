import { useEffect, useRef } from 'react';
import { isRenderDebugEnabled } from '../debug';

type PropsMap = Record<string, unknown>;

interface WhyDidYouRenderOptions {
  includeFunctions?: boolean;
}

const summarizeValue = (value: unknown) => {
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  if (Array.isArray(value)) {
    return `Array(len=${value.length})`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `Object(keys=${keys.length})`;
  }
  if (typeof value === 'string' && value.length > 120) {
    return `${value.slice(0, 117)}...`;
  }
  return value;
};

export const useWhyDidYouRender = (label: string, props: PropsMap, options: WhyDidYouRenderOptions = {}) => {
  const prevProps = useRef<PropsMap | null>(null);

  useEffect(() => {
    if (!isRenderDebugEnabled) return;
    if (!prevProps.current) {
      prevProps.current = props;
      return;
    }
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const keys = new Set([...Object.keys(prevProps.current), ...Object.keys(props)]);
    for (const key of keys) {
      const prev = prevProps.current[key];
      const next = props[key];
      if (!options.includeFunctions && (typeof prev === 'function' || typeof next === 'function')) {
        continue;
      }
      if (!Object.is(prev, next)) {
        changes[key] = { from: summarizeValue(prev), to: summarizeValue(next) };
      }
    }
    const changeKeys = Object.keys(changes);
    if (changeKeys.length) {
      console.groupCollapsed(`[why-did-you-render] ${label} (${changeKeys.length} changes)`);
      console.log(changes);
      console.groupEnd();
    }
    prevProps.current = props;
  });
};
