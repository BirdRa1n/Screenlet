import { create } from "zustand";

export type Page = "dashboard" | "wizard" | "editor" | "projects" | "settings";

type NavigationStore = {
  page: Page;
  sidebarCollapsed: boolean;
  navigate: (page: Page) => void;
  toggleSidebar: () => void;
};

export const useNavigationStore = create<NavigationStore>((set) => ({
  page: "dashboard",
  sidebarCollapsed: false,
  navigate: (page) => set({ page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
