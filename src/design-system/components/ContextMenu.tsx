import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import "../../styles/components/ContextMenu.css";

export type ContextMenuItem =
  | { type: "item"; label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }
  | { type: "separator" };

type Props = {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
};

export const ContextMenu: React.FC<Props> = ({ items, x, y, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [onClose]);

  // Prevent menu from going off-screen
  const style: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 9999,
  };

  return createPortal(
    <motion.div
      ref={ref}
      className="vt-ctx"
      style={style}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.1 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={i} className="vt-ctx__separator" />
        ) : (
          <button
            key={i}
            className={["vt-ctx__item", item.danger ? "vt-ctx__item--danger" : ""].join(" ")}
            onClick={() => { item.onClick(); onClose(); }}
          >
            {item.icon && <span className="vt-ctx__icon">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      )}
    </motion.div>,
    document.body
  );
};

type UseContextMenuReturn = {
  menuProps: { x: number; y: number; open: boolean };
  handleContextMenu: (e: React.MouseEvent) => void;
  close: () => void;
};

export function useContextMenu(): UseContextMenuReturn {
  const [state, setState] = React.useState({ x: 0, y: 0, open: false });
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, open: true });
  };
  const close = () => setState((s) => ({ ...s, open: false }));
  return { menuProps: state, handleContextMenu, close };
}
