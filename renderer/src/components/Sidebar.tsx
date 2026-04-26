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

// ── Per-group accent colours ───────────────────────────────────────────────────
const groupAccents: Record<string, { hex: string; glow: string }> = {
  dashboard:     { hex: "#f59e0b", glow: "rgba(245,158,11,0.25)"  },
  clients:       { hex: "#06b6d4", glow: "rgba(6,182,212,0.25)"   },
  sales:         { hex: "#10b981", glow: "rgba(16,185,129,0.25)"  },
  purchase:      { hex: "#8b5cf6", glow: "rgba(139,92,246,0.25)"  },
  "gst-returns": { hex: "#f43f5e", glow: "rgba(244,63,94,0.25)"   },
  reports:       { hex: "#3b82f6", glow: "rgba(59,130,246,0.25)"  },
  data:          { hex: "#f97316", glow: "rgba(249,115,22,0.25)"  },
  utilities:     { hex: "#a855f7", glow: "rgba(168,85,247,0.25)"  },
  online:        { hex: "#14b8a6", glow: "rgba(20,184,166,0.25)"  },
  settings:      { hex: "#64748b", glow: "rgba(100,116,139,0.18)" },
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ label, color, dark }: { label: string; color?: string; dark: boolean }) {
  return (
    <span
      className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2
        whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold
        opacity-0 shadow-2xl ring-1 transition-all duration-150 group-hover:opacity-100"
      style={{
        background: dark
          ? color ? `${color}dd` : "rgba(10,14,26,0.96)"
          : color ? `${color}f0` : "rgba(15,23,42,0.92)",
        color: "#fff",
        ringColor: "rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
      }}
    >
      {label}
    </span>
  );
}

