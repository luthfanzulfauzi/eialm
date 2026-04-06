"use client";

import { useEffect } from "react";

type Options = {
  intervalMs?: number;
};

export function ActivityPinger({ intervalMs = 30_000 }: Options) {
  useEffect(() => {
    let stopped = false;
    let lastPingAt = 0;

    const ping = async () => {
      if (stopped) return;
      const now = Date.now();
      if (now - lastPingAt < intervalMs) return;
      lastPingAt = now;

      try {
        await fetch("/api/activity", { method: "POST" });
      } catch {}
    };

    const onActivity = () => {
      void ping();
    };

    const onFocus = () => {
      void ping();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void ping();
      }
    };

    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return null;
}
