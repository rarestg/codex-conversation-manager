export const isRenderDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_RENDER_DEBUG === '1';
export const isTurnNavDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_TURN_NAV_DEBUG === '1';
export const isSearchDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_SEARCH_DEBUG === '1';

export const logTurnNav = (...args: unknown[]) => {
  if (!isTurnNavDebugEnabled) return;
  console.debug('[turn-nav]', ...args);
};

export const logSearch = (...args: unknown[]) => {
  if (!isSearchDebugEnabled) return;
  console.debug('[search]', ...args);
};
