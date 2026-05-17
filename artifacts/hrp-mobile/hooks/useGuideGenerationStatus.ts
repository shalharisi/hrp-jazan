import { useEffect, useRef, useState } from "react";
import { getModuleToken } from "@/context/AuthContext";

const POLL_FAST_MS = 3_000;
const POLL_SLOW_MS = 15_000;

export function useGuideGenerationStatus(): boolean {
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(generating);
  generatingRef.current = generating;

  useEffect(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    const statusUrl = `https://${domain}/api/downloads/user-guide/status`;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const token = getModuleToken();
        if (!token) {
          // Not authenticated yet — skip this cycle and retry at slow interval
          if (!cancelled) {
            timerId = setTimeout(poll, POLL_SLOW_MS);
          }
          return;
        }
        const res = await fetch(statusUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { generating?: boolean };
          setGenerating(data.generating === true);
        }
      } catch {
        // ignore transient errors
      }

      if (!cancelled) {
        const delay = generatingRef.current ? POLL_FAST_MS : POLL_SLOW_MS;
        timerId = setTimeout(poll, delay);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  return generating;
}
