"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = {
  id: number;
  message: string;
};

type ToastContextValue = {
  showToast: (message: string) => void;
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

  const showToast = useCallback((message: string) => {
    const id = ++nextToastId;

    setToasts((current) => [...current, { id, message }]);

    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2000);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {children}
      {toasts.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="animate-[toast-enter_180ms_ease-out] rounded-full bg-[color:var(--foreground)] px-4 py-2.5 text-[13px] font-medium text-[color:var(--background)] shadow-lg"
            >
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}
    </ToastContext>
  );
}
