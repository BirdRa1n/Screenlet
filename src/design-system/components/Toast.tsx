import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useToastStore } from "../../store/useToastStore";
import "./Toast.css";

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="ds-toast-container">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.94 }}
            transition={{ duration: 0.2, ease: "easeOut" as const }}
            className={`ds-toast ds-toast--${t.type}`}
          >
            <span className="ds-toast__dot" />
            <span className="ds-toast__message">{t.message}</span>
            <button className="ds-toast__close" onClick={() => dismiss(t.id)}>
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
