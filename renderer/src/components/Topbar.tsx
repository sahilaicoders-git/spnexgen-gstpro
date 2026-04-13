import { Calendar, CircleUserRound, Menu, Moon, Plus, Receipt, Repeat, Search, Sun, UserRoundSearch } from "lucide-react";
import type { ClientRecord } from "../types";

type Props = {
  activeMenu: string;
  selectedClient: ClientRecord;
  financialYear: string;
  financialYearOptions: string[];
  month: string;
  monthOptions: string[];
  onFinancialYearChange: (fy: string) => void;
  onMonthChange: (month: string) => void;
  onSwitchClient: () => void;
  onMenuToggle: () => void;
  onQuickAction: (menuId: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
};

const MENU_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "clients-add": "Add Client",
  "sales-add": "Add Sale",
  "sales-summary": "Sales Summary",
  "sales-export": "Export Sales",
  gstr1: "GSTR-1",
  gstr3b: "GSTR-3B",
  "purchase-import": "Import Purchases",
  "purchase-add": "Add Purchase",
  "purchase-summary": "Purchase Summary",
  "report-preview": "Reports",
  "report-monthly": "Monthly Report",
  "report-gst": "GST Report",
  "report-yearly": "Yearly Report",
  "util-calc": "GST Calculator",
  "util-hsn": "HSN Lookup",
  "util-invoice": "Invoice Generator",
  "util-backup": "Backup & Restore",
  "util-json": "JSON Viewer",
  settings: "Settings",
};

function prettyMenuName(value: string): string {
  return MENU_LABELS[value] ?? value.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Pill-style select wrapper
function PillSelect({
  icon,
  value,
  options,
  onChange,
  darkMode,
}: {
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  darkMode: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium cursor-pointer transition-all hover:brightness-105"
      style={
        darkMode
          ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }
          : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151" }
      }
    >
      <span className="opacity-60">{icon}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[13px] font-semibold outline-none cursor-pointer"
        style={{ color: darkMode ? "#e2e8f0" : "#1e293b" }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} style={{ background: darkMode ? "#0f172a" : "#fff", color: darkMode ? "#fff" : "#1e293b" }}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

export default function Topbar({
  activeMenu,
  selectedClient,
  financialYear,
  financialYearOptions,
  month,
  monthOptions,
  onFinancialYearChange,
  onMonthChange,
  onSwitchClient,
  onMenuToggle,
  onQuickAction,
  darkMode,
  onToggleTheme,
}: Props) {
  const title = prettyMenuName(activeMenu);

  return (
    <header
      className="sticky top-0 z-20 transition-all duration-300"
      style={
        darkMode
          ? {
              background: "linear-gradient(135deg, #0f172a 0%, #1a2540 60%, #111827 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
            }
          : {
              background: "#ffffff",
              borderBottom: "1px solid #e5e7eb",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }
      }
    >
      {/* Thin accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #3b82f6 0%, #06b6d4 40%, #10b981 80%, transparent 100%)" }}
      />

      <div className="relative flex min-h-[52px] flex-wrap items-center gap-3 px-4 py-2 sm:px-5">

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg p-2 transition-all hover:brightness-95 active:scale-95 lg:hidden"
          style={
            darkMode
              ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }
              : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#4b5563" }
          }
          aria-label="Open sidebar"
        >
          <Menu size={15} />
        </button>

        {/* Page title */}
        <div className="min-w-[120px]">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: darkMode ? "#475569" : "#9ca3af" }}
          >
            SPGST Pro
          </p>
          <p
            className="text-sm font-bold leading-tight"
            style={{ color: darkMode ? "#ffffff" : "#111827" }}
          >
            {title}
          </p>
        </div>

        {/* Separator */}
        <div
          className="hidden h-7 w-px lg:block"
          style={{ background: darkMode ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}
        />

        {/* Search bar */}
        <label
          className="hidden min-w-[200px] flex-1 max-w-xs items-center gap-2 rounded-lg px-3 py-1.5 cursor-text transition-all md:inline-flex"
          style={
            darkMode
              ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }
              : { background: "#f8fafc", border: "1px solid #e5e7eb", color: "#9ca3af" }
          }
        >
          <Search size={13} className="shrink-0 opacity-60" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-60"
            style={{ color: darkMode ? "#e2e8f0" : "#374151" }}
            placeholder="Search..."
          />
        </label>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Client badge */}
        <div
          className="hidden min-w-[160px] max-w-[220px] rounded-lg px-3 py-1.5 text-right lg:block"
          style={
            darkMode
              ? { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
              : { background: "#f1f5f9", border: "1px solid #e2e8f0" }
          }
        >
          <p
            className="truncate text-[12px] font-bold leading-tight"
            style={{ color: darkMode ? "#ffffff" : "#111827" }}
          >
            {selectedClient.clientName}
          </p>
          <p
            className="truncate font-mono text-[10px]"
            style={{ color: darkMode ? "#64748b" : "#6b7280" }}
          >
            {selectedClient.gstin}
          </p>
        </div>

        {/* Period selectors */}
        <PillSelect
          icon={<Calendar size={13} />}
          value={financialYear}
          options={financialYearOptions}
          onChange={onFinancialYearChange}
          darkMode={darkMode}
        />
        <PillSelect
          icon={<Repeat size={13} />}
          value={month}
          options={monthOptions}
          onChange={onMonthChange}
          darkMode={darkMode}
        />

        {/* Separator */}
        <div
          className="hidden h-7 w-px sm:block"
          style={{ background: darkMode ? "rgba(255,255,255,0.1)" : "#e5e7eb" }}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSwitchClient}
            title="Switch Client"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-105 active:scale-95"
            style={
              darkMode
                ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.25)", color: "#67e8f9" }
                : { background: "#ecfeff", border: "1px solid #a5f3fc", color: "#0891b2" }
            }
          >
            <UserRoundSearch size={13} />
            <span className="hidden sm:inline">Switch</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickAction("sales-add")}
            title="Add Sale"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Sale</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickAction("purchase-add")}
            title="Add Purchase"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-105 active:scale-95"
            style={
              darkMode
                ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1" }
                : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#374151" }
            }
          >
            <Receipt size={13} />
            <span className="hidden md:inline">Purchase</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded-lg p-2 transition-all hover:brightness-105 active:scale-95"
            style={
              darkMode
                ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }
                : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#4b5563" }
            }
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Profile avatar */}
          <button
            type="button"
            className="rounded-lg p-2 transition-all hover:brightness-105 active:scale-95"
            style={
              darkMode
                ? { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }
                : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#4b5563" }
            }
            aria-label="Profile"
          >
            <CircleUserRound size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
