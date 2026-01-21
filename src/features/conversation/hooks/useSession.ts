import { useCallback, useEffect, useState } from 'react'
import { fetchSession } from '../api'
import { extractSessionIdFromPath, parseJsonl } from '../parsing'
import { updateSessionUrl } from '../url'
import type { LoadSessionOptions, SessionDetails, SessionFileEntry, SessionTree, Turn } from '../types'

interface UseSessionOptions {
  sessionsTree: SessionTree | null
  onError?: (message: string | null) => void
}

export const useSession = ({ sessionsTree, onError }: UseSessionOptions) => {
  const [turns, setTurns] = useState<Turn[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [activeSession, setActiveSession] = useState<SessionFileEntry | null>(null)
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({})
  const [loadingSession, setLoadingSession] = useState(false)
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null)

  const clearSession = useCallback(() => {
    setActiveSession(null)
    setTurns([])
    setParseErrors([])
    setSessionDetails({})
    setScrollToTurnId(null)
    setLoadingSession(false)
  }, [])

  const findSessionById = useCallback(
    (sessionId: string) => {
      if (!sessionsTree) return null
      for (const year of sessionsTree.years) {
        for (const month of year.months) {
          for (const day of month.days) {
            const file = day.files.find((entry) => entry.id === sessionId)
            if (file) return file
          }
        }
      }
      return null
    },
    [sessionsTree],
  )

  const loadSession = useCallback(
    async (sessionId: string, turnId?: number, options?: LoadSessionOptions) => {
      const historyMode = options?.historyMode ?? 'push'
      updateSessionUrl(sessionId, turnId ?? null, historyMode)
      try {
        setLoadingSession(true)
        onError?.(null)
        const raw = await fetchSession(sessionId)
        const parsed = parseJsonl(raw)
        setTurns(parsed.turns)
        setParseErrors(parsed.errors)
        const meta =
          findSessionById(sessionId) ?? ({ id: sessionId, filename: sessionId, size: 0 } as SessionFileEntry)
        const fallbackSessionId = extractSessionIdFromPath(meta.filename || meta.id)
        const resolvedSessionId = parsed.sessionInfo.sessionId || fallbackSessionId || undefined
        const resolvedCwd = parsed.sessionInfo.cwd || meta.cwd || undefined
        setSessionDetails({ sessionId: resolvedSessionId, cwd: resolvedCwd })
        setActiveSession(meta)
        setScrollToTurnId(turnId ?? null)
      } catch (error: any) {
        onError?.(error?.message || 'Failed to load session.')
      } finally {
        setLoadingSession(false)
      }
    },
    [findSessionById, onError],
  )

  useEffect(() => {
    if (scrollToTurnId === null) return
    const element = document.getElementById(`turn-${scrollToTurnId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setScrollToTurnId(null)
  }, [scrollToTurnId, turns])

  return {
    turns,
    parseErrors,
    activeSession,
    sessionDetails,
    loadingSession,
    loadSession,
    clearSession,
  }
}
