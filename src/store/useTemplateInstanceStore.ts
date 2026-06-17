import { create } from "zustand";
import type { Template, TemplateValues } from "../remotion/template-types";
import { defaultValues } from "../remotion/template-utils";

type TemplateInstanceStore = {
  template: Template | null;
  values: TemplateValues;
  step: number;
  setTemplate: (t: Template) => void;
  setValue: (key: string, value: string) => void;
  setStep: (step: number) => void;
  reset: () => void;
};

export const useTemplateInstanceStore = create<TemplateInstanceStore>((set) => ({
  template: null,
  values: {},
  step: 0,

  setTemplate: (template) =>
    set({ template, values: defaultValues(template), step: 0 }),

  setValue: (key, value) =>
    set((s) => ({ values: { ...s.values, [key]: value } })),

  setStep: (step) => set({ step }),

  reset: () => set({ template: null, values: {}, step: 0 }),
}));
