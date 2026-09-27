"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setFailed(false);
          setUpdatedAt(Date.now());
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };
    void run();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void run();
      }
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, key, tick]);

  return { data, failed, updatedAt, refresh };
}
