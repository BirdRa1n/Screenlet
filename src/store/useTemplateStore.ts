import { create } from "zustand";
import type { Template } from "../remotion/template-types";
import { BUILTIN_TEMPLATES } from "../templates";

type TemplateStore = {
  templates: Template[];
  refresh: () => Promise<void>;
  save: (template: Template) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  exportTemplate: (id: string) => Promise<void>;
  importTemplate: (json: string) => Promise<void>;
};

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: BUILTIN_TEMPLATES,

  refresh: async () => {
    let user: Template[] = [];
    try {
      user = (await window.adFrame.templateList()) as Template[];
    } catch {
      user = [];
    }
    set({ templates: [...BUILTIN_TEMPLATES, ...user] });
  },

  save: async (template) => {
    const isBuiltin = BUILTIN_TEMPLATES.some((t) => t.id === template.id);
    if (isBuiltin) return;
    const updated = { ...template, updatedAt: new Date().toISOString() };
    await window.adFrame.templateSave(updated);
    await get().refresh();
  },

  remove: async (id) => {
    const isBuiltin = BUILTIN_TEMPLATES.some((t) => t.id === id);
    if (isBuiltin) return;
    await window.adFrame.templateDelete(id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  duplicate: async (id) => {
    const original = get().templates.find((t) => t.id === id);
    if (!original) return;
    const now = new Date().toISOString();
    const copy: Template = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (cópia)`,
      builtin: false,
      createdAt: now,
      updatedAt: now,
    };
    await window.adFrame.templateSave(copy);
    await get().refresh();
  },

  exportTemplate: async (id) => {
    const template = get().templates.find((t) => t.id === id);
    if (!template) return;
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.toLowerCase().replace(/\s+/g, "-")}.adframe.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importTemplate: async (json) => {
    const parsed = JSON.parse(json) as Template;
    const now = new Date().toISOString();
    const template: Template = {
      ...parsed,
      id: crypto.randomUUID(),
      builtin: false,
      createdAt: now,
      updatedAt: now,
    };
    await window.adFrame.templateSave(template);
    await get().refresh();
  },
}));
