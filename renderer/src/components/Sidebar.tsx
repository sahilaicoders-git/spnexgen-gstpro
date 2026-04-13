import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Home,
  LogOut,
  Receipt,
  Settings,
  UserRoundSearch,
  Users,
  Wifi,
  X,
  Zap,
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
  wifi: Wifi,
  settings: Settings,
} as const;

// ── Tooltip on collapsed items ────────────────────────────────────────────────
function Tooltip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2
        whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white
        opacity-0 shadow-xl ring-1 ring-white/10 transition-all duration-150
        group-hover:opacity-100 dark:bg-slate-800"
    >
      {label}
      {/* Arrow */}
      <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-slate-800" />
    </span>
  );
}

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

  // Determine which group the active item belongs to
  const activeGroup = useMemo(() => {
    const match = sidebarMenuConfig.find(
      (g) => g.id === activeMenu || g.children?.some((c) => c.id === activeMenu)
    );
    return match?.id ?? null;
  }, [activeMenu]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const navNode = navRef.current;
    if (!navNode) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const btns = Array.from(
        navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]')
      );
      if (!btns.length) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleCompact();
        return;
      }

      const idx = btns.findIndex((b) => b === document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); btns[(idx + 1) % btns.length]?.focus(); }
      if (e.key === "ArrowUp")   { e.preventDefault(); btns[idx <= 0 ? btns.length - 1 : idx - 1]?.focus(); }
      if (e.key === "Home")      { e.preventDefault(); btns[0]?.focus(); }
      if (e.key === "End")       { e.preventDefault(); btns[btns.length - 1]?.focus(); }
      if ((e.key === "Enter" || e.key === " ") && idx !== -1) { e.preventDefault(); btns[idx].click(); }
    };

    navNode.addEventListener("keydown", onKeyDown);
    return () => navNode.removeEventListener("keydown", onKeyDown);
  }, [onToggleCompact]);

  // ── Mobile trap focus ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const navNode = navRef.current;
    if (!navNode) return;

    previousActiveRef.current = document.activeElement as HTMLElement;
    const focusables = Array.from(
      navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]')
    );
    focusables[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCloseMobile(); return; }
      if (e.key !== "Tab") return;
      const cycle = Array.from(
        navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]')
      );
      const first = cycle[0];
      const last  = cycle[cycle.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first)  { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && active === last)  { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActiveRef.current?.focus?.();
    };
  }, [mobileOpen, onCloseMobile]);

  // ── Sidebar shell ──────────────────────────────────────────────────────────
  const content = (
    <aside
      ref={navRef}
      onMouseEnter={() => { if (compact) setHoverExpand(true); }}
      onMouseLeave={() => setHoverExpand(false)}
      className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        width: isCollapsed ? 72 : 256,
        height: "calc(100vh - var(--titlebar-height, 38px))",
        background: darkMode
          ? "linear-gradient(180deg, #0f172a 0%, #0c1220 60%, #0a0f1c 100%)"
          : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        borderRight: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.08)",
        boxShadow: darkMode
          ? "4px 0 24px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.04)"
          : "4px 0 24px rgba(0,0,0,0.06)",
      }}
    >

      {/* ── Brand header ───────────────────────────────────────────── */}
      <div
        className="flex h-14 shrink-0 items-center justify-between overflow-hidden px-3"
        style={{
          borderBottom: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
        }}
      >
        {/* Logo mark */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl shadow-lg"
            style={{
              background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
              boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
            }}
          >
            <Zap size={14} className="text-white" />
          </div>

          <div
            className="min-w-0 overflow-hidden transition-all duration-300"
            style={{ width: isCollapsed ? 0 : 160, opacity: isCollapsed ? 0 : 1 }}
          >
            <p className="truncate text-sm font-bold tracking-tight" style={{ color: darkMode ? "#f1f5f9" : "#0f172a" }}>
              SPGST Pro
            </p>
            <p
              className="truncate text-[9px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: darkMode ? "#64748b" : "#94a3b8" }}
            >
              GST Accounting
            </p>
          </div>
        </div>

        {/* Collapse + Close buttons */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleCompact}
            title={isCollapsed ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
            data-sidebar-focusable="true"
            aria-label="Toggle sidebar"
            className="group relative grid h-7 w-7 place-items-center rounded-lg transition-all duration-200"
            style={{ color: darkMode ? "#64748b" : "#94a3b8" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden grid h-7 w-7 place-items-center rounded-lg transition-all duration-200"
            style={{ color: darkMode ? "#64748b" : "#94a3b8" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className="thin-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        {sidebarMenuConfig.map((group) => {
          const Icon = iconMap[group.icon as keyof typeof iconMap] ?? Home;
          const hasChildren = Boolean(group.children?.length);
          const isExpanded = openGroupId === group.id;
          const groupIsActive = activeGroup === group.id;

          return (
            <div key={group.id}>
              {/* Group / single item button */}
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
                className="group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm outline-none transition-all duration-200"
                style={{
                  background: groupIsActive
                    ? darkMode
                      ? "linear-gradient(90deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.08) 100%)"
                      : "linear-gradient(90deg, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.04) 100%)"
                    : "transparent",
                  color: groupIsActive
                    ? darkMode ? "#a5b4fc" : "#0891b2"
                    : darkMode ? "#94a3b8" : "#64748b",
                }}
                onMouseEnter={(e) => {
                  if (!groupIsActive) {
                    e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
                    e.currentTarget.style.color = darkMode ? "#e2e8f0" : "#1e293b";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!groupIsActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = darkMode ? "#94a3b8" : "#64748b";
                  }
                }}
              >
                {/* Active indicator bar */}
                {groupIsActive && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                    style={{
                      background: darkMode
                        ? "linear-gradient(180deg,#818cf8,#6366f1)"
                        : "linear-gradient(180deg,#22d3ee,#0891b2)",
                    }}
                  />
                )}

                {/* Icon */}
                <span
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200"
                  style={{
                    background: groupIsActive
                      ? darkMode ? "rgba(99,102,241,0.2)" : "rgba(6,182,212,0.15)"
                      : "transparent",
                  }}
                >
                  <Icon size={15} />
                  {/* Tooltip (collapsed only) */}
                  {isCollapsed && <Tooltip label={group.label} />}
                </span>

                {/* Label */}
                <span
                  className="flex-1 truncate text-left font-medium transition-all duration-300"
                  style={{
                    opacity: isCollapsed ? 0 : 1,
                    maxWidth: isCollapsed ? 0 : 200,
                  }}
                >
                  {group.label}
                </span>

                {/* Chevron */}
                {!isCollapsed && hasChildren && (
                  <ChevronDown
                    size={13}
                    className="shrink-0 transition-transform duration-300"
                    style={{
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      opacity: 0.5,
                    }}
                  />
                )}
              </button>

              {/* Children accordion */}
              {!isCollapsed && hasChildren && (
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: isExpanded ? 300 : 0, opacity: isExpanded ? 1 : 0 }}
                >
                  <div className="ml-9 mt-0.5 space-y-0.5 py-0.5">
                    {group.children!.map((child) => {
                      const childActive = activeMenu === child.id;
                      return (
                        <button
                          key={child.id}
                          type="button"
                          data-sidebar-focusable="true"
                          onClick={() => { onSelectMenu(child.id); onCloseMobile(); }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium outline-none transition-all duration-200"
                          style={{
                            background: childActive
                              ? darkMode ? "rgba(99,102,241,0.18)" : "rgba(6,182,212,0.12)"
                              : "transparent",
                            color: childActive
                              ? darkMode ? "#a5b4fc" : "#0891b2"
                              : darkMode ? "#64748b" : "#94a3b8",
                          }}
                          onMouseEnter={(e) => {
                            if (!childActive) {
                              e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
                              e.currentTarget.style.color = darkMode ? "#cbd5e1" : "#334155";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!childActive) {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = darkMode ? "#64748b" : "#94a3b8";
                            }
                          }}
                        >
                          {/* Active dot */}
                          <span
                            className="h-1 w-1 shrink-0 rounded-full transition-all duration-200"
                            style={{
                              background: childActive
                                ? darkMode ? "#818cf8" : "#0891b2"
                                : darkMode ? "#334155" : "#cbd5e1",
                              transform: childActive ? "scale(1.4)" : "scale(1)",
                            }}
                          />
                          {child.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom user card ───────────────────────────────────────── */}
      <div
        className="shrink-0 p-2"
        style={{
          borderTop: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
        }}
      >
        {/* Collapsed: icon buttons only */}
        {isCollapsed ? (
          <div className="space-y-1">
            <button
              type="button"
              title="Switch Client"
              data-sidebar-focusable="true"
              onClick={onSwitchClient}
              className="group relative grid w-full place-items-center rounded-xl py-2 transition-all duration-200"
              style={{ color: darkMode ? "#64748b" : "#94a3b8" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"; e.currentTarget.style.color = darkMode ? "#e2e8f0" : "#1e293b"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = darkMode ? "#64748b" : "#94a3b8"; }}
            >
              <UserRoundSearch size={16} />
              <Tooltip label="Switch Client" />
            </button>
            <button
              type="button"
              title="Sign Out"
              data-sidebar-focusable="true"
              onClick={onLogout}
              className="group relative grid w-full place-items-center rounded-xl py-2 transition-all duration-200"
              style={{ color: "#ef4444" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <LogOut size={16} />
              <Tooltip label="Sign Out" />
            </button>
          </div>
        ) : (
          /* Expanded: rich card */
          <div
            className="rounded-xl p-3 transition-all duration-300"
            style={{
              background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
              border: darkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.07)",
            }}
          >
            {/* Avatar + client info */}
            <div className="mb-3 flex items-center gap-2.5 overflow-hidden">
              {/* Avatar */}
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white shadow"
                style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }}
              >
                {(selectedClientName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p
                  className="truncate text-xs font-semibold"
                  style={{ color: darkMode ? "#e2e8f0" : "#1e293b" }}
                >
                  {selectedClientName || "No client"}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: darkMode ? "#475569" : "#94a3b8" }}
                >
                  v{appVersion}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-1.5">
              <button
                type="button"
                data-sidebar-focusable="true"
                onClick={() => { onSwitchClient(); onCloseMobile(); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200"
                style={{
                  background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                  color: darkMode ? "#94a3b8" : "#64748b",
                  border: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.07)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = darkMode ? "#e2e8f0" : "#1e293b"; e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = darkMode ? "#94a3b8" : "#64748b"; e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"; }}
              >
                <UserRoundSearch size={13} />
                Switch Client
              </button>

              <button
                type="button"
                data-sidebar-focusable="true"
                onClick={() => { onLogout(); onCloseMobile(); }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.18)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>

            {!isCollapsed && (
              <p
                className="mt-2.5 text-[9px] leading-tight"
                style={{ color: darkMode ? "#334155" : "#cbd5e1" }}
              >
                ↑↓ navigate · Enter select · Ctrl+B toggle
              </p>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div
        className="hidden lg:fixed lg:left-0 lg:z-30 lg:block"
        style={{ top: "var(--titlebar-height, 38px)", bottom: 0 }}
      >
        {content}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={onCloseMobile}
            aria-label="Close sidebar overlay"
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
}
