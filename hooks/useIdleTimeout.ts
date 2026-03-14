import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to detect user inactivity
 * @param onIdle Callback function to execute when user is idle
 * @param timeout Timeout in milliseconds (default: 20 minutes)
 */
export const useIdleTimeout = (onIdle: () => void, timeout: number = 20 * 60 * 1000) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(onIdle, timeout);
  }, [onIdle, timeout]);

  useEffect(() => {
    // Events to monitor
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    // Initial timer set
    resetTimer();

    // Event handler wrapper
    const handleEvent = () => {
      resetTimer();
    };

    // Add listeners
    events.forEach(event => {
      document.addEventListener(event, handleEvent, true);
    });

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleEvent, true);
      });
    };
  }, [resetTimer]);
};
