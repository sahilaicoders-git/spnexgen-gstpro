import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Calendar, Plus, Search, UserCheck } from "lucide-react";
import type { ClientMonthReturnSnapshot, ClientRecord, ClientStatusRow, ReturnStatusValue } from "../types";

type Props = {
  clients: ClientRecord[];
  loading: boolean;
  recentlyUsed: ClientRecord[];
  financialYear: string;
  financialYearOptions: string[];
  month: string;
  monthOptions: string[];
  onFinancialYearChange: (fy: string) => void;
  onMonthChange: (month: string) => void;
  onOpenAddClient: () => void;
  onSelectClient: (client: ClientRecord) => void;
};

type ClientWithStatus = {
  client: ClientRecord;
  current: ClientMonthReturnSnapshot | null;
  previous: ClientMonthReturnSnapshot | null;
  pendingRank: number;
  overdueRank: number;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function getAlphaGroup(name: string): string {
  const first = String(name || "").trim().charAt(0).toUpperCase();
  if (!first) return "#";
  return /^[A-Z]$/.test(first) ? first : "#";
}

function statusColor(visualStatus: ReturnStatusValue): string {
  if (visualStatus === "filed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (visualStatus === "not-started") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
}

function statusLabel(visualStatus: ReturnStatusValue): string {
  if (visualStatus === "filed") return "Filed";
  if (visualStatus === "not-started") return "Not Started";
  return "Pending";
}

function indicatorDotClass(visualStatus: ReturnStatusValue): string {
  if (visualStatus === "filed") return "bg-emerald-500";
  if (visualStatus === "not-started") return "bg-amber-500";
  return "bg-rose-500";
}

function dueText(dueInDays: number | null): string {
  if (dueInDays === null) return "";
  if (dueInDays < 0) return `Overdue by ${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? "" : "s"}`;
  if (dueInDays === 0) return "Due today";
  return `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}`;
}

export default function ClientSelectionPage({
  clients,
  loading,
  recentlyUsed,
  financialYear,
  financialYearOptions,
  month,
  monthOptions,
  onFinancialYearChange,
  onMonthChange,
  onOpenAddClient,
  onSelectClient,
}: Props) {
  const [search, setSearch] = useState("");
  const [alphabetFilter, setAlphabetFilter] = useState<string>("ALL");
  const [showPreviousMonth, setShowPreviousMonth] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusRows, setStatusRows] = useState<Record<string, ClientStatusRow>>({});
  const [statusInfo, setStatusInfo] = useState<string>("");
  const [actionBusyKey, setActionBusyKey] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadStatuses = useCallback(async () => {
    if (!window.gstAPI || loading) return;

    setStatusLoading(true);
    try {
      const response = await window.gstAPI.loadClientStatus({
        financialYear,
        month,
        includePreviousMonth: showPreviousMonth,
      });
      const nextMap: Record<string, ClientStatusRow> = {};
      response.rows.forEach((row) => {
        nextMap[row.gstin] = row;
      });
      setStatusRows(nextMap);
    } finally {
      setStatusLoading(false);
    }
  }, [financialYear, month, showPreviousMonth, loading]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  const visibleRecent = useMemo(() => {
    const currentGstins = new Set(clients.map((c) => c.gstin));
    return recentlyUsed.filter((c) => currentGstins.has(c.gstin));
  }, [clients, recentlyUsed]);

  const sortedClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = [...clients]
      .sort((a, b) => a.clientName.localeCompare(b.clientName, "en", { sensitivity: "base" }))
      .filter((c) => {
        if (alphabetFilter === "ALL") return true;
        const group = getAlphaGroup(c.clientName);
        return alphabetFilter === "#" ? group === "#" : group === alphabetFilter;
      })
      .filter((c) => {
        if (!q) return true;
        return c.clientName.toLowerCase().includes(q) || c.gstin.toLowerCase().includes(q);
      });

    const enriched: ClientWithStatus[] = base.map((client) => {
      const row = statusRows[client.gstin];
      const current = row?.current ?? null;
      const previous = row?.previous ?? null;
      const pendingRank = current && current.pendingCount === 0 ? 1 : 0;
      const overdueRank = current?.hasOverdue ? 0 : 1;
      return { client, current, previous, pendingRank, overdueRank };
    });

    return enriched.sort((a, b) => {
      if (a.overdueRank !== b.overdueRank) return a.overdueRank - b.overdueRank;
      if (a.pendingRank !== b.pendingRank) return a.pendingRank - b.pendingRank;
      return a.client.clientName.localeCompare(b.client.clientName, "en", { sensitivity: "base" });
    });
  }, [clients, search, alphabetFilter, statusRows]);

  const groupedClients = useMemo(() => {
    const map = new Map<string, ClientWithStatus[]>();
    sortedClients.forEach((entry) => {
      const key = getAlphaGroup(entry.client.clientName);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    });

    const orderedKeys = [...LETTERS, "#"];
    return orderedKeys.filter((key) => map.has(key)).map((key) => ({ key, clients: map.get(key) || [] }));
  }, [sortedClients]);

  const selectedByGstin = useMemo(() => {
    const map = new Map<string, number>();
    sortedClients.forEach((entry, idx) => map.set(entry.client.gstin, idx));
    return map;
  }, [sortedClients]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, alphabetFilter, sortedClients.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(sortedClients.length - 1, 0)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && sortedClients[selectedIndex]) {
        e.preventDefault();
        onSelectClient(sortedClients[selectedIndex].client);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sortedClients, selectedIndex, onSelectClient]);

  useEffect(() => {
    const active = sortedClients[selectedIndex];
    if (!active) return;

    const rowEl = rowRefs.current[active.client.gstin];
    if (!rowEl) return;

    rowEl.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, sortedClients]);

  const handleMarkFiled = useCallback(
    async (client: ClientRecord, returnType: "gstr1" | "gstr3b" | "both") => {
      if (!window.gstAPI) return;

      const busyKey = `${client.gstin}-${returnType}`;
      setActionBusyKey(busyKey);
      setStatusInfo("");

      try {
        if (returnType === "both") {
          await window.gstAPI.updateReturnStatus({
            gstin: client.gstin,
            financialYear,
            month,
            returnType: "gstr1",
            status: "filed",
          });
          await window.gstAPI.updateReturnStatus({
            gstin: client.gstin,
            financialYear,
            month,
            returnType: "gstr3b",
            status: "filed",
          });
          setStatusInfo(`${client.clientName}: GSTR-1 and GSTR-3B marked as filed`);
        } else {
          await window.gstAPI.updateReturnStatus({
            gstin: client.gstin,
            financialYear,
            month,
            returnType,
            status: "filed",
          });
          setStatusInfo(`${client.clientName}: ${returnType.toUpperCase()} marked as filed`);
        }
        await loadStatuses();
      } catch (error) {
        setStatusInfo(error instanceof Error ? error.message : "Unable to update return status");
      } finally {
        setActionBusyKey("");
      }
    },
    [financialYear, month, loadStatuses]
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl bg-gradient-to-r from-sky-700 via-cyan-700 to-teal-600 p-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">SPGST Desktop</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Client Selection</h1>
          <p className="mt-1 text-sm text-cyan-50">Choose a client to enter GST dashboard</p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="Search by Client Name / GSTIN"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                <Calendar size={14} className="text-slate-500" />
                <select className="bg-transparent text-sm outline-none" value={financialYear} onChange={(e) => onFinancialYearChange(e.target.value)}>
                  {financialYearOptions.map((fy) => (
                    <option key={fy} value={fy}>
                      {fy}
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                <select className="bg-transparent text-sm outline-none" value={month} onChange={(e) => onMonthChange(e.target.value)}>
                  {monthOptions.map((itemMonth) => (
                    <option key={itemMonth} value={itemMonth}>
                      {itemMonth}
                    </option>
                  ))}
                </select>
              </div>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={showPreviousMonth}
                  onChange={(e) => setShowPreviousMonth(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Show Previous Month Status
              </label>

              <button
                type="button"
                onClick={onOpenAddClient}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={14} />
                Add Client
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAlphabetFilter("ALL")}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                alphabetFilter === "ALL" ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              All
            </button>
            {LETTERS.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => setAlphabetFilter(letter)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  alphabetFilter === letter ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAlphabetFilter("#")}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                alphabetFilter === "#" ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              #
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-slate-700">
              <UserCheck size={16} />
              <p className="text-sm font-semibold">Recently Used Clients</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleRecent.length === 0 && <p className="text-sm text-slate-500">No recent clients yet.</p>}
              {visibleRecent.map((client) => (
                <button
                  key={`recent-${client.gstin}`}
                  type="button"
                  onClick={() => onSelectClient(client)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
                >
                  {client.clientName} - {client.gstin}
                </button>
              ))}
            </div>
          </div>

          {statusInfo && <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">{statusInfo}</div>}

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[58vh] overflow-auto">
              <div className="bg-white">
                {!loading && sortedClients.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No client found</div>
                )}

                {loading && <div className="px-4 py-8 text-center text-sm text-slate-500">Loading clients...</div>}

                {statusLoading && !loading && <div className="border-b border-slate-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">Loading return status...</div>}

                {groupedClients.map((group) => (
                  <section key={group.key} className="border-b border-slate-100">
                    <div className="sticky top-0 z-10 border-y border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{group.key}</div>
                    {group.clients.map((entry) => {
                      const client = entry.client;
                      const current = entry.current;
                      const previous = entry.previous;
                      const active = selectedIndex === selectedByGstin.get(client.gstin);

                      return (
                        <div
                          key={client.gstin}
                          ref={(el) => {
                            rowRefs.current[client.gstin] = el;
                          }}
                          className={`flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-slate-700 ${
                            active
                              ? "border-l-4 border-l-cyan-500 bg-cyan-50 ring-1 ring-cyan-200 dark:border-l-cyan-300 dark:bg-cyan-800/40 dark:ring-cyan-700"
                              : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{client.clientName}</p>
                            <p className="truncate font-mono text-xs text-slate-500">{client.gstin}</p>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700" title={`GSTR-1: ${statusLabel(current?.gstr1.visualStatus || "pending")}`}>
                              <span className={`h-2 w-2 rounded-full ${indicatorDotClass(current?.gstr1.visualStatus || "pending")}`} />
                              G1
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700" title={`GSTR-3B: ${statusLabel(current?.gstr3b.visualStatus || "pending")}`}>
                              <span className={`h-2 w-2 rounded-full ${indicatorDotClass(current?.gstr3b.visualStatus || "pending")}`} />
                              G3
                            </span>
                            {showPreviousMonth && previous && (
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-500" title={`${previous.month} (${previous.financialYear})`}>Prev</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                              defaultValue=""
                              onChange={async (e) => {
                                const value = e.target.value;
                                e.target.value = "";
                                if (!value) return;
                                await handleMarkFiled(client, value as "gstr1" | "gstr3b" | "both");
                              }}
                              disabled={actionBusyKey.startsWith(client.gstin)}
                            >
                              <option value="">Quick Action</option>
                              <option value="gstr1">Mark GSTR-1 Filed</option>
                              <option value="gstr3b">Mark GSTR-3B Filed</option>
                              <option value="both">Mark Both Filed</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => onSelectClient(client)}
                              className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700"
                            >
                              Select Client
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Building2 size={14} />
            Keyboard: Up/Down arrows to move, Enter to select client
          </div>
        </div>
      </div>
    </div>
  );
}
