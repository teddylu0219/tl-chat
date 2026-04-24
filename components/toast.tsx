"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = {
  actionLabel?: string;
  id: number;
  message: string;
  onAction?: () => void;
};

type ToastContextValue = {
  showToast: (
    message: string,
    options?: { actionLabel?: string; onAction?: () => void },
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 0;

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: {
    actionLabel?: string;
    onAction?: () => void;
  }) => {
    const id = ++nextToastId;

    setToasts((current) => [
      ...current,
      {
        actionLabel: options?.actionLabel,
        id,
        message,
        onAction: options?.onAction,
      },
    ]);

    setTimeout(() => {
      dismissToast(id);
    }, 2000);
  }, [dismissToast]);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toasts.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="flex animate-[toast-enter_180ms_ease-out] items-center gap-3 rounded-full bg-[color:var(--foreground)] px-4 py-2.5 text-[13px] font-medium text-[color:var(--background)] shadow-lg"
            >
              <span>{toast.message}</span>
              {toast.actionLabel && toast.onAction ? (
                <button
                  className="rounded-full bg-[color:var(--background)]/12 px-2.5 py-1 text-[12px] font-semibold text-[color:var(--background)] transition hover:bg-[color:var(--background)]/20"
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    dismissToast(toast.id);
                  }}
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext>
  );
}
