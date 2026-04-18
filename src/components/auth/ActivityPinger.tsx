"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

type Options = {
  intervalMs?: number;
};

export function ActivityPinger({ intervalMs = 30_000 }: Options) {
  const { data: session, status } = useSession();
  const lastPingAtRef = useRef(0);
  const lastActivityAtRef = useRef(Date.now());
  const timeoutIdRef = useRef<number | null>(null);
  const timeoutMinutes =
    typeof (session?.user as any)?.loginTimeout === "number" && (session?.user as any).loginTimeout > 0
      ? (session?.user as any).loginTimeout
      : 30;

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let stopped = false;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const clearTimeoutTimer = () => {
      if (timeoutIdRef.current !== null) {
        window.clearTimeout(timeoutIdRef.current);
      }
    };

    const handleTimeout = async () => {
      stopped = true;

      try {
        await fetch("/api/activity", {
          method: "DELETE",
          keepalive: true,
        });
      } catch {}

      await signOut({ callbackUrl: "/login?timedOut=1" });
    };

    const scheduleTimeout = () => {
      clearTimeoutTimer();
      timeoutIdRef.current = window.setTimeout(() => {
        if (stopped) return;
        void handleTimeout();
      }, timeoutMs);
    };

    const ping = async () => {
      if (stopped) return;
      const now = Date.now();
      const elapsedMs = now - lastActivityAtRef.current;

      if (elapsedMs >= timeoutMs) {
        await handleTimeout();
        return;
      }

      lastActivityAtRef.current = now;
      scheduleTimeout();

      if (now - lastPingAtRef.current < intervalMs) return;
      lastPingAtRef.current = now;

      try {
        await fetch("/api/activity", {
          method: "POST",
          keepalive: true,
        });
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

    void ping();

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
      clearTimeoutTimer();
    };
  }, [intervalMs, status, timeoutMinutes]);

  return null;
}
