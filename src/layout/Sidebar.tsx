import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  FolderOpen,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Settings,
  Video,
} from "lucide-react";
import { useNavigationStore, type Page } from "../store/useNavigationStore";
import "../styles/layout/Sidebar.css";

type NavItem = {
  icon: React.ReactNode;
  label: string;
  page?: Page;
  disabled?: boolean;
};

const NAV_MAIN: NavItem[] = [
  { icon: <LayoutGrid size={16} />, label: "Dashboard", page: "dashboard" },
  { icon: <FolderOpen size={16} />, label: "Projetos", page: "projects" },
  { icon: <LayoutTemplate size={16} />, label: "Templates", page: "templates" },
  { icon: <Images size={16} />, label: "Biblioteca", page: "library" },
  { icon: <Video size={16} />, label: "Vídeos Gerados", disabled: true },
];

const NAV_BOTTOM: NavItem[] = [
  { icon: <Settings size={16} />, label: "Configurações", page: "settings" },
];

export const Sidebar: React.FC = () => {
  const page = useNavigationStore((s) => s.page);
  const collapsed = useNavigationStore((s) => s.sidebarCollapsed);
  const navigate = useNavigationStore((s) => s.navigate);
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);

  return (
    <aside className={`vt-sidebar${collapsed ? " vt-sidebar--collapsed" : ""}`}>
      {/* Brand */}
      <div className="vt-sidebar__brand">
        {/* empty zone — macOS traffic lights float here */}
        <div className="vt-sidebar__brand-trafficzone" />
        <div className="vt-sidebar__brand-content">
          <span className="vt-sidebar__brand-icon">
            <Film size={16} strokeWidth={2.25} />
          </span>
          <span className="vt-sidebar__brand-name">AdFrame</span>
        </div>
      </div>

      {/* Collapse toggle — absolute inside sidebar, visible on hover */}
      <button
        className="vt-sidebar__toggle"
        onClick={toggleSidebar}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>



      {/* Nav */}
      <nav className="vt-sidebar__nav">
        <div className="vt-sidebar__nav-group">
          {NAV_MAIN.map((item) => (
            <NavButton
              key={item.label}
              item={item}
              active={!!item.page && item.page === page}
              collapsed={collapsed}
              onClick={() => item.page && navigate(item.page)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="vt-sidebar__footer">
        <div className="vt-sidebar_" />
        {NAV_BOTTOM.map((item) => (
          <NavButton
            key={item.label}
            item={item}
            active={!!item.page && item.page === page}
            collapsed={collapsed}
            onClick={() => item.page && navigate(item.page)}
          />
        ))}
      </div>

    </aside>
  );
};

const NavButton: React.FC<{
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}> = ({ item, active, onClick }) => (
  <button
    className={[
      "vt-sidebar__nav-item",
      active ? "vt-sidebar__nav-item--active" : "",
      item.disabled ? "vt-sidebar__nav-item--disabled" : "",
    ]
      .filter(Boolean)
      .join(" ")}
    onClick={onClick}
    data-label={item.label}
  >
    <span className="vt-sidebar__nav-icon">{item.icon}</span>
    <span className="vt-sidebar__nav-label">{item.label}</span>
  </button>
);
