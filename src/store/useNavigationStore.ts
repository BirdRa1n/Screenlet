import { create } from "zustand";

export type Page =
  | "dashboard" | "wizard" | "editor"
  | "projects" | "library" | "templates" | "template-builder" | "template-wizard"
  | "renders"
  | "channels"
  | "iptv" | "settings";

type NavigationStore = {
  page: Page;
  sidebarCollapsed: boolean;
  editingTemplateId: string | null;
  navigate: (page: Page) => void;
  navigateToBuilder: (templateId?: string) => void;
  toggleSidebar: () => void;
};

export const useNavigationStore = create<NavigationStore>((set) => ({
  page: "dashboard",
  sidebarCollapsed: false,
  editingTemplateId: null,
  navigate: (page) => set({ page, editingTemplateId: null }),
  navigateToBuilder: (templateId) => set({ page: "template-builder", editingTemplateId: templateId ?? null }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
