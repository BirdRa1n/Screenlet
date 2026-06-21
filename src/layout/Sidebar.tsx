"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  FolderOpen,
  HardDrive,
  Images,
  type LucideIcon,
  LayoutGrid,
  LayoutTemplate,
  MonitorPlay,
  Radio,
  Settings,
  Tv2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { icon: LucideIcon; label: string; href: string };

const NAV_CONTENT: NavItem[] = [
  { icon: LayoutGrid, label: "Dashboard", href: "/" },
  { icon: FolderOpen, label: "Projetos", href: "/projects" },
  { icon: LayoutTemplate, label: "Templates", href: "/templates" },
  { icon: HardDrive, label: "Media Hub", href: "/media-hub" },
  { icon: Images, label: "Produtos", href: "/library" },
  { icon: Film, label: "Vídeos", href: "/renders" },
];

const NAV_PROGRAMMING: NavItem[] = [
  { icon: Tv2, label: "Canais", href: "/channels" },
  { icon: MonitorPlay, label: "Dispositivos", href: "/devices" },
];

const NAV_IPTV: NavItem[] = [
  { icon: Radio, label: "Servidor IPTV", href: "/iptv" },
];

const NAV_BOTTOM: NavItem[] = [
  { icon: Settings, label: "Configurações", href: "/settings" },
];

function useIsMac() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(window.adFrame?.platform === "darwin");
  }, []);
  return isMac;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isMac = useIsMac();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      {/* Draggable window strip — leaves room for macOS traffic lights. */}
      <div
        className="h-7 w-full shrink-0"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      <div
        className={cn(
          "flex items-center gap-2.5 px-4 pb-3",
          isMac && !collapsed && "pl-4",
        )}
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Radio size={16} strokeWidth={2.25} />
        </span>
        {!collapsed && (
          <span className="truncate text-[15px] font-bold tracking-tight">
            Screenlet
          </span>
        )}
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-9 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2">
        <NavGroup
          title="Content Studio"
          items={NAV_CONTENT}
          collapsed={collapsed}
          isActive={isActive}
        />
        <NavGroup
          title="Broadcasting"
          items={NAV_PROGRAMMING}
          collapsed={collapsed}
          isActive={isActive}
        />
        <NavGroup
          title="IPTV Server"
          items={NAV_IPTV}
          collapsed={collapsed}
          isActive={isActive}
        />
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        {NAV_BOTTOM.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </aside>
  );
}

function NavGroup({
  title,
  items,
  collapsed,
  isActive,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  isActive: (href: string) => boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!collapsed && (
        <span className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </span>
      )}
      {items.map((item) => (
        <NavButton
          key={item.href}
          item={item}
          active={isActive(item.href)}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

function NavButton({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon size={16} className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
