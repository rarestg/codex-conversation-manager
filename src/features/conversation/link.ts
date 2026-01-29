import type { MouseEvent } from 'react';

export const isPlainLeftClick = (event: MouseEvent<HTMLElement>) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
