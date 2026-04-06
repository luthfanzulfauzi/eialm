"use client";

import { useEffect } from "react";

type Options = {
  intervalMs?: number;
};

export function ActivityPinger({ intervalMs = 30_000 }: Options) {
  useEffect(() => {
    let stopped = false;

    const ping = async () => {
      if (stopped) return;
      try {
        await fetch("/api/activity", { method: "POST" });
      } catch {}
    };

    ping();

    const interval = window.setInterval(ping, intervalMs);
    const onFocus = () => ping();
    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return null;
}
