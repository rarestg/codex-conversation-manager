import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import { resolveSession, searchSessions } from '../api'
import type { SearchResult } from '../types'

interface UseSearchOptions {
  onError?: (message: string | null) => void
  onLoadSession: (sessionId: string, turnId?: number) => Promise<void> | void
}

export const useSearch = ({ onError, onLoadSession }: UseSearchOptions) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimeout = useRef<number | null>(null)
  const latestRequestId = useRef(0)
  const latestQuery = useRef('')

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    latestQuery.current = trimmedQuery
    latestRequestId.current += 1
    const requestId = latestRequestId.current
    if (!trimmedQuery) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current)
    }
    searchTimeout.current = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const results = await searchSessions(trimmedQuery, 40)
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return
        setSearchResults(results)
      } catch (error: any) {
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return
        onError?.(error?.message || 'Search failed.')
      } finally {
        if (requestId !== latestRequestId.current || latestQuery.current !== trimmedQuery) return
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current)
      }
    }
  }, [onError, searchQuery])

  const handleSearchKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return
      const query = searchQuery.trim()
      if (!query) return
      event.preventDefault()
      try {
        const resolved = await resolveSession(query)
        if (!resolved) return
        await onLoadSession(resolved)
        setSearchQuery('')
        setSearchResults([])
      } catch (error: any) {
        onError?.(error?.message || 'Unable to resolve session.')
      }
    },
    [onError, onLoadSession, searchQuery],
  )

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    handleSearchKeyDown,
    clearSearch,
  }
}
