"use client";

// Toasts are rendered by the <Toaster /> (sonner) mounted in app/providers.tsx,
// and the `toast` helper in src/store/useToastStore.ts forwards to sonner.
// This component is kept as a no-op so existing imports keep working.
export const ToastContainer = () => null;
