import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import "./Dialog.css";

type Size = "default" | "lg" | "xl";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export const Dialog: React.FC<Props> = ({
  open,
  onClose,
  title,
  description,
  size = "default",
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="ds-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className={`ds-dialog${size !== "default" ? ` ds-dialog--${size}` : ""}`}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" as const }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ds-dialog__header">
              <span className="ds-dialog__title">{title}</span>
              <button className="ds-dialog__close" onClick={onClose}>
                <X size={14} />
              </button>
            </div>

            {description && (
              <p className="ds-dialog__description">{description}</p>
            )}

            {children && <div className="ds-dialog__body">{children}</div>}

            {footer && <div className="ds-dialog__footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
