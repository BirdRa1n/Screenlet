import React from "react";
import "../../styles/components/Field.css";

export const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => {
  return (
    <label className="ds-field">
      <span className="ds-field__label">{label}</span>
      {children}
      {hint ? <span className="ds-field__hint">{hint}</span> : null}
    </label>
  );
};

export const TextField: React.FC<
  React.InputHTMLAttributes<HTMLInputElement>
> = ({ className, ...rest }) => (
  <input className={`ds-input ${className ?? ""}`} {...rest} />
);

export const SelectField: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className, children, ...rest }) => (
  <select className={`ds-input ds-select ${className ?? ""}`} {...rest}>
    {children}
  </select>
);

export const ColorField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <label className="ds-color-field">
    <span
      className="ds-color-field__swatch"
      style={{ background: value }}
    />
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
    <span className="ds-color-field__label">{label}</span>
  </label>
);

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <label className="ds-checkbox">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="ds-checkbox__box" data-checked={checked} />
    {label}
  </label>
);
