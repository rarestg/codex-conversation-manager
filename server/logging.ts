const DEBUG_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.CODEX_DEBUG).toLowerCase());
const SEARCH_DEBUG_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.CODEX_SEARCH_DEBUG).toLowerCase());

export const logDebug = (...args: unknown[]) => {
  if (!DEBUG_ENABLED) return;
  console.log('[debug]', ...args);
};

export const logSearchDebug = (...args: unknown[]) => {
  if (!SEARCH_DEBUG_ENABLED) return;
  console.debug('[search]', ...args);
};

export { DEBUG_ENABLED, SEARCH_DEBUG_ENABLED };
