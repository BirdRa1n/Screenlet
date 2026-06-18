import { create } from "zustand";

export type Page = "dashboard" | "wizard" | "editor" | "projects" | "library" | "templates" | "template-builder" | "template-wizard" | "channels" | "schedules" | "schedule-builder" | "iptv" | "settings";

type NavigationStore = {
  page: Page;
  sidebarCollapsed: boolean;
  editingTemplateId: string | null;
  editingScheduleId: string | null;
  navigate: (page: Page) => void;
  navigateToBuilder: (templateId?: string) => void;
  navigateToSchedule: (scheduleId: string) => void;
  toggleSidebar: () => void;
};

export const useNavigationStore = create<NavigationStore>((set) => ({
  page: "dashboard",
  sidebarCollapsed: false,
  editingTemplateId: null,
  editingScheduleId: null,
  navigate: (page) => set({ page, editingTemplateId: null, editingScheduleId: null }),
  navigateToBuilder: (templateId) => set({ page: "template-builder", editingTemplateId: templateId ?? null }),
  navigateToSchedule: (scheduleId) => set({ page: "schedule-builder", editingScheduleId: scheduleId }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
