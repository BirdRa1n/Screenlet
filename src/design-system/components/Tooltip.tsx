"use client";

import * as React from "react";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Side = "top" | "bottom" | "left" | "right";

type Props = {
  label: string;
  side?: Side;
  children: React.ReactNode;
};

export const Tooltip: React.FC<Props> = ({ label, side = "top", children }) => (
  <ShadTooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side={side}>{label}</TooltipContent>
  </ShadTooltip>
);
