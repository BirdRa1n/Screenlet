"use client";

import { Clock, Film, Pencil, Repeat, Trash2 } from "lucide-react";
import { IconButton } from "../../design-system/components";
import type { ProgrammingRule } from "../../types/programming";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function scheduleLabel(rule: ProgrammingRule): string {
  const { schedule } = rule;
  if (schedule.type === "always") return "Sempre";
  if (schedule.type === "time-range") return `${schedule.startTime} – ${schedule.endTime}`;
  if (schedule.type === "day-of-week") {
    const names = schedule.days.map((d) => DAY_LABELS[d]).join(", ");
    return names || "Nenhum dia";
  }
  return "";
}

function ScheduleIcon({ rule }: { rule: ProgrammingRule }) {
  if (rule.schedule.type === "always") return <Repeat size={12} />;
  return <Clock size={12} />;
}

type Props = {
  rule: ProgrammingRule;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
};

export const ProgrammingRuleBlock: React.FC<Props> = ({ rule, index, onEdit, onDelete }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {index + 1}
    </div>
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
      <Film size={14} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-sm font-medium" title={rule.assetName}>
        {rule.assetName}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <ScheduleIcon rule={rule} />
        {scheduleLabel(rule)}
      </span>
    </div>
    <div className="flex shrink-0 gap-1">
      <IconButton label="Editar regra" onClick={onEdit}>
        <Pencil size={12} />
      </IconButton>
      <IconButton label="Remover regra" variant="danger" onClick={onDelete}>
        <Trash2 size={12} />
      </IconButton>
    </div>
  </div>
);
