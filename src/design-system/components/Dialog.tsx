"use client";

import * as React from "react";
import {
  Dialog as ShadDialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Size = "default" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  default: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Hide the top-right close (X). Use for modals that must be acknowledged. */
  showCloseButton?: boolean;
};

export const Dialog: React.FC<Props> = ({
  open,
  onClose,
  title,
  description,
  size = "default",
  children,
  footer,
  showCloseButton = true,
}) => (
  <ShadDialog
    open={open}
    onOpenChange={(o) => {
      if (!o) onClose();
    }}
  >
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn(SIZE_MAP[size], "max-h-[85vh] overflow-y-auto")}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : null}
      </DialogHeader>

      {children}

      {footer ? <DialogFooter>{footer}</DialogFooter> : null}
    </DialogContent>
  </ShadDialog>
);
