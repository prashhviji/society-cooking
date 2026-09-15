"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn, uid } from "@/lib/utils";
import { useIsClient } from "./useIsClient";

export type ToastTone = "default" | "success" | "warning" | "error";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Defaults to 3000. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: ReactNode; accent: string }> = {
  default: { icon: <Info size={18} aria-hidden="true" />, accent: "text-text-2" },
  success: {
    icon: <CircleCheck size={18} aria-hidden="true" />,
    accent: "text-green-700",
  },
  warning: {
    icon: <TriangleAlert size={18} aria-hidden="true" />,
    accent: "text-orange-600",
  },
  error: { icon: <CircleAlert size={18} aria-hidden="true" />, accent: "text-red-600" },
};

/**
 * Wraps the app (or a single screen) so `useToast()` can raise transient
 * confirmations. Toasts stack at the top, inside the app shell width.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const isClient = useIsClient();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = uid();
      setItems((prev) => [...prev.slice(-2), { ...options, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options.duration ?? 3000),
      );
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed top-0 left-1/2 z-[60] flex w-full max-w-[var(--app-max-width)] -translate-x-1/2 flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
          >
            {items.map((t) => (
              <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const tone = TONE_STYLES[item.tone ?? "default"];

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-left shadow-raised",
        "transition-[opacity,transform] duration-200 ease-out",
        entered ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", tone.accent)}>{tone.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text">{item.title}</span>
        {item.description && (
          <span className="mt-0.5 block text-xs text-text-2">{item.description}</span>
        )}
      </span>
    </button>
  );
}

/** Raise a toast from any client component below a `ToastProvider`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a <ToastProvider>");
  return ctx;
}
