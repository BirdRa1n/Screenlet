"use client";

import * as React from "react";
import { Progress } from "@/components/ui/progress";

export const ProgressBar: React.FC<{
  progress: number;
  label?: string;
}> = ({ progress, label }) => {
  const pct = Math.round(progress * 100);
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div className="flex items-center gap-2">
        <Progress value={pct} className="flex-1" />
        <span className="text-xs tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
    </div>
  );
};
