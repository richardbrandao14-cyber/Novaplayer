import { useCallback, useEffect, useRef, useState } from "react";
export function useIdleControls(enabled: boolean, hold: boolean) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useCallback(() => {
    clearTimeout(timer.current);
    setIdle(false);
    if (enabled && !hold) timer.current = setTimeout(() => setIdle(true), 5000);
  }, [enabled, hold]);
  useEffect(() => {
    const initial = setTimeout(wake, 0);
    return () => {
      clearTimeout(initial);
      clearTimeout(timer.current);
    };
  }, [wake]);
  return { idle: enabled && !hold && idle, wake };
}
