import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyFeedbackStatus = 'idle' | 'copied' | 'error';

export const useCopyFeedback = () => {
  const [status, setStatus] = useState<CopyFeedbackStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showFeedback = useCallback((nextStatus: CopyFeedbackStatus, nextMessage: string | null, duration = 1500) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setStatus(nextStatus);
    setMessage(nextMessage);
    timeoutRef.current = window.setTimeout(() => {
      setStatus('idle');
      setMessage(null);
      timeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { status, message, showFeedback };
};
