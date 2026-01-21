import { useEffect, useRef } from 'react'
import { getSessionParamsFromLocation } from '../url'
import type { LoadSessionOptions } from '../types'

export const useUrlSync = (
  loadSession: (sessionId: string, turnId?: number, options?: LoadSessionOptions) => void,
  clearSession: () => void,
) => {
  const initialLoadRef = useRef(false)

  useEffect(() => {
    if (initialLoadRef.current) return
    initialLoadRef.current = true
    const { sessionId, turnId } = getSessionParamsFromLocation()
    if (!sessionId) {
      clearSession()
      return
    }
    const parsedTurn = typeof turnId === 'number' && Number.isFinite(turnId) ? turnId : undefined
    loadSession(sessionId, parsedTurn, { historyMode: 'replace' })
  }, [clearSession, loadSession])

  useEffect(() => {
    const handlePopState = () => {
      const { sessionId, turnId } = getSessionParamsFromLocation()
      if (!sessionId) {
        clearSession()
        return
      }
      const parsedTurn = typeof turnId === 'number' && Number.isFinite(turnId) ? turnId : undefined
      loadSession(sessionId, parsedTurn, { historyMode: 'replace' })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [clearSession, loadSession])
}
