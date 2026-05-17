import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const STATUS_URL = `${BASE}/api/downloads/user-guide/status`;

const POLL_FAST_MS = 3_000;
const POLL_SLOW_MS = 15_000;

export function useGuideGenerationStatus(): boolean {
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(generating);
  generatingRef.current = generating;

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(STATUS_URL);
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

    poll();

    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, []);

  return generating;
}
