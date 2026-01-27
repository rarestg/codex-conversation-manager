import { useEffect, useRef } from 'react';
import type { LoadSessionOptions } from '../types';
import { getSessionParamsFromLocation } from '../url';

export const useUrlSync = (
  loadSession: (sessionId: string, turnId?: number, options?: LoadSessionOptions) => void,
  clearSession: () => void,
) => {
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    const { sessionId, turnId, searchQuery } = getSessionParamsFromLocation();
    if (!sessionId) {
      clearSession();
      return;
    }
    const parsedTurn = typeof turnId === 'number' && Number.isFinite(turnId) ? turnId : undefined;
    loadSession(sessionId, parsedTurn, { historyMode: 'replace', searchQuery });
  }, [clearSession, loadSession]);

  useEffect(() => {
    const handlePopState = () => {
      const { sessionId, turnId, searchQuery } = getSessionParamsFromLocation();
      if (!sessionId) {
        clearSession();
        return;
      }
      const parsedTurn = typeof turnId === 'number' && Number.isFinite(turnId) ? turnId : undefined;
      loadSession(sessionId, parsedTurn, { historyMode: 'replace', searchQuery });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearSession, loadSession]);
};
