import { useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook that executes a callback at a fixed interval.
 * Handles cleanup automatically on unmount or when dependencies change.
 *
 * @param callback Function to execute at each interval
 * @param delay Interval duration in milliseconds (null to disable)
 * @param dependencies Optional dependency array (default: [])
 */
export const useInterval = (
  callback: () => void,
  delay: number | null,
  dependencies: any[] = []
): void => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  // Always keep the latest callback
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Set up the interval
  useEffect(() => {
    // Only set up interval if delay is not null
    if (delay !== null) {
      intervalRef.current = setInterval(() => {
        callbackRef.current()
      }, delay)
    }

    // Cleanup: clear interval on unmount or when delay changes
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [delay, ...dependencies]) // eslint-disable-line react-hooks/exhaustive-deps
}

export default useInterval
