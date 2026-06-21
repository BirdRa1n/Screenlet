import { create } from "zustand";
import { toast as sonnerToast } from "sonner";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastStore = {
  toasts: Toast[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Forwarded to sonner — rendered by the <Toaster /> mounted in app/providers.tsx.
export const toast = {
  success: (msg: string) => sonnerToast.success(msg),
  error: (msg: string) => sonnerToast.error(msg),
  info: (msg: string) => sonnerToast(msg),
};
