import React from "react";
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

function scheduleIcon(rule: ProgrammingRule) {
  const { schedule } = rule;
  if (schedule.type === "always") return <Repeat size={12} />;
  return <Clock size={12} />;
}

type Props = {
  rule: ProgrammingRule;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
};

export const ProgrammingRuleBlock: React.FC<Props> = ({ rule, index, onEdit, onDelete }) => (
  <div className="vt-prog-rule">
    <div className="vt-prog-rule__index">{index + 1}</div>

    <div className="vt-prog-rule__icon">
      <Film size={14} />
    </div>

    <div className="vt-prog-rule__info">
      <span className="vt-prog-rule__name" title={rule.assetName}>{rule.assetName}</span>
      <span className="vt-prog-rule__schedule">
        {scheduleIcon(rule)}
        {scheduleLabel(rule)}
      </span>
    </div>

    <div className="vt-prog-rule__actions">
      <IconButton label="Editar regra" onClick={onEdit}><Pencil size={12} /></IconButton>
      <IconButton label="Remover regra" variant="danger" onClick={onDelete}><Trash2 size={12} /></IconButton>
    </div>
  </div>
);
