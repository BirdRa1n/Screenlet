"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"div">, "ref"> & {
  selected?: boolean;
};

export const Card: React.FC<Props> = ({
  selected,
  className,
  children,
  ...rest
}) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors",
      selected && "border-primary ring-1 ring-primary",
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);
