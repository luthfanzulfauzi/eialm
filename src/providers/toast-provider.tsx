"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

type ToastInput = {
  title?: string;
  message: string;
  type?: ToastType;
};

type Toast = ToastInput & {
  id: string;
  type: ToastType;
};

type ToastContextValue = {
  notify: (toast: ToastInput) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const iconByType = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const toneByType: Record<ToastType, string> = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  error: "border-red-500/20 bg-red-500/10 text-red-100",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-100",
};

const iconToneByType: Record<ToastType, string> = {
  success: "text-emerald-300",
  error: "text-red-300",
  info: "text-blue-300",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const nextToast: Toast = {
        ...toast,
        id,
        type: toast.type ?? "info",
      };

      setToasts((current) => [nextToast, ...current].slice(0, 5));
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message, title) => notify({ type: "success", title, message }),
      error: (message, title) => notify({ type: "error", title, message }),
      info: (message, title) => notify({ type: "info", title, message }),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-[100] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = iconByType[toast.type] ?? AlertCircle;
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto rounded-lg border p-4 shadow-2xl shadow-black/30 backdrop-blur",
                toneByType[toast.type]
              )}
            >
              <div className="flex items-start gap-3">
                <Icon size={18} className={cn("mt-0.5 shrink-0", iconToneByType[toast.type])} />
                <div className="min-w-0 flex-1">
                  {toast.title ? <div className="text-sm font-bold text-white">{toast.title}</div> : null}
                  <div className="text-sm text-slate-200">{toast.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
