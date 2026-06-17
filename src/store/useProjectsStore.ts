import { create } from "zustand";
import type { ProjectMeta } from "../global";
import type { AdConfig } from "../remotion/types";

type ProjectsStore = {
  projects: ProjectMeta[];
  loading: boolean;

  refresh: () => Promise<void>;
  save: (config: AdConfig, name: string) => Promise<string>;
  load: (id: string) => Promise<AdConfig | null>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
};

export const useProjectsStore = create<ProjectsStore>((set) => ({
  projects: [],
  loading: false,

  refresh: async () => {
    set({ loading: true });
    const projects = await window.adFrame.projectsList();
    set({ projects, loading: false });
  },

  save: async (config, name) => {
    const id = await window.adFrame.projectsSave(config, name);
    const projects = await window.adFrame.projectsList();
    set({ projects });
    return id;
  },

  load: async (id) => {
    const config = await window.adFrame.projectsLoad(id);
    return config as AdConfig | null;
  },

  remove: async (id) => {
    await window.adFrame.projectsDelete(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  rename: async (id, name) => {
    await window.adFrame.projectsRename(id, name);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  },
}));
