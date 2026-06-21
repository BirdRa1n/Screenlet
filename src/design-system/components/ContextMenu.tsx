"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ContextMenuItem =
  | {
      type: "item";
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      danger?: boolean;
    }
  | { type: "separator" };

type Props = {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
};

export const ContextMenu: React.FC<Props> = ({ items, x, y, onClose }) => {
  React.useEffect(() => {
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

  return createPortal(
    <div
      className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ top: y, left: x }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={i}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
              item.danger &&
                "text-destructive hover:bg-destructive/10 hover:text-destructive",
            )}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon ? (
              <span className="inline-flex size-4 items-center justify-center">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </button>
        ),
      )}
    </div>,
    document.body,
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
