import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderArchive, Save } from "lucide-react";
import AddClientForm from "../../src/ui/AddClientForm";
import ClientSelectionPage from "./components/ClientSelectionPage";
import DashboardPage from "./components/DashboardPage";
import Gstr1Page from "./components/Gstr1Page";
import Gstr3bPage from "./components/Gstr3bPage";
import GstSalesModule from "./components/GstSalesModule";
import GstOnlinePage from "./components/GstOnlinePage";
import PurchaseModule from "./components/PurchaseModule";
import ReportsPreviewDashboard from "./components/ReportsPreviewDashboard";
import ReportsModule from "./components/ReportsModule";
import Sidebar from "./components/Sidebar";
import SettingsSection from "./components/SettingsSection";
import TitleBar from "./components/TitleBar";
import Topbar from "./components/Topbar";
import UtilityModule from "./components/UtilityModule";
import type { ClientRecord, MonthPayload } from "./types";

const SELECTED_CLIENT_KEY = "spgst_selected_client";
const RECENT_CLIENTS_KEY = "spgst_recent_clients";
const SIDEBAR_COLLAPSED_KEY = "spgst_sidebar_collapsed";
const ACTIVE_MENU_KEY = "spgst_active_menu";
const THEME_KEY = "spgst_theme";

type ThemeMode = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

const QUARTERS = ["Apr-Jun", "Jul-Sep", "Oct-Dec", "Jan-Mar"];

function getCurrentMonthLabel(date = new Date()): string {
  const monthIndex = date.getMonth();
  const fiscalIndex = (monthIndex + 9) % 12;
  return MONTHS[fiscalIndex];
}

function getCurrentFinancialYearLabel(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return `FY_${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

function getFinancialYearRange(currentFyLabel: string, count = 5): string[] {
  const match = currentFyLabel.match(/FY_(\d{4})-\d{2}/);
  if (!match) return [currentFyLabel];
  const startYear = parseInt(match[1], 10);
  const range: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    range.push(`FY_${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  }
  return range;
}

function dedupeRecent(clients: ClientRecord[]): ClientRecord[] {
  const map = new Map<string, ClientRecord>();
  clients.forEach((c) => map.set(c.gstin, c));
  return Array.from(map.values()).slice(0, 8);
}

