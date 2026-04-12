import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  FileText,
  Home,
  LogOut,
  Receipt,
  Settings,
  UserRoundSearch,
  Users,
  X,
} from "lucide-react";
import { sidebarMenuConfig } from "../config/sidebarMenu";

type Props = {
  activeMenu: string;
  onSelectMenu: (id: string) => void;
  compact: boolean;
  onToggleCompact: () => void;
  selectedClientName: string;
  appVersion: string;
  onSwitchClient: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  darkMode: boolean;
};

const iconMap = {
  home: Home,
  users: Users,
  receipt: Receipt,
  "file-text": FileText,
  "bar-chart": BarChart3,
  database: Database,
  calculator: Calculator,
  settings: Settings,
} as const;

export default function Sidebar({
  activeMenu,
  onSelectMenu,
  compact,
  onToggleCompact,
  selectedClientName,
  appVersion,
  onSwitchClient,
  onLogout,
  mobileOpen,
  onCloseMobile,
  darkMode,
}: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>("clients");
  const [hoverExpand, setHoverExpand] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const isCollapsed = compact && !hoverExpand;

  const themeStyles = darkMode
    ? {
        shell: "border-slate-700 text-slate-100",
        groupHover: "hover:bg-slate-800",
        groupActive: "bg-blue-600 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)]",
        childActive: "bg-blue-600/95 text-white",
        childIdle: "text-slate-300 hover:bg-slate-800 hover:text-white",
        softCard: "border-slate-700 bg-slate-900/60 text-slate-300",
        softBtn: "border-slate-700 bg-slate-800 text-slate-100",
      }
    : {
        shell: "border-slate-200 text-slate-700",
        groupHover: "hover:bg-slate-100",
        groupActive: "bg-blue-600 text-white shadow-[0_10px_25px_rgba(37,99,235,0.28)]",
        childActive: "bg-blue-600 text-white",
        childIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        softCard: "border-slate-200 bg-slate-50 text-slate-600",
        softBtn: "border-slate-300 bg-white text-slate-700",
      };

  const activeGroup = useMemo(() => {
    const match = sidebarMenuConfig.find((group) => group.id === activeMenu || group.children?.some((c) => c.id === activeMenu));
    return match?.id ?? null;
  }, [activeMenu]);

  useEffect(() => {
    const navNode = navRef.current;
    if (!navNode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const buttons = Array.from(
        navNode.querySelectorAll('button[data-sidebar-focusable="true"]')
      ) as HTMLButtonElement[];
      if (buttons.length === 0) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onToggleCompact();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = buttons.findIndex((btn) => btn === activeElement);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % buttons.length;
        buttons[nextIndex].focus();
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prevIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
        buttons[prevIndex].focus();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        buttons[0].focus();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
        return;
      }

      if ((event.key === "Enter" || event.key === " ") && currentIndex !== -1) {
        event.preventDefault();
        buttons[currentIndex].click();
      }
    };

    navNode.addEventListener("keydown", onKeyDown);
    return () => navNode.removeEventListener("keydown", onKeyDown);
  }, [onToggleCompact]);

  useEffect(() => {
    if (!mobileOpen) return;

    const navNode = navRef.current;
    if (!navNode) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;

    const focusables = Array.from(
      navNode.querySelectorAll('button[data-sidebar-focusable="true"]')
    ) as HTMLButtonElement[];
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseMobile();
        return;
      }

      if (event.key !== "Tab") return;

      const cycle = Array.from(
        navNode.querySelectorAll('button[data-sidebar-focusable="true"]')
      ) as HTMLButtonElement[];
      if (cycle.length === 0) return;

      const first = cycle[0];
      const last = cycle[cycle.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActiveRef.current?.focus?.();
    };
  }, [mobileOpen, onCloseMobile]);

  const content = (
    <aside
      ref={navRef}
      onMouseEnter={() => {
        if (compact) setHoverExpand(true);
      }}
      onMouseLeave={() => setHoverExpand(false)}
      className={`flex h-screen flex-col overflow-hidden border-r shadow-2xl transition-all duration-300 ease-in-out ${themeStyles.shell} ${
        isCollapsed ? "w-20" : "w-[250px]"
      } ${darkMode ? "bg-gray-900" : "bg-white"}`}
    >
      <div className={`flex h-16 items-center justify-between border-b px-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
        <div className="inline-flex items-center gap-2 overflow-hidden">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-900/40">
            <FileText size={16} />
          </div>
          {!isCollapsed && (
            <div>
              <span className="block text-sm font-semibold tracking-wide">SPGST Pro</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] opacity-70">Accounting Cloud</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCompact}
            title={isCollapsed ? "Expand" : "Collapse"}
            data-sidebar-focusable="true"
            className="rounded-lg p-2 opacity-75 transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:opacity-100"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 opacity-75 transition hover:bg-white/10 hover:opacity-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <nav className="thin-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-2">
        {sidebarMenuConfig.map((group) => {
          const Icon = iconMap[group.icon as keyof typeof iconMap] ?? Home;
          const hasChildren = Boolean(group.children?.length);
          const expanded = openGroupId === group.id;
          const groupActive = activeGroup === group.id;

          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                title={isCollapsed ? group.label : undefined}
                data-sidebar-focusable="true"
                onClick={() => {
                  if (!hasChildren) {
                    onSelectMenu(group.id);
                    onCloseMobile();
                    return;
                  }
                  setOpenGroupId((prev) => (prev === group.id ? null : group.id));
                }}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ${
                  groupActive ? `${themeStyles.groupActive} scale-[1.01] font-semibold` : themeStyles.groupHover
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full transition-all duration-300 ${
                    groupActive ? "bg-white/90 opacity-100" : "opacity-0"
                  }`}
                />
                <Icon size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                <span
                  className={`flex-1 text-left transition-all duration-300 ease-in-out ${
                    isCollapsed ? "pointer-events-none w-0 opacity-0" : "w-auto opacity-100"
                  }`}
                >
                  {group.label}
                </span>
                {!isCollapsed && hasChildren && <ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : ""}`} />}
                {isCollapsed && (
                  <span className="pointer-events-none absolute left-[72px] z-20 hidden whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white shadow-xl transition-all duration-200 group-hover:block">
                    {group.label}
                  </span>
                )}
              </button>

              {!isCollapsed && hasChildren && (
                <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className={`ml-6 mt-1 space-y-1 border-l pl-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
                    {group.children!.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        data-sidebar-focusable="true"
                        onClick={() => {
                          onSelectMenu(child.id);
                          onCloseMobile();
                        }}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all duration-300 hover:translate-x-0.5 ${
                          activeMenu === child.id ? `${themeStyles.childActive} font-semibold` : themeStyles.childIdle
                        }`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={`border-t p-3 ${darkMode ? "border-slate-700" : "border-slate-200"}`}>
        <div className={`rounded-xl border p-3 text-xs ${themeStyles.softCard}`}>
          {!isCollapsed ? (
            <>
              <div className={`rounded-lg border px-3 py-2 ${darkMode ? "border-slate-700 bg-slate-800/70" : "border-slate-200 bg-white"}`}>
                <p className="truncate text-sm font-semibold">GST Admin</p>
                <p className="text-[11px] opacity-70">Admin</p>
                <p className="mt-1 truncate text-[11px] opacity-70">{selectedClientName || "No client selected"}</p>
                <p className="text-[11px] opacity-70">v{appVersion}</p>
              </div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  data-sidebar-focusable="true"
                  onClick={() => {
                    onSwitchClient();
                    onCloseMobile();
                  }}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs transition ${themeStyles.softBtn} hover:brightness-110`}
                >
                  <UserRoundSearch size={13} />
                  Switch Client
                </button>
                <button
                  type="button"
                  data-sidebar-focusable="true"
                  onClick={() => {
                    onLogout();
                    onCloseMobile();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-2 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/60"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <button type="button" title="Switch Client" data-sidebar-focusable="true" onClick={onSwitchClient} className={`grid w-full place-items-center rounded-lg border p-2 transition ${themeStyles.softBtn} hover:brightness-110`}>
                <UserRoundSearch size={14} />
              </button>
              <button
                type="button"
                title="Sign Out"
                data-sidebar-focusable="true"
                onClick={onLogout}
                className="grid w-full place-items-center rounded-lg border border-rose-300 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/60"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          {!isCollapsed && <p className="mt-3 text-[11px] opacity-70">Shortcuts: Arrow keys navigate, Enter selects, Ctrl/Cmd + B toggles sidebar</p>}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">{content}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-slate-900/65" onClick={onCloseMobile} aria-label="Close sidebar overlay" />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
}
