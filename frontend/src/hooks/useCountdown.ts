"use client";

import { useEffect, useRef, useState } from "react";

export function useCountdown(endsAt: string | null, onExpire: () => void): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(null);
      return;
    }
    const target = new Date(endsAt).getTime();
    let expired = false;
    const tick = () => {
      const left = target - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0 && !expired) {
        expired = true;
        onExpireRef.current();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  return remaining;
}