export default function Sidebar({
  activeMenu, onSelectMenu, compact, onToggleCompact,
  selectedClientName, appVersion, onSwitchClient, onLogout,
  mobileOpen, onCloseMobile, darkMode,
}: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>("clients");
  const [hoverExpand, setHoverExpand] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const isCollapsed = compact && !hoverExpand;

  const activeGroup = useMemo(() => {
    const match = sidebarMenuConfig.find(
      (g) => g.id === activeMenu || g.children?.some((c) => c.id === activeMenu)
    );
    return match?.id ?? null;
  }, [activeMenu]);

  // Keyboard navigation
  useEffect(() => {
    const navNode = navRef.current;
    if (!navNode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const btns = Array.from(navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]'));
      if (!btns.length) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); onToggleCompact(); return; }
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

  // Mobile trap focus
  useEffect(() => {
    if (!mobileOpen) return;
    const navNode = navRef.current;
    if (!navNode) return;
    previousActiveRef.current = document.activeElement as HTMLElement;
    const focusables = Array.from(navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]'));
    focusables[0]?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCloseMobile(); return; }
      if (e.key !== "Tab") return;
      const cycle = Array.from(navNode.querySelectorAll<HTMLButtonElement>('button[data-sidebar-focusable="true"]'));
      const first = cycle[0]; const last = cycle[cycle.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousActiveRef.current?.focus?.(); };
  }, [mobileOpen, onCloseMobile]);

  // ── Theme tokens (Modern redesign) ──────────────────────────────────────────
  const T = darkMode ? {
    // Dark mode — rich deep navy with subtle warm tint
    sidebarBg:       "linear-gradient(180deg,#0f1629 0%,#121a30 50%,#0d1322 100%)",
    border:          "rgba(255,255,255,0.06)",
    shadow:          "4px 0 32px rgba(0,0,0,0.45), inset -1px 0 0 rgba(255,255,255,0.03)",
    labelColor:      "#e2e8f0",
    mutedLabel:      "#475569",
    childLabel:      "#64748b",
    childHover:      "#cbd5e1",
    iconBase:        "#475569",
    iconBaseBg:      "rgba(255,255,255,0.04)",
    hoverRowBg:      "rgba(255,255,255,0.05)",
    connectorLine:   "rgba(255,255,255,0.06)",
    cardBg:          "rgba(255,255,255,0.03)",
    cardBorder:      "rgba(255,255,255,0.07)",
    switchBtnBorder: "rgba(255,255,255,0.06)",
    switchBtnColor:  "#64748b",
    switchBtnHover:  "rgba(255,255,255,0.07)",
    switchBtnHoverColor: "#cbd5e1",
    footerHint:      "#1e293b",
    clientNameColor: "#e2e8f0",
    versionColor:    "#334155",
    toggleColor:     "#4b5563",
    toggleHover:     "rgba(255,255,255,0.06)",
    brandBadgeBg:    "linear-gradient(135deg,#6366f1 0%,#a855f7 100%)",
    brandBadgeShadow:"0 0 18px rgba(99,102,241,0.4), 0 4px 10px rgba(0,0,0,0.4)",
    avatarBg:        "linear-gradient(135deg,#6366f1,#a855f7)",
    avatarShadow:    "0 0 14px rgba(99,102,241,0.3)",
    sectionDivider:  "rgba(255,255,255,0.04)",
    headerBorderB:   "rgba(255,255,255,0.05)",
  } : {
    // Light mode — clean white with cool undertones
    sidebarBg:       "linear-gradient(180deg,#ffffff 0%,#fafbfe 50%,#f5f7fc 100%)",
    border:          "rgba(99,102,241,0.08)",
    shadow:          "4px 0 24px rgba(99,102,241,0.06), inset -1px 0 0 rgba(99,102,241,0.05)",
    labelColor:      "#1e293b",
    mutedLabel:      "#94a3b8",
    childLabel:      "#94a3b8",
    childHover:      "#334155",
    iconBase:        "#94a3b8",
    iconBaseBg:      "rgba(99,102,241,0.05)",
    hoverRowBg:      "rgba(99,102,241,0.06)",
    connectorLine:   "rgba(99,102,241,0.08)",
    cardBg:          "rgba(99,102,241,0.03)",
    cardBorder:      "rgba(99,102,241,0.08)",
    switchBtnBorder: "rgba(99,102,241,0.1)",
    switchBtnColor:  "#64748b",
    switchBtnHover:  "rgba(99,102,241,0.07)",
    switchBtnHoverColor: "#1e293b",
    footerHint:      "#cbd5e1",
    clientNameColor: "#0f172a",
    versionColor:    "#94a3b8",
    toggleColor:     "#94a3b8",
    toggleHover:     "rgba(99,102,241,0.06)",
    brandBadgeBg:    "linear-gradient(135deg,#6366f1 0%,#a855f7 100%)",
    brandBadgeShadow:"0 4px 14px rgba(99,102,241,0.3)",
    avatarBg:        "linear-gradient(135deg,#6366f1,#a855f7)",
    avatarShadow:    "0 4px 10px rgba(99,102,241,0.25)",
    sectionDivider:  "rgba(99,102,241,0.06)",
    headerBorderB:   "rgba(99,102,241,0.06)",
  };

  // ── Build sidebar ─────────────────────────────────────────────────────────────
  const content = (
    <aside
      ref={navRef}
      onMouseEnter={() => { if (compact) setHoverExpand(true); }}
      onMouseLeave={() => setHoverExpand(false)}
      className="flex flex-col overflow-hidden transition-all duration-300 ease-in-out"
      style={{
        width: isCollapsed ? 68 : 256,
        height: "calc(100vh - var(--titlebar-height, 38px))",
        background: T.sidebarBg,
        borderRight: `1px solid ${T.border}`,
        boxShadow: T.shadow,
      }}
    >

      {/* ── Brand header ─────────────────────────────────────────────────────── */}
      <div
        className="flex h-14 shrink-0 items-center justify-between overflow-hidden px-3"
        style={{ borderBottom: `1px solid ${T.headerBorderB}` }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all duration-300"
            style={{
              background: T.brandBadgeBg,
              boxShadow: T.brandBadgeShadow,
            }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <div
            className="min-w-0 overflow-hidden transition-all duration-300"
            style={{ width: isCollapsed ? 0 : 152, opacity: isCollapsed ? 0 : 1 }}
          >
            <p className="truncate text-sm font-bold tracking-tight" style={{ color: T.labelColor }}>
              SPGST Pro
            </p>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: T.mutedLabel }}>
              GST Accounting
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleCompact}
            title={isCollapsed ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
            data-sidebar-focusable="true"
            aria-label="Toggle sidebar"
            className="grid h-7 w-7 place-items-center rounded-lg transition-all duration-200"
            style={{ color: T.toggleColor }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.toggleHover; e.currentTarget.style.color = T.labelColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.toggleColor; }}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden grid h-7 w-7 place-items-center rounded-lg transition-all duration-200"
            style={{ color: T.toggleColor }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.toggleHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Close sidebar"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="thin-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">

        {!isCollapsed && (
          <p
            className="mb-2.5 px-2.5 text-[9px] font-bold uppercase tracking-[0.22em]"
            style={{ color: T.mutedLabel }}
          >
            Navigation
          </p>
        )}

        <div className="space-y-0.5">
          {sidebarMenuConfig.map((group) => {
            const Icon = iconMap[group.icon as keyof typeof iconMap] ?? Home;
            const hasChildren = Boolean(group.children?.length);
            const isExpanded = openGroupId === group.id;
            const groupIsActive = activeGroup === group.id;
            const accent = groupAccents[group.id] ?? groupAccents["settings"];
            const showDivider = group.id === "online" || group.id === "settings";

            // Active colours
            const activeIconBg  = hexToRgba(accent.hex, darkMode ? 0.18 : 0.12);
            const activeRowBg   = hexToRgba(accent.hex, darkMode ? 0.10 : 0.07);
            const activeTextColor = accent.hex;

            return (
              <div key={group.id}>
                {showDivider && (
                  <div className={`${isCollapsed ? "my-2 mx-1" : "my-2 mx-2"} h-px`} style={{ background: T.sectionDivider }} />
                )}

                {/* Group button */}
                <button
                  type="button"
                  data-sidebar-focusable="true"
                  onClick={() => {
                    if (!hasChildren) { onSelectMenu(group.id); onCloseMobile(); return; }
                    setOpenGroupId((prev) => (prev === group.id ? null : group.id));
                  }}
                  className="group relative flex w-full items-center rounded-xl px-2 py-1.5 outline-none transition-all duration-200"
                  style={{
                    gap: isCollapsed ? 0 : 10,
                    background: groupIsActive ? activeRowBg : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!groupIsActive) e.currentTarget.style.background = T.hoverRowBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!groupIsActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Active left bar */}
                  {groupIsActive && (
                    <span
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-300"
                      style={{
                        background: `linear-gradient(180deg,${accent.hex},${hexToRgba(accent.hex, 0.4)})`,
                        boxShadow: `0 0 8px ${accent.glow}`,
                      }}
                    />
                  )}

                  {/* Icon block */}
                  <span
                    className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
                    style={{
                      background: groupIsActive ? activeIconBg : T.iconBaseBg,
                      boxShadow: groupIsActive ? `0 0 12px ${accent.glow}` : "none",
                    }}
                  >
                    <Icon
                      size={15}
                      style={{ color: groupIsActive ? activeTextColor : T.iconBase }}
                    />
                    {isCollapsed && <Tooltip label={group.label} color={accent.hex} dark={darkMode} />}
                  </span>

                  {/* Label */}
                  <span
                    className="flex-1 truncate text-left text-[13px] font-semibold transition-all duration-300"
                    style={{
                      opacity: isCollapsed ? 0 : 1,
                      maxWidth: isCollapsed ? 0 : 170,
                      color: groupIsActive ? activeTextColor : T.labelColor,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {group.label}
                  </span>

                  {/* Chevron */}
                  {!isCollapsed && hasChildren && (
                    <ChevronDown
                      size={12}
                      className="mr-0.5 shrink-0 transition-transform duration-300"
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        color: groupIsActive ? activeTextColor : T.mutedLabel,
                        opacity: 0.7,
                      }}
                    />
                  )}
                </button>

                {/* Children accordion */}
                {!isCollapsed && hasChildren && (
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: isExpanded ? 480 : 0, opacity: isExpanded ? 1 : 0 }}
                  >
                    <div
                      className="relative ml-6 mt-0.5 pl-4 pb-1"
                      style={{ borderLeft: `1.5px solid ${T.connectorLine}` }}
                    >
                      <div className="space-y-0.5">
                        {group.children!.map((child) => {
                          const childActive = activeMenu === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              data-sidebar-focusable="true"
                              onClick={() => { onSelectMenu(child.id); onCloseMobile(); }}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] font-medium outline-none transition-all duration-200"
                              style={{
                                background: childActive ? hexToRgba(accent.hex, darkMode ? 0.12 : 0.08) : "transparent",
                                color: childActive ? activeTextColor : T.childLabel,
                              }}
                              onMouseEnter={(e) => {
                                if (!childActive) {
                                  e.currentTarget.style.background = T.hoverRowBg;
                                  e.currentTarget.style.color = T.childHover;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!childActive) {
                                  e.currentTarget.style.background = "transparent";
                                  e.currentTarget.style.color = T.childLabel;
                                }
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-200"
                                style={{
                                  background: childActive ? accent.hex : (darkMode ? "#1e293b" : "#d4d8e8"),
                                  boxShadow: childActive ? `0 0 6px ${accent.glow}` : "none",
                                  flexShrink: 0,
                                }}
                              />
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Bottom card ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 p-2" style={{ borderTop: `1px solid ${T.border}` }}>
        {isCollapsed ? (
          <div className="space-y-1">
            <button
              type="button"
              data-sidebar-focusable="true"
              onClick={onSwitchClient}
              className="group relative grid w-full place-items-center rounded-xl py-2 transition-all duration-200"
              style={{ color: T.switchBtnColor }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.switchBtnHover; e.currentTarget.style.color = T.switchBtnHoverColor; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.switchBtnColor; }}
            >
              <UserRoundSearch size={15} />
              <Tooltip label="Switch Client" dark={darkMode} />
            </button>
            <button
              type="button"
              data-sidebar-focusable="true"
              onClick={onLogout}
              className="group relative grid w-full place-items-center rounded-xl py-2 transition-all duration-200"
              style={{ color: "#ef4444" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <LogOut size={15} />
              <Tooltip label="Sign Out" color="#ef4444" dark={darkMode} />
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl p-3"
            style={{ background: T.cardBg, border: `1px solid ${T.cardBorder}` }}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black text-white"
                style={{
                  background: T.avatarBg,
                  boxShadow: T.avatarShadow,
                }}
              >
                {(selectedClientName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold leading-tight" style={{ color: T.clientNameColor }}>
                  {selectedClientName || "No client"}
                </p>
                <p className="font-mono text-[9px] tracking-wider" style={{ color: T.versionColor }}>v{appVersion}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                data-sidebar-focusable="true"
                onClick={() => { onSwitchClient(); onCloseMobile(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  color: T.switchBtnColor,
                  border: `1px solid ${T.switchBtnBorder}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.switchBtnHover; e.currentTarget.style.color = T.switchBtnHoverColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.switchBtnColor; }}
              >
                <UserRoundSearch size={12} />
                Switch Client
              </button>

              <button
                type="button"
                data-sidebar-focusable="true"
                onClick={() => { onLogout(); onCloseMobile(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  background: darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
                  color: "#ef4444",
                  border: `1px solid ${darkMode ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.12)"}`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.14)"}
                onMouseLeave={(e) => e.currentTarget.style.background = darkMode ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)"}
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>

            <p className="mt-2.5 text-[9px] leading-tight" style={{ color: T.footerHint }}>
              ↑↓ navigate · Enter select · Ctrl+B toggle
            </p>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div
        className="hidden lg:fixed lg:left-0 lg:z-30 lg:block"
        style={{ top: "var(--titlebar-height, 38px)", bottom: 0 }}
      >
        {content}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: darkMode ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.3)" }}
            onClick={onCloseMobile}
            aria-label="Close sidebar overlay"
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
}
