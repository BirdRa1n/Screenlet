import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../design-system/components";
import { ProgrammingRuleBlock } from "./ProgrammingRuleBlock";
import { ProgrammingRuleForm } from "./ProgrammingRuleForm";
import type { ProgrammingRule } from "../../types/programming";
import type { ExportedVideo } from "../../global";

type Props = {
  rules: ProgrammingRule[];
  exports: ExportedVideo[];
  onChange: (rules: ProgrammingRule[]) => void;
};

export const ProgrammingTimeline: React.FC<Props> = ({ rules, exports, onChange }) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ProgrammingRule | null>(null);

  const openNew = () => { setEditingRule(null); setFormOpen(true); };
  const openEdit = (rule: ProgrammingRule) => { setEditingRule(rule); setFormOpen(true); };

  const handleSave = (rule: ProgrammingRule) => {
    if (editingRule) {
      onChange(rules.map((r) => (r.id === rule.id ? rule : r)));
    } else {
      onChange([...rules, rule]);
    }
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="vt-prog-timeline">
      <div className="vt-prog-timeline__header">
        <div>
          <p className="vt-prog-timeline__sub">
            {rules.length === 0
              ? "Defina quais vídeos exibir em cada horário ou dia."
              : `${rules.length} regra${rules.length !== 1 ? "s" : ""} configurada${rules.length !== 1 ? "s" : ""}. A primeira regra que corresponder ao horário atual é exibida.`}
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={openNew}>
          Adicionar regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="vt-prog-timeline__empty">
          <p>Nenhuma regra configurada.</p>
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={openNew}>
            Adicionar primeira regra
          </Button>
        </div>
      ) : (
        <div className="vt-prog-timeline__list">
          {rules.map((rule, i) => (
            <ProgrammingRuleBlock
              key={rule.id}
              rule={rule}
              index={i}
              onEdit={() => openEdit(rule)}
              onDelete={() => handleDelete(rule.id)}
            />
          ))}
        </div>
      )}

      <ProgrammingRuleForm
        open={formOpen}
        rule={editingRule}
        exports={exports}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
};
