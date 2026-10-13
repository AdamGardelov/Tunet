import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SUCCESS_DURATION = 1400;
const DEFAULT_ERROR_DURATION = 2200;

/**
 * Tracks short-lived feedback for asynchronous button actions.
 * Each key can run independently, which makes the hook suitable for compact
 * rows containing several controls.
 */
export default function useActionFeedback({
  successDuration = DEFAULT_SUCCESS_DURATION,
  errorDuration = DEFAULT_ERROR_DURATION,
} = {}) {
  const [statuses, setStatuses] = useState({});
  const timersRef = useRef(new Map());
  const generationsRef = useRef(new Map());

  const clearTimer = useCallback((key) => {
    const timer = timersRef.current.get(key);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(key);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const setTemporaryStatus = useCallback(
    (key, status, duration, generation) => {
      setStatuses((current) => ({ ...current, [key]: status }));
      clearTimer(key);
      const timer = setTimeout(() => {
        if (generationsRef.current.get(key) !== generation) return;
        setStatuses((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        timersRef.current.delete(key);
      }, duration);
      timersRef.current.set(key, timer);
    },
    [clearTimer]
  );

  const runAction = useCallback(
    async (key, action) => {
      clearTimer(key);
      const generation = (generationsRef.current.get(key) || 0) + 1;
      generationsRef.current.set(key, generation);
      setStatuses((current) => ({ ...current, [key]: 'pending' }));

      try {
        await action();
        if (generationsRef.current.get(key) !== generation) return false;
        setTemporaryStatus(key, 'success', successDuration, generation);
        return true;
      } catch (error) {
        if (generationsRef.current.get(key) === generation) {
          setTemporaryStatus(key, 'error', errorDuration, generation);
        }
        console.error('Dashboard action failed:', error);
        return false;
      }
    },
    [clearTimer, errorDuration, setTemporaryStatus, successDuration]
  );

  const getStatus = useCallback((key) => statuses[key] || 'idle', [statuses]);

  return { getStatus, runAction };
}
