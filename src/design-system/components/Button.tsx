"use client";

import * as React from "react";
import { Button as ShadButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_MAP = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
} as const;

type Props = Omit<React.ComponentProps<"button">, "ref"> & {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
};

export const Button: React.FC<Props> = ({
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}) => {
  return (
    <ShadButton
      variant={VARIANT_MAP[variant]}
      size={size === "sm" ? "sm" : "default"}
      className={cn(className)}
      {...rest}
    >
      {icon}
      {children}
    </ShadButton>
  );
};
