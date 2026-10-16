import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_HOLD_MS = 6000;

/**
 * Keeps a value the user just sent on screen until the device reports it
 * back (or a timeout passes), so a slow device doesn't make the control
 * jump back to the old value in between.
 *
 * @template T
 * @param {T} remoteValue the value the device currently reports
 * @param {{ holdMs?: number }} [options]
 * @returns {[T, (value: T) => void]} the value to show, and a function to hold a sent value
 */
export default function useHeldValue(remoteValue, { holdMs = DEFAULT_HOLD_MS } = {}) {
  const [held, setHeld] = useState(/** @type {{ value: T } | null} */ (null));
  const timerRef = useRef(null);

  const hold = useCallback(
    (value) => {
      setHeld({ value });
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHeld(null), holdMs);
    },
    [holdMs]
  );

  useEffect(() => {
    if (held && Object.is(held.value, remoteValue)) {
      clearTimeout(timerRef.current);
      setHeld(null);
    }
  }, [held, remoteValue]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return [held ? held.value : remoteValue, hold];
}
