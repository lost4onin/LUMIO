import { useRef, useEffect, useState, useCallback } from 'react';

export interface FocusEvent {
  focus_score: number;
  timestamp: number;
  blink_rate?: number;
  head_pose_x?: number;
  head_pose_y?: number;
  gaze_score?: number;
}

export interface CauseLabelResult {
  cause: string | null;
  confidence: number;
}

const BUFFER_SIZE = 10;
const POLL_INTERVAL_MS = 10000; // 10 seconds

/**
 * Hook that buffers focus events and periodically classifies the distraction cause.
 * Calls POST /analytics/classify every 10s with the last 10 focus events.
 *
 * Usage:
 *   const { cause, confidence } = useCauseLabel();
 *   // Push events as they arrive:
 *   useEffect(() => {
 *     const event = { focus_score: 0.5, timestamp: Date.now() };
 *     pushFocusEvent(event);
 *   }, [focusScore]);
 */
export const useCauseLabel = (apiBaseUrl: string = '/api') => {
  const bufferRef = useRef<FocusEvent[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<CauseLabelResult>({
    cause: null,
    confidence: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Add a focus event to the buffer.
   * Maintains a rolling window of BUFFER_SIZE events.
   */
  const pushFocusEvent = useCallback((event: FocusEvent) => {
    bufferRef.current.push(event);
    if (bufferRef.current.length > BUFFER_SIZE) {
      bufferRef.current.shift();
    }
  }, []);

  /**
   * Classify the current buffer of events.
   */
  const classifyBuffer = useCallback(async () => {
    if (bufferRef.current.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/analytics/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bufferRef.current),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setResult({
        cause: data.cause || null,
        confidence: data.confidence || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('useCauseLabel classification error:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  /**
   * Start polling for classification every 10 seconds.
   * Returns a cleanup function.
   */
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      classifyBuffer();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [classifyBuffer]);

  return {
    cause: result.cause,
    confidence: result.confidence,
    isLoading,
    error,
    pushFocusEvent,
    classifyBuffer,
  };
};

export default useCauseLabel;
