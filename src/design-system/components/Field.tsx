"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox as ShadCheckbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
    {hint ? (
      <span className="text-xs text-muted-foreground/80">{hint}</span>
    ) : null}
  </label>
);

export const TextField: React.FC<React.ComponentProps<"input">> = ({
  className,
  ...rest
}) => <Input className={cn(className)} {...rest} />;

export const SelectField: React.FC<React.ComponentProps<"select">> = ({
  className,
  children,
  ...rest
}) => (
  <select
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  >
    {children}
  </select>
);

export const ColorField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <label className="flex cursor-pointer items-center gap-2">
    <span
      className="relative inline-flex size-7 overflow-hidden rounded-md border border-border"
      style={{ background: value }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </span>
    <span className="text-sm text-foreground">{label}</span>
  </label>
);

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
    <ShadCheckbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
    />
    {label}
  </label>
);
