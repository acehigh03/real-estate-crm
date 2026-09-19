"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Reply sentiments keyed by Telnyx message id. A reply is classified just after it is stored,
 * so `refreshSoon` re-reads them a couple of times after a new inbound message arrives.
 */
export function useSentiments(initial: Record<string, string>) {
  const [sentiments, setSentiments] = useState(initial);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/messages/sentiments", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.sentiments) setSentiments((current) => ({ ...current, ...data.sentiments }));
    } catch {
      // Badges are a nice-to-have: never surface a failure here.
    }
  }, []);

  const refreshSoon = useCallback(() => {
    for (const delay of [2500, 7000]) timers.current.push(setTimeout(() => void refresh(), delay));
  }, [refresh]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return { sentiments, refresh, refreshSoon };
}
