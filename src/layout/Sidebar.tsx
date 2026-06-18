import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  FolderOpen,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Radio,
  Settings,
  Tv2,
} from "lucide-react";
import { useNavigationStore, type Page } from "../store/useNavigationStore";
import "../styles/layout/Sidebar.css";

type NavItem = {
  icon: React.ReactNode;
  label: string;
  page?: Page;
  disabled?: boolean;
};

const NAV_CONTENT: NavItem[] = [
  { icon: <LayoutGrid size={16} />, label: "Dashboard", page: "dashboard" },
  { icon: <FolderOpen size={16} />, label: "Projetos", page: "projects" },
  { icon: <LayoutTemplate size={16} />, label: "Templates", page: "templates" },
  { icon: <Images size={16} />, label: "Biblioteca", page: "library" },
  { icon: <Film size={16} />, label: "Vídeos", page: "renders" },
];

const NAV_PROGRAMMING: NavItem[] = [
  { icon: <Tv2 size={16} />, label: "Canais", page: "channels" },
];

const NAV_IPTV: NavItem[] = [
  { icon: <Radio size={16} />, label: "Servidor IPTV", page: "iptv" },
];

const NAV_BOTTOM: NavItem[] = [
  { icon: <Settings size={16} />, label: "Configurações", page: "settings" },
];

export const Sidebar: React.FC = () => {
  const page = useNavigationStore((s) => s.page);
  const collapsed = useNavigationStore((s) => s.sidebarCollapsed);
  const navigate = useNavigationStore((s) => s.navigate);
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);

  const isActive = (item: NavItem) => item.page === page;

  const makeGroup = (items: NavItem[]) =>
    items.map((item) => (
      <NavButton
        key={item.label}
        item={item}
        active={isActive(item)}
        onClick={() => item.page && navigate(item.page)}
      />
    ));

  return (
    <aside className={`vt-sidebar${collapsed ? " vt-sidebar--collapsed" : ""}`}>
      <div className="vt-sidebar__brand">
        <div className="vt-sidebar__brand-trafficzone" />
        <div className="vt-sidebar__brand-content">
          <span className="vt-sidebar__brand-icon">
            <Radio size={16} strokeWidth={2.25} />
          </span>
          <span className="vt-sidebar__brand-name">Screenlet</span>
        </div>
      </div>

      <button
        className="vt-sidebar__toggle"
        onClick={toggleSidebar}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <nav className="vt-sidebar__nav">
        <div className="vt-sidebar__nav-group">
          <span className="vt-sidebar__nav-section">Content Studio</span>
          {makeGroup(NAV_CONTENT)}
        </div>

        <div className="vt-sidebar__nav-divider" />

        <div className="vt-sidebar__nav-group">
          <span className="vt-sidebar__nav-section">Broadcasting</span>
          {makeGroup(NAV_PROGRAMMING)}
        </div>

        <div className="vt-sidebar__nav-divider" />

        <div className="vt-sidebar__nav-group">
          <span className="vt-sidebar__nav-section">IPTV Server</span>
          {makeGroup(NAV_IPTV)}
        </div>
      </nav>

      <div className="vt-sidebar__footer">
        {makeGroup(NAV_BOTTOM)}
      </div>
    </aside>
  );
};

const NavButton: React.FC<{
  item: NavItem;
  active: boolean;
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
