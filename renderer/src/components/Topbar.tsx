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

function prettyMenuName(value: string): string {
  if (!value) return "Dashboard";
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
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
  const breadcrumb = `Home / ${title}`;

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--topbar-border)] bg-[var(--topbar-bg)] shadow-sm backdrop-blur transition-colors duration-300">
      <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu size={16} />
        </button>

        <div className="min-w-[200px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{breadcrumb}</p>
          <p className="text-base font-semibold text-[var(--topbar-text)]">{title}</p>
        </div>

        <label className="hidden min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 md:inline-flex">
          <Search size={14} />
          <input className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100" placeholder="Search invoices, GSTIN, client..." />
        </label>

        <div className="hidden min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right dark:border-slate-700 dark:bg-slate-800 lg:block">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{selectedClient.clientName}</p>
          <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-300">{selectedClient.gstin}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Calendar size={14} className="text-slate-500 dark:text-slate-300" />
            <select className="bg-transparent text-sm outline-none dark:text-slate-100" value={financialYear} onChange={(e) => onFinancialYearChange(e.target.value)}>
              {financialYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
            <Repeat size={14} className="text-slate-500 dark:text-slate-300" />
            <select className="bg-transparent text-sm outline-none dark:text-slate-100" value={month} onChange={(e) => onMonthChange(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onSwitchClient}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100"
          >
            <UserRoundSearch size={14} />
            Switch Client
          </button>

          <button
            type="button"
            onClick={() => onQuickAction("sales-add")}
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Plus size={14} />
            Add Sale
          </button>

          <button
            type="button"
            onClick={() => onQuickAction("purchase-add")}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <Receipt size={14} />
            Add Purchase
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            aria-label="Toggle dark mode"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button type="button" className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" aria-label="Profile settings">
            <CircleUserRound size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
