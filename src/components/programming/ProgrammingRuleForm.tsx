import React, { useEffect, useState } from "react";
import { Button, Dialog, Field, SelectField, TextField } from "../../design-system/components";
import type { ProgrammingRule, ProgrammingSchedule, ScheduleDay } from "../../types/programming";
import type { ExportedVideo } from "../../global";

const DAY_OPTIONS: Array<{ value: ScheduleDay; label: string }> = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

type Props = {
  open: boolean;
  rule: ProgrammingRule | null;
  exports: ExportedVideo[];
  onSave: (rule: ProgrammingRule) => void;
  onClose: () => void;
};

export const ProgrammingRuleForm: React.FC<Props> = ({ open, rule, exports, onSave, onClose }) => {
  const [assetFilename, setAssetFilename] = useState("");
  const [scheduleType, setScheduleType] = useState<ProgrammingSchedule["type"]>("always");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<ScheduleDay[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (!open) return;
    if (rule) {
      setAssetFilename(rule.assetFilename);
      setScheduleType(rule.schedule.type);
      if (rule.schedule.type === "time-range") {
        setStartTime(rule.schedule.startTime);
        setEndTime(rule.schedule.endTime);
      }
      if (rule.schedule.type === "day-of-week") {
        setDays(rule.schedule.days);
      }
    } else {
      setAssetFilename(exports[0]?.filename ?? "");
      setScheduleType("always");
      setStartTime("08:00");
      setEndTime("18:00");
      setDays([1, 2, 3, 4, 5]);
    }
  }, [open, rule, exports]);

  const toggleDay = (d: ScheduleDay) => {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  };

  const buildSchedule = (): ProgrammingSchedule => {
    if (scheduleType === "time-range") return { type: "time-range", startTime, endTime };
    if (scheduleType === "day-of-week") return { type: "day-of-week", days };
    return { type: "always" };
  };

  const handleSave = () => {
    if (!assetFilename) return;
    const asset = exports.find((e) => e.filename === assetFilename);
    onSave({
      id: rule?.id ?? crypto.randomUUID(),
      assetFilename,
      assetName: asset?.name ?? assetFilename,
      schedule: buildSchedule(),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={rule ? "Editar regra" : "Nova regra de horário"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={!assetFilename}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="vt-prog-form">
        <Field label="Vídeo">
          {exports.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>
              Nenhum vídeo renderizado disponível. Exporte um vídeo primeiro.
            </p>
          ) : (
            <SelectField value={assetFilename} onChange={(e) => setAssetFilename(e.target.value)}>
              {exports.map((v) => (
                <option key={v.filename} value={v.filename}>{v.name}</option>
              ))}
            </SelectField>
          )}
        </Field>

        <Field label="Quando exibir">
          <SelectField
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as ProgrammingSchedule["type"])}
          >
            <option value="always">Sempre</option>
            <option value="time-range">Faixa horária</option>
            <option value="day-of-week">Dias da semana</option>
          </SelectField>
        </Field>

        {scheduleType === "time-range" && (
          <div className="vt-prog-form__row">
            <Field label="Início">
              <TextField type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Fim">
              <TextField type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>
        )}

        {scheduleType === "day-of-week" && (
          <Field label="Dias">
            <div className="vt-prog-form__days">
              {DAY_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`vt-prog-form__day${days.includes(value) ? " vt-prog-form__day--active" : ""}`}
                  onClick={() => toggleDay(value)}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Dialog>
  );
};