function prettifyMenu(menu: string): string {
  return menu
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function App() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [recentClients, setRecentClients] = useState<ClientRecord[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [route, setRoute] = useState<"client-selection" | "add-client" | "dashboard">("client-selection");
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [financialYear, setFinancialYear] = useState(getCurrentFinancialYearLabel());
  const [month, setMonth] = useState(getCurrentMonthLabel());
  const [monthData, setMonthData] = useState<MonthPayload | null>(null);
  const [monthDataEditor, setMonthDataEditor] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const lastEscapePressRef = useRef(0);

  const refreshClients = useCallback(async () => {
    if (!window.gstAPI) return;
    setLoadingClients(true);
    try {
      const list = await window.gstAPI.getClients();
      setClients(list);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadMonthData = useCallback(async (client: ClientRecord, fy: string, m: string) => {
    setLoadingData(true);
    setStatusText("Loading month data...");
    try {
      const data = await window.gstAPI.loadMonthData({ gstin: client.gstin, financialYear: fy, month: m });
      setMonthData(data);
      setMonthDataEditor(JSON.stringify(data, null, 2));
      setStatusText(`Loaded ${m} for ${client.clientName}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const selectedRaw = localStorage.getItem(SELECTED_CLIENT_KEY);
      const recentRaw = localStorage.getItem(RECENT_CLIENTS_KEY);

      if (selectedRaw) {
        setSelectedClient(JSON.parse(selectedRaw) as ClientRecord);
      }

      if (recentRaw) {
        setRecentClients(JSON.parse(recentRaw) as ClientRecord[]);
      }

      const collapsedRaw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (collapsedRaw) {
        setSidebarCompact(collapsedRaw === "1");
      }

      const activeMenuRaw = localStorage.getItem(ACTIVE_MENU_KEY);
      if (activeMenuRaw) {
        setActiveMenu(activeMenuRaw);
      }

      const themeRaw = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (themeRaw && THEME_OPTIONS.some((t) => t.id === themeRaw)) {
        setTheme(themeRaw);
      }

      await refreshClients();
      setLoadingApp(false);
    };

    init();
  }, [refreshClients]);

  useEffect(() => {
    if (!selectedClient || route !== "dashboard") return;
    loadMonthData(selectedClient, financialYear, month);
  }, [selectedClient, route, financialYear, month, loadMonthData]);

  useEffect(() => {
    if (activeMenu === "clients-select") {
      setRoute("client-selection");
      setActiveMenu("dashboard");
    }
  }, [activeMenu]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCompact ? "1" : "0");
  }, [sidebarCompact]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_MENU_KEY, activeMenu);
  }, [activeMenu]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      setIsDarkMode(dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        lastEscapePressRef.current = Date.now();
        return;
      }

      if (event.key !== "F1") return;

      const now = Date.now();
      const isEscapeF1Combo = now - lastEscapePressRef.current <= 1200;
      if (!isEscapeF1Combo) return;

      event.preventDefault();
      setRoute("client-selection");
      setMobileSidebarOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const periodOptions = useMemo(() => {
    if (selectedClient?.returnFrequency === "Quarterly") return QUARTERS;
    return MONTHS;
  }, [selectedClient]);

  useEffect(() => {
    if (!periodOptions.includes(month)) {
      setMonth(periodOptions[0]);
    }
  }, [periodOptions, month]);

  const handleSelectClient = async (client: ClientRecord) => {
    setSelectedClient(client);
    localStorage.setItem(SELECTED_CLIENT_KEY, JSON.stringify(client));

    const nextRecent = dedupeRecent([client, ...recentClients]);
    setRecentClients(nextRecent);
    localStorage.setItem(RECENT_CLIENTS_KEY, JSON.stringify(nextRecent));

    // Send selected client to Electron main process (global process-level context).
    window.gstAPI.notifyClientSelected(client);

    if (client.financialYears.length > 0) {
      const currentFy = getCurrentFinancialYearLabel();
      setFinancialYear(client.financialYears.includes(currentFy) ? currentFy : client.financialYears[0]);
    }

    setRoute("dashboard");
    setActiveMenu("dashboard");
    setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    setSelectedClient(null);
    localStorage.removeItem(SELECTED_CLIENT_KEY);
    setRoute("client-selection");
    setStatusText("Logged out successfully.");
  };

  const backupData = async () => {
    const result = await window.gstAPI.backupDataFolder();
    setStatusText(`Backup created: ${result.zipPath}`);
  };

  const generateTestData = async () => {
    if (!selectedClient) return;

    try {
      const result = await window.gstAPI.generateMockData({
        client: selectedClient,
        financialYear,
        month,
      });
      setStatusText(result.message);
      await loadMonthData(selectedClient, financialYear, month);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Unable to generate test data.");
    }
  };

  const generatePurchaseTestData = async () => {
    if (!selectedClient) return;

    try {
      const result = await window.gstAPI.generatePurchaseMock({
        client: selectedClient,
        financialYear,
        month,
      });
      setStatusText(`${result.total_generated} purchase records generated`);
      await loadMonthData(selectedClient, financialYear, month);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Unable to generate purchase test data.");
    }
  };

  const saveCurrentMonth = async () => {
    if (!selectedClient) return;

    try {
      const payload = JSON.parse(monthDataEditor) as MonthPayload;
      await window.gstAPI.saveMonthData({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        payload,
      });
      setMonthData(payload);
      setStatusText(`Saved ${month} for ${selectedClient.clientName}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Unable to save month data.");
    }
  };

  const financialYearOptions = useMemo(() => {
    const baseRange = getFinancialYearRange(getCurrentFinancialYearLabel());
    const options = new Set<string>([...baseRange, financialYear]);
    if (selectedClient) {
      (selectedClient.financialYears || []).forEach((fy) => options.add(fy));
    }
    return Array.from(options).sort((a, b) => b.localeCompare(a));
  }, [selectedClient, financialYear]);

  const clientSelectionFinancialYearOptions = useMemo(() => {
    const baseRange = getFinancialYearRange(getCurrentFinancialYearLabel());
    const options = new Set<string>([...baseRange, financialYear]);
    clients.forEach((client) => {
      (client.financialYears || []).forEach((fy) => options.add(fy));
    });
    return Array.from(options).sort((a, b) => b.localeCompare(a));
  }, [clients, financialYear]);

  const renderMainContent = () => {
    // selectedClient is guaranteed non-null here — every call site is guarded
    // by the `if (!selectedClient)` early-return above.
    const client = selectedClient!;

    if (activeMenu === "dashboard") {
      return (
        <DashboardPage
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          monthOptions={periodOptions}
          monthData={monthData}
          onQuickAction={(menuId) => setActiveMenu(menuId)}
        />
      );
    }

    if (activeMenu === "clients-add") {
      return (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <AddClientForm />
        </section>
      );
    }

    if (activeMenu === "sales-add") {
      return (
        <GstSalesModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="add"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "sales-summary") {
      return (
        <GstSalesModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="summary"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "sales-import") {
      return (
        <GstSalesModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="import"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "sales-export") {
      return (
        <GstSalesModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="export"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "gstr1") {
      return (
        <Gstr1Page
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          financialYearOptions={financialYearOptions}
          monthOptions={periodOptions}
          onChangeFinancialYear={setFinancialYear}
          onChangeMonth={setMonth}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "gstr3b") {
      return (
        <Gstr3bPage
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          financialYearOptions={financialYearOptions}
          monthOptions={periodOptions}
          onChangeFinancialYear={setFinancialYear}
          onChangeMonth={setMonth}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "purchase-import") {
      return (
        <PurchaseModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="import"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "purchase-add") {
      return (
        <PurchaseModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="add"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "purchase-summary") {
      return (
        <PurchaseModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode="summary"
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "report-preview") {
      return (
        <ReportsPreviewDashboard
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          onOpenReport={(menuId) => setActiveMenu(menuId)}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "report-monthly") {
      return (
        <ReportsModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          financialYearOptions={financialYearOptions}
          monthOptions={periodOptions}
          mode="monthly"
          onChangeFinancialYear={setFinancialYear}
          onChangeMonth={setMonth}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "report-gst") {
      return (
        <ReportsModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          financialYearOptions={financialYearOptions}
          monthOptions={periodOptions}
          mode="gst"
          onChangeFinancialYear={setFinancialYear}
          onChangeMonth={setMonth}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "report-yearly") {
      return (
        <ReportsModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          financialYearOptions={financialYearOptions}
          monthOptions={periodOptions}
          mode="yearly"
          onChangeFinancialYear={setFinancialYear}
          onChangeMonth={setMonth}
          onStatus={setStatusText}
        />
      );
    }

    if (["util-calc", "util-hsn", "util-invoice", "util-backup", "util-json"].includes(activeMenu)) {
      return (
        <UtilityModule
          selectedClient={client}
          financialYear={financialYear}
          month={month}
          mode={activeMenu as "util-calc" | "util-hsn" | "util-invoice" | "util-backup" | "util-json"}
          onStatus={setStatusText}
        />
      );
    }

    if (activeMenu === "online-login" || activeMenu === "online-dashboard") {
      return <GstOnlinePage initialMode={activeMenu === "online-login" ? "login" : "dashboard"} />;
    }

    if (activeMenu === "settings") {
      return (
        <SettingsSection
          selectedClient={selectedClient}
          theme={theme}
          onSetTheme={setTheme}
          onClientUpdated={async (updated) => {
            setSelectedClient(updated);
            localStorage.setItem(SELECTED_CLIENT_KEY, JSON.stringify(updated));
            await refreshClients();
            setStatusText(`Client "${updated.clientName}" updated successfully.`);
          }}
        />
      );
    }

    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">{prettifyMenu(activeMenu)}</h2>
        <p className="mt-1 text-sm text-slate-500">This module is ready for implementation with client/FY/month scoped data.</p>
        {monthData && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Current data context: {monthData.client_name} / {monthData.financial_year} / {monthData.month}
          </div>
        )}
      </section>
    );
  };

  if (loadingApp) {
    return (
      <div className="app-with-titlebar">
        <TitleBar darkMode={isDarkMode} />
        <div className="app-content-area grid place-items-center bg-slate-100">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">Loading clients...</div>
        </div>
      </div>
    );
  }

  if (route === "client-selection") {
    return (
      <div className="app-with-titlebar">
        <TitleBar darkMode={isDarkMode} />
        <div className="app-content-area w-full overflow-auto">
          <ClientSelectionPage
            clients={clients}
            loading={loadingClients}
            recentlyUsed={recentClients}
            financialYear={financialYear}
            financialYearOptions={clientSelectionFinancialYearOptions}
            month={month}
            monthOptions={periodOptions}
            onFinancialYearChange={setFinancialYear}
            onMonthChange={setMonth}
            onOpenAddClient={() => setRoute("add-client")}
            onSelectClient={handleSelectClient}
          />
        </div>
      </div>
    );
  }

  if (route === "add-client") {
    return (
      <div className="app-with-titlebar">
        <TitleBar darkMode={isDarkMode} />
        <div className="app-content-area">
          <AddClientForm
            onSaved={async () => {
              await refreshClients();
              setRoute("client-selection");
              setStatusText("Client saved successfully.");
            }}
            onCancel={() => setRoute("client-selection")}
          />
        </div>
      </div>
    );
  }

  if (!selectedClient) {
    return (
      <div className="app-with-titlebar">
        <TitleBar darkMode={isDarkMode} />
        <div className="app-content-area grid place-items-center bg-slate-100 p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-slate-600">Dashboard access requires a selected client.</p>
            <button
              type="button"
              onClick={() => setRoute("client-selection")}
              className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              Go to Client Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-with-titlebar text-slate-900 transition-colors duration-300 dark:text-slate-100" style={{ background: 'var(--app-bg)' }}>
      <TitleBar darkMode={isDarkMode} />

      <div className="app-content-area">
        <Sidebar
          activeMenu={activeMenu}
          onSelectMenu={(menuId) => {
            setActiveMenu(menuId);
            setMobileSidebarOpen(false);
          }}
          compact={sidebarCompact}
          onToggleCompact={() => setSidebarCompact((v) => !v)}
          selectedClientName={selectedClient.clientName}
          appVersion={"1.0.0"}
          onSwitchClient={() => {
            setRoute("client-selection");
            setMobileSidebarOpen(false);
          }}
          onLogout={handleLogout}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          darkMode={isDarkMode}
        />

        <div
          className={`flex h-full min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300 ${
            sidebarCompact ? "lg:ml-[80px]" : "lg:ml-[250px]"
          }`}
        >
          <Topbar
            activeMenu={activeMenu}
            selectedClient={selectedClient}
            financialYear={financialYear}
            financialYearOptions={financialYearOptions}
            month={month}
            monthOptions={periodOptions}
            onFinancialYearChange={setFinancialYear}
            onMonthChange={setMonth}
            onSwitchClient={() => setRoute("client-selection")}
            onMenuToggle={() => setMobileSidebarOpen((v) => !v)}
            onQuickAction={(menuId) => setActiveMenu(menuId)}
            darkMode={isDarkMode}
            onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          />

          <main className="flex-1 overflow-auto bg-[var(--content-bg)] p-4 transition-colors duration-300 sm:p-6">
            {statusText && <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 shadow-sm">{statusText}</div>}
            {loadingData && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Loading data...</div>
            )}
            {renderMainContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
