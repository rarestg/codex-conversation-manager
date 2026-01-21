import { useCallback, useEffect, useRef, useState } from 'react'

export const useCopyFeedback = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const showCopied = useCallback((id: string, duration = 1500) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
    }
    setCopiedId(id)
    timeoutRef.current = window.setTimeout(() => {
      setCopiedId(null)
      timeoutRef.current = null
    }, duration)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { copiedId, showCopied }
}
