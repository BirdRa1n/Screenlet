"use client";

import * as React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip } from "./Tooltip";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"button">, "ref"> & {
  variant?: "default" | "danger";
  label: string;
  tooltip?: boolean;
};

export const IconButton: React.FC<Props> = ({
  variant = "default",
  label,
  tooltip = true,
  className,
  children,
  ...rest
}) => {
  const btn = (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        variant === "danger" &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );

  if (!tooltip) return btn;
  return <Tooltip label={label}>{btn}</Tooltip>;
};
