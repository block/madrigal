import { useState, useEffect, useRef } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const INTERVAL = 22;

export default function useTextScramble(target: string, trigger: boolean): string {
  const [display, setDisplay] = useState(target);
  const frameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (!trigger) {
      setDisplay(target);
      return;
    }

    frameRef.current = 0;
    const len = target.length;

    timerRef.current = setInterval(() => {
      const frame = frameRef.current;
      let result = '';
      for (let i = 0; i < len; i++) {
        if (i < frame) {
          result += target[i];
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }
      setDisplay(result);
      frameRef.current++;

      if (frame >= len) {
        clearInterval(timerRef.current);
        setDisplay(target);
      }
    }, INTERVAL);

    return () => clearInterval(timerRef.current);
  }, [target, trigger]);

  return display;
}
