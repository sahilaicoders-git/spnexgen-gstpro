import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, FileCheck2, Pencil, RefreshCcw, Save, TrendingUp, TriangleAlert, X } from "lucide-react";
import type {
  ClientRecord,
  Gstr3bAdjustments,
  Gstr3bDataResponse,
  Gstr3bSection31Row,
  Gstr3bSection32Row,
  Gstr3bSection4Row,
  Gstr3bSection5Row,
  Gstr3bSection6Row,
} from "../types";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  financialYearOptions: string[];
  monthOptions: string[];
  onChangeFinancialYear: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onStatus: (text: string) => void;
};

function toNum(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function to2(value: number): number {
  return Number(toNum(value).toFixed(2));
}

function currency(value: number): string {
  return `Rs ${toNum(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function safeTaxTriplet(value: unknown): { igst: number; cgst: number; sgst: number } {
  const source = (value && typeof value === "object" ? value : {}) as {
    igst?: number;
    cgst?: number;
    sgst?: number;
  };

  return {
    igst: toNum(source.igst),
    cgst: toNum(source.cgst),
    sgst: toNum(source.sgst),
  };
}

type ItcStrategy = "auto" | "prefer-cgst" | "prefer-sgst";

type TaxTriplet = { igst: number; cgst: number; sgst: number };

const DEFAULT_MANUAL_UTILIZATION = {
  igstToIgst: 0,
  igstToCgst: 0,
  igstToSgst: 0,
  cgstToCgst: 0,
  cgstToIgst: 0,
  sgstToSgst: 0,
  sgstToIgst: 0,
};

function simulateItcSetoff(outputGST: TaxTriplet, inputGST: TaxTriplet, strategy: ItcStrategy) {
  const remaining = {
    igst: to2(Math.max(0, outputGST.igst)),
    cgst: to2(Math.max(0, outputGST.cgst)),
    sgst: to2(Math.max(0, outputGST.sgst)),
  };

  const itc = {
    igst: to2(Math.max(0, inputGST.igst)),
    cgst: to2(Math.max(0, inputGST.cgst)),
    sgst: to2(Math.max(0, inputGST.sgst)),
  };

  const utilized = { igst: 0, cgst: 0, sgst: 0 };

  const utilize = (source: keyof TaxTriplet, target: keyof TaxTriplet) => {
    const amount = to2(Math.min(itc[source], remaining[target]));
    itc[source] = to2(Math.max(0, itc[source] - amount));
    remaining[target] = to2(Math.max(0, remaining[target] - amount));
    utilized[source] = to2(utilized[source] + amount);
  };

  utilize("igst", "igst");

  let igstCrossOrder: Array<"cgst" | "sgst"> = ["cgst", "sgst"];
  if (strategy === "prefer-sgst") {
    igstCrossOrder = ["sgst", "cgst"];
  } else if (strategy === "auto") {
    const cgstDeficit = Math.max(0, remaining.cgst - itc.cgst);
    const sgstDeficit = Math.max(0, remaining.sgst - itc.sgst);
    igstCrossOrder = sgstDeficit > cgstDeficit ? ["sgst", "cgst"] : ["cgst", "sgst"];
  }
  igstCrossOrder.forEach((target) => utilize("igst", target));

  utilize("cgst", "cgst");
  utilize("cgst", "igst");

  utilize("sgst", "sgst");
  utilize("sgst", "igst");

  const payable = {
    igst: to2(Math.max(0, remaining.igst)),
    cgst: to2(Math.max(0, remaining.cgst)),
    sgst: to2(Math.max(0, remaining.sgst)),
  };

  const balance_itc = {
    igst: to2(Math.max(0, itc.igst)),
    cgst: to2(Math.max(0, itc.cgst)),
    sgst: to2(Math.max(0, itc.sgst)),
  };

  return {
    strategy,
    payable,
    utilized,
    balance_itc,
    totalCashPayable: to2(payable.igst + payable.cgst + payable.sgst),
  };
}

function renderMoneyInput(value: number, onChange: (value: number) => void, danger = false) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(toNum(e.target.value))}
      className={`w-32 rounded border px-2 py-1 text-right text-sm ${danger ? "border-rose-400 bg-rose-50" : "border-slate-300"}`}
    />
  );
}

export default function Gstr3bPage({
  selectedClient,
  financialYear,
  month,
  financialYearOptions,
  monthOptions,
  onChangeFinancialYear,
  onChangeMonth,
  onStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Gstr3bDataResponse | null>(null);

  // Opening ITC balance editor state
  const [openingItcEdit, setOpeningItcEdit] = useState(false);
  const [openingItcDraft, setOpeningItcDraft] = useState({ igst: 0, cgst: 0, sgst: 0 });

  const [adjustments, setAdjustments] = useState<Gstr3bAdjustments>({
    zeroRatedTaxable: 0,
    zeroRatedIgst: 0,
    nilExemptTaxable: 0,
    nonGstTaxable: 0,
    itcReversedIgst: 0,
    itcReversedCgst: 0,
    itcReversedSgst: 0,
    utilizationMode: "auto",
    manualUtilization: { ...DEFAULT_MANUAL_UTILIZATION },
    igstCrossUtilizationStrategy: "auto",
  });

  const igstStrategy = data?.adjustments?.igstCrossUtilizationStrategy || adjustments.igstCrossUtilizationStrategy || "auto";
  const igstStrategyLabel =
    igstStrategy === "prefer-sgst" ? "IGST cross setoff prefers SGST first" : igstStrategy === "prefer-cgst" ? "IGST cross setoff prefers CGST first" : "IGST cross setoff auto-optimizes by higher deficit";

  const strategySimulation = useMemo(() => {
    if (!data) return [];

    const outputGST = safeTaxTriplet(data.outputGST);
    const inputGST = safeTaxTriplet(data.inputGST);

    const rows = [
      simulateItcSetoff(outputGST, inputGST, "auto"),
      simulateItcSetoff(outputGST, inputGST, "prefer-cgst"),
      simulateItcSetoff(outputGST, inputGST, "prefer-sgst"),
    ];

    return rows.sort((a, b) => a.totalCashPayable - b.totalCashPayable);
  }, [data]);

  const bestStrategy = strategySimulation.length > 0 ? strategySimulation[0].strategy : null;

  const strategyLabel = (value: ItcStrategy): string => {
    if (value === "prefer-cgst") return "Prefer CGST First";
    if (value === "prefer-sgst") return "Prefer SGST First";
    return "Auto Optimize";
  };

  const manualUtilization = {
    ...DEFAULT_MANUAL_UTILIZATION,
    ...(adjustments.manualUtilization || {}),
  };

  const setManualUtilizationValue = (field: keyof typeof DEFAULT_MANUAL_UTILIZATION, value: number) => {
    setAdjustments((prev) => ({
      ...prev,
      manualUtilization: {
        ...DEFAULT_MANUAL_UTILIZATION,
        ...(prev.manualUtilization || {}),
        [field]: toNum(value),
      },
    }));
  };

  const toUserError = (error: unknown, fallback: string): string => {
    const text = error instanceof Error ? error.message : String(error || "");
    if (text.includes("No handler registered for") || text.includes("No handler registered")) {
      return "GSTR-3B IPC handlers are not active in the current Electron process. Please close and reopen the desktop app once.";
    }
    return text || fallback;
  };

  const loadData = async () => {
    setLoading(true);
    setOpeningItcEdit(false);
    try {
      const next = await window.gstAPI.loadGstr3bData({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
      });
      setData(next);
      setAdjustments({
        ...next.adjustments,
        utilizationMode: next.adjustments?.utilizationMode || "auto",
        manualUtilization: {
          ...DEFAULT_MANUAL_UTILIZATION,
          ...(next.adjustments?.manualUtilization || {}),
        },
      });
      onStatus(`GSTR-3B calculated for ${month}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to load GSTR-3B data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient.gstin, financialYear, month]);

  const saveAdjustments = async () => {
    setLoading(true);
    try {
      const next = await window.gstAPI.saveGstr3bData({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
        adjustments,
      });
      setData(next);
      setAdjustments({
        ...next.adjustments,
        utilizationMode: next.adjustments?.utilizationMode || "auto",
        manualUtilization: {
          ...DEFAULT_MANUAL_UTILIZATION,
          ...(next.adjustments?.manualUtilization || {}),
        },
      });
      onStatus("GSTR-3B adjustments saved.");
    } catch (error) {
      onStatus(toUserError(error, "Unable to save GSTR-3B adjustments."));
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    setLoading(true);
    try {
      const result = await window.gstAPI.exportGstr3b({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
        openFile: true,
      });
      onStatus(`GSTR-3B exported: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export GSTR-3B."));
    } finally {
      setLoading(false);
    }
  };

  const markFiled = async () => {
    setLoading(true);
    try {
      await window.gstAPI.markGstr3bFiled({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
      });
      await loadData();
      onStatus("GSTR-3B marked as filed.");
    } catch (error) {
      onStatus(toUserError(error, "Unable to mark GSTR-3B as filed."));
    } finally {
      setLoading(false);
    }
  };

  const section31 = data?.section31Rows || [];
  const section32 = data?.section32Rows || [];
  const section4 = data?.section4Rows || [];
  const section5 = data?.section5Rows || [];
  const section6 = data?.section6Rows || [];

  const payableTriplet = safeTaxTriplet(data?.payable ?? data?.netGST);
  const utilizedTriplet = safeTaxTriplet(
    data?.utilized ?? {
      igst: section6.find((row) => row.taxType === "IGST")?.itcUtilized,
      cgst: section6.find((row) => row.taxType === "CGST")?.itcUtilized,
      sgst: section6.find((row) => row.taxType === "SGST")?.itcUtilized,
    }
  );
  const balanceItcTriplet = safeTaxTriplet(data?.balance_itc);

  const negativeItc = useMemo(() => {
    if (!data) return false;
    return data.summary.input.igst < 0 || data.summary.input.cgst < 0 || data.summary.input.sgst < 0;
  }, [data]);

  const renderSection31 = (rows: Gstr3bSection31Row[]) => (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Nature of Supplies</th>
            <th className="px-3 py-2 text-right">Taxable Value</th>
            <th className="px-3 py-2 text-right">IGST</th>
            <th className="px-3 py-2 text-right">CGST</th>
            <th className="px-3 py-2 text-right">SGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.nature} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.nature}</td>
              <td className="px-3 py-2 text-right font-medium text-slate-700">{currency(row.taxableValue)}</td>
              <td className="px-3 py-2 text-right text-cyan-700">{currency(row.igst)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{currency(row.cgst)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{currency(row.sgst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSection32 = (rows: Gstr3bSection32Row[]) => (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">State</th>
            <th className="px-3 py-2 text-right">Taxable Value</th>
            <th className="px-3 py-2 text-right">IGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-3 py-6 text-center text-slate-500">No interstate B2C supplies.</td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.state} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.state}</td>
              <td className="px-3 py-2 text-right">{currency(row.taxableValue)}</td>
              <td className="px-3 py-2 text-right text-cyan-700">{currency(row.igst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSection4 = (rows: Gstr3bSection4Row[]) => (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">IGST</th>
            <th className="px-3 py-2 text-right">CGST</th>
            <th className="px-3 py-2 text-right">SGST</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.type}</td>
              <td className="px-3 py-2 text-right text-cyan-700">{currency(row.igst)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{currency(row.cgst)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{currency(row.sgst)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSection5 = (rows: Gstr3bSection5Row[]) => (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">Taxable Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.type}</td>
              <td className="px-3 py-2 text-right">{currency(row.taxableValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSection6 = (rows: Gstr3bSection6Row[]) => (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left">Tax Type</th>
            <th className="px-3 py-2 text-right">Tax Payable</th>
            <th className="px-3 py-2 text-right">ITC Utilized</th>
            <th className="px-3 py-2 text-right">Cash Payable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.taxType} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium">{row.taxType}</td>
              <td className="px-3 py-2 text-right">{currency(row.taxPayable)}</td>
              <td className="px-3 py-2 text-right text-emerald-700">{currency(row.itcUtilized)}</td>
              <td className="px-3 py-2 text-right text-rose-700">{currency(row.cashPayable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="space-y-4">
      {/* ── Modern Header Card ──────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2744 100%)",
        }}
      >
        {/* Decorative accent line */}
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
          style={{ background: "linear-gradient(180deg, #3b82f6, #06b6d4, #10b981)" }}
        />
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 24px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 24px)" }}
        />

        <div className="relative px-5 py-4">
          {/* Top row: client info + period selectors + status */}
          <div className="flex flex-wrap items-center gap-4">

            {/* Client details cluster */}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">GSTR-3B Return</p>
              <p className="mt-0.5 truncate text-base font-bold text-white">{selectedClient.clientName}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide"
                  style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
                >
                  {selectedClient.gstin}
                </span>
              </div>
            </div>

            {/* Period selectors */}
            <div className="flex items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Financial Year</span>
                <select
                  value={financialYear}
                  onChange={(e) => onChangeFinancialYear(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {financialYearOptions.map((fy) => (
                    <option key={fy} value={fy} className="bg-slate-900">{fy}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Month</span>
                <select
                  value={month}
                  onChange={(e) => onChangeMonth(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  {monthOptions.map((m) => (
                    <option key={m} value={m} className="bg-slate-900">{m}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Status badge */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  data?.status === "filed"
                    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  data?.status === "filed" ? "bg-emerald-400" : "bg-amber-400"
                }`} />
                {data?.status === "filed" ? "Filed" : "Pending"}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-3 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />

          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-generate-gstr3b"
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
            >
              <RefreshCcw size={13} />
              Generate GSTR-3B
            </button>
            <button
              id="btn-save-gstr3b"
              type="button"
              onClick={saveAdjustments}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", color: "#e2e8f0" }}
            >
              <Save size={13} />
              Save Changes
            </button>
            <button
              id="btn-export-gstr3b"
              type="button"
              onClick={exportData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", color: "#e2e8f0" }}
            >
              <Download size={13} />
              Export
            </button>
            <button
              id="btn-filed-gstr3b"
              type="button"
              onClick={markFiled}
              disabled={loading || data?.status === "filed"}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{
                background: data?.status === "filed"
                  ? "rgba(16,185,129,0.12)"
                  : "linear-gradient(135deg,#059669,#10b981)",
                border: data?.status === "filed" ? "1px solid rgba(16,185,129,0.3)" : "none",
                color: data?.status === "filed" ? "#6ee7b7" : "#fff",
              }}
            >
              <FileCheck2 size={13} />
              {data?.status === "filed" ? "Filed" : "Mark as Filed"}
            </button>
            {loading && (
              <span className="ml-1 text-[11px] text-slate-400 animate-pulse">Processing…</span>
            )}
          </div>
        </div>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Output GST</p>
            <p className="mt-1 text-lg font-semibold text-rose-700">{currency(data.summary.outputGst)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Input GST (ITC)</p>
            <p className={`mt-1 text-lg font-semibold ${negativeItc ? "text-rose-700" : "text-emerald-700"}`}>{currency(data.summary.inputGst)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Net Payable</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{currency(data.summary.netPayable)}</p>
          </div>
        </div>
      )}

      {/* ── ITC Breakdown: Previous Balance + Current ITC + Total ─────────── */}
      {data && (
        (() => {
          const cf = data.carryForwardITC ?? { igst: 0, cgst: 0, sgst: 0 };
          const cur = data.currentITC ?? safeTaxTriplet(data.inputGST);
          const fin = data.finalITC ?? {
            igst: (cf.igst ?? 0) + (cur.igst ?? 0),
            cgst: (cf.cgst ?? 0) + (cur.cgst ?? 0),
            sgst: (cf.sgst ?? 0) + (cur.sgst ?? 0),
          };
          const hasCf = cf.igst > 0 || cf.cgst > 0 || cf.sgst > 0;

          const saveOpeningITC = async () => {
            setLoading(true);
            try {
              await window.gstAPI.saveCarryForward({
                client: selectedClient.folderName,
                fy: financialYear,
                month,
                igst: openingItcDraft.igst,
                cgst: openingItcDraft.cgst,
                sgst: openingItcDraft.sgst,
              });
              setOpeningItcEdit(false);
              await loadData();
              onStatus(`Opening ITC balance saved for ${month}.`);
            } catch (err) {
              onStatus(err instanceof Error ? err.message : "Failed to save opening ITC balance.");
            } finally {
              setLoading(false);
            }
          };

          const startEdit = () => {
            setOpeningItcDraft({ igst: cf.igst, cgst: cf.cgst, sgst: cf.sgst });
            setOpeningItcEdit(true);
          };

          return (
            <div className={`rounded-2xl border p-4 shadow-sm ${
              hasCf ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
            }`}>
              {/* Header row */}
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp size={15} className={hasCf ? "text-amber-600" : "text-slate-400"} />
                <h3 className="text-sm font-semibold text-slate-800">ITC Breakdown</h3>
                {hasCf && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Carry Forward Active
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {!openingItcEdit ? (
                    <button
                      id="btn-edit-opening-itc"
                      type="button"
                      title="Enter / edit opening ITC balance for this month"
                      onClick={startEdit}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Pencil size={11} /> {hasCf ? "Edit Opening Balance" : "Enter Opening Balance"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Cancel"
                      onClick={() => setOpeningItcEdit(false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      <X size={11} /> Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* ── Opening ITC editor ───────────────────────────────────────── */}
              {openingItcEdit && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-2 text-[11px] font-semibold text-blue-700">
                    Enter Opening / Carry-Forward ITC Balance for {month}
                  </p>
                  <p className="mb-3 text-[10px] text-blue-500">
                    Use this to manually set the ITC balance you are carrying into this month from a prior period
                    (e.g. first entry, software migration, or manual correction).
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-xs font-medium text-slate-600">
                      IGST
                      <input
                        id="opening-itc-igst"
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingItcDraft.igst}
                        onChange={(e) =>
                          setOpeningItcDraft((p) => ({ ...p, igst: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className="mt-1 w-full rounded border border-blue-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      CGST
                      <input
                        id="opening-itc-cgst"
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingItcDraft.cgst}
                        onChange={(e) =>
                          setOpeningItcDraft((p) => ({ ...p, cgst: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className="mt-1 w-full rounded border border-blue-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      SGST
                      <input
                        id="opening-itc-sgst"
                        type="number"
                        min="0"
                        step="0.01"
                        value={openingItcDraft.sgst}
                        onChange={(e) =>
                          setOpeningItcDraft((p) => ({ ...p, sgst: Math.max(0, Number(e.target.value) || 0) }))
                        }
                        className="mt-1 w-full rounded border border-blue-300 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[10px] text-slate-500">
                      Total: <span className="font-semibold text-slate-700">
                        Rs {(openingItcDraft.igst + openingItcDraft.cgst + openingItcDraft.sgst).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                    </p>
                    <button
                      id="btn-save-opening-itc"
                      type="button"
                      onClick={saveOpeningITC}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      <CheckCircle size={12} /> Save Opening Balance
                    </button>
                  </div>
                </div>
              )}

              {/* ── ITC summary table ─────────────────────────────────────────── */}
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">ITC Source</th>
                      <th className="px-3 py-2 text-right">IGST</th>
                      <th className="px-3 py-2 text-right">CGST</th>
                      <th className="px-3 py-2 text-right">SGST</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">
                        Opening / Previous Balance
                        {!hasCf && <span className="ml-2 text-xs text-slate-400">(none — click Edit to enter)</span>}
                      </td>
                      <td className={`px-3 py-2 text-right ${hasCf ? "text-amber-700 font-medium" : "text-slate-400"}`}>
                        {hasCf ? currency(cf.igst) : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right ${hasCf ? "text-amber-700 font-medium" : "text-slate-400"}`}>
                        {hasCf ? currency(cf.cgst) : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right ${hasCf ? "text-amber-700 font-medium" : "text-slate-400"}`}>
                        {hasCf ? currency(cf.sgst) : "—"}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${hasCf ? "text-amber-700" : "text-slate-400"}`}>
                        {hasCf ? currency(cf.igst + cf.cgst + cf.sgst) : "—"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">Current Month ITC (Purchases)</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{currency(cur.igst)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{currency(cur.cgst)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{currency(cur.sgst)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{currency(cur.igst + cur.cgst + cur.sgst)}</td>
                    </tr>
                    <tr className="border-t-2 border-slate-300 bg-slate-50">
                      <td className="px-3 py-2 font-semibold text-slate-800">Total ITC Available</td>
                      <td className="px-3 py-2 text-right font-bold text-cyan-700">{currency(fin.igst)}</td>
                      <td className="px-3 py-2 text-right font-bold text-cyan-700">{currency(fin.cgst)}</td>
                      <td className="px-3 py-2 text-right font-bold text-cyan-700">{currency(fin.sgst)}</td>
                      <td className="px-3 py-2 text-right font-bold text-cyan-700">{currency(fin.igst + fin.cgst + fin.sgst)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {hasCf && !openingItcEdit && (
                <p className="mt-2 text-[11px] text-amber-600">
                  ✦ Opening ITC of {currency(cf.igst + cf.cgst + cf.sgst)} has been added to this month's available credit.
                </p>
              )}
            </div>
          );
        })()
      )}

      {(negativeItc || (data?.warnings.length || 0) > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="inline-flex items-center gap-2 font-semibold">
            <TriangleAlert size={15} /> Validation Warnings
          </p>
          {negativeItc && <p className="mt-1 text-xs">Negative ITC found in Section 4. Please verify ITC reversal values.</p>}
          {(data?.warnings || []).map((warning, idx) => (
            <p key={`${warning}-${idx}`} className="mt-0.5 text-xs">• {warning}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Section 3.1 - Outward Supplies</h3>
          {renderSection31(section31)}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Section 3.2 - Interstate Supplies (B2C)</h3>
          {renderSection32(section32)}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Section 4 - Input Tax Credit</h3>
          {renderSection4(section4)}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Section 5 - Exempt / Non-GST</h3>
          {renderSection5(section5)}
        </div>

        <div className="space-y-2 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Section 6 - Payment of Tax</h3>
          {renderSection6(section6)}
        </div>
      </div>

      {data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">ITC Utilization Matrix</h3>
          <p className="mt-1 text-xs text-slate-500">Rule order applied: IGST set-off first, then CGST, then SGST as per configured utilization sequence.</p>
          <p className="mt-1 text-xs text-cyan-700">{igstStrategyLabel}</p>
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Metric</th>
                  <th className="px-3 py-2 text-right">IGST</th>
                  <th className="px-3 py-2 text-right">CGST</th>
                  <th className="px-3 py-2 text-right">SGST</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">Payable (Cash)</td>
                  <td className="px-3 py-2 text-right text-rose-700">{currency(payableTriplet.igst)}</td>
                  <td className="px-3 py-2 text-right text-rose-700">{currency(payableTriplet.cgst)}</td>
                  <td className="px-3 py-2 text-right text-rose-700">{currency(payableTriplet.sgst)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-700">ITC Utilized</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{currency(utilizedTriplet.igst)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{currency(utilizedTriplet.cgst)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{currency(utilizedTriplet.sgst)}</td>
                </tr>
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-700">Balance ITC</td>
                  <td className="px-3 py-2 text-right text-cyan-700">{currency(balanceItcTriplet.igst)}</td>
                  <td className="px-3 py-2 text-right text-cyan-700">{currency(balanceItcTriplet.cgst)}</td>
                  <td className="px-3 py-2 text-right text-cyan-700">{currency(balanceItcTriplet.sgst)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">ITC Strategy Simulator</h3>
            {bestStrategy && <p className="text-xs font-medium text-emerald-700">Lowest cash payable: {strategyLabel(bestStrategy)}</p>}
          </div>
          <p className="mt-1 text-xs text-slate-500">Compare strategies before saving. Auto mode prioritizes IGST setoff target by higher deficit.</p>

          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Strategy</th>
                  <th className="px-3 py-2 text-right">Payable IGST</th>
                  <th className="px-3 py-2 text-right">Payable CGST</th>
                  <th className="px-3 py-2 text-right">Payable SGST</th>
                  <th className="px-3 py-2 text-right">Total Cash</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {strategySimulation.map((row) => {
                  const selected = igstStrategy === row.strategy;
                  return (
                    <tr key={row.strategy} className={`border-t border-slate-100 ${selected ? "bg-cyan-50" : ""}`}>
                      <td className="px-3 py-2 font-medium text-slate-800">{strategyLabel(row.strategy)}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{currency(row.payable.igst)}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{currency(row.payable.cgst)}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{currency(row.payable.sgst)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{currency(row.totalCashPayable)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setAdjustments((prev) => ({
                              ...prev,
                              igstCrossUtilizationStrategy: row.strategy,
                            }))
                          }
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            selected ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {selected ? "Selected" : "Apply"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Adjustments (Editable)</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <span>Zero Rated Taxable</span>
              {renderMoneyInput(adjustments.zeroRatedTaxable, (value) => setAdjustments((prev) => ({ ...prev, zeroRatedTaxable: value })))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Zero Rated IGST</span>
              {renderMoneyInput(adjustments.zeroRatedIgst, (value) => setAdjustments((prev) => ({ ...prev, zeroRatedIgst: value })))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Nil/Exempt Taxable</span>
              {renderMoneyInput(adjustments.nilExemptTaxable, (value) => setAdjustments((prev) => ({ ...prev, nilExemptTaxable: value })))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Non-GST Taxable</span>
              {renderMoneyInput(adjustments.nonGstTaxable, (value) => setAdjustments((prev) => ({ ...prev, nonGstTaxable: value })))}
            </div>
            <div className="mt-2 border-t border-slate-200 pt-2" />
            <div className="flex items-center justify-between gap-3">
              <span>ITC Reversed IGST</span>
              {renderMoneyInput(adjustments.itcReversedIgst, (value) => setAdjustments((prev) => ({ ...prev, itcReversedIgst: value })))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>ITC Reversed CGST</span>
              {renderMoneyInput(adjustments.itcReversedCgst, (value) => setAdjustments((prev) => ({ ...prev, itcReversedCgst: value })))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>ITC Reversed SGST</span>
              {renderMoneyInput(adjustments.itcReversedSgst, (value) => setAdjustments((prev) => ({ ...prev, itcReversedSgst: value })))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
              <span>IGST Cross Utilization</span>
              <select
                value={adjustments.igstCrossUtilizationStrategy || "auto"}
                onChange={(e) =>
                  setAdjustments((prev) => ({
                    ...prev,
                    igstCrossUtilizationStrategy: e.target.value as "auto" | "prefer-cgst" | "prefer-sgst",
                  }))
                }
                className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="auto">Auto (Minimize Cash Liability)</option>
                <option value="prefer-cgst">Manual: Prefer CGST First</option>
                <option value="prefer-sgst">Manual: Prefer SGST First</option>
              </select>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-2">
              <span>ITC Utilization Mode</span>
              <select
                value={adjustments.utilizationMode || "auto"}
                onChange={(e) =>
                  setAdjustments((prev) => ({
                    ...prev,
                    utilizationMode: e.target.value as "auto" | "manual",
                  }))
                }
                className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="auto">Auto Utilization</option>
                <option value="manual">Manual (GST Portal Style)</option>
              </select>
            </div>

            {(adjustments.utilizationMode || "auto") === "manual" && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Manual ITC Setoff Matrix</p>
                <p className="mt-1 text-[11px] text-slate-500">Editable ITC utilization routes. Values are capped on save/generate by available ITC and tax liability.</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>IGST → IGST</span>
                    {renderMoneyInput(manualUtilization.igstToIgst, (value) => setManualUtilizationValue("igstToIgst", value))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>IGST → CGST</span>
                    {renderMoneyInput(manualUtilization.igstToCgst, (value) => setManualUtilizationValue("igstToCgst", value))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>IGST → SGST</span>
                    {renderMoneyInput(manualUtilization.igstToSgst, (value) => setManualUtilizationValue("igstToSgst", value))}
                  </div>
                  <div className="mt-1 border-t border-slate-200 pt-2" />
                  <div className="flex items-center justify-between gap-3">
                    <span>CGST → CGST</span>
                    {renderMoneyInput(manualUtilization.cgstToCgst, (value) => setManualUtilizationValue("cgstToCgst", value))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>CGST → IGST</span>
                    {renderMoneyInput(manualUtilization.cgstToIgst, (value) => setManualUtilizationValue("cgstToIgst", value))}
                  </div>
                  <div className="mt-1 border-t border-slate-200 pt-2" />
                  <div className="flex items-center justify-between gap-3">
                    <span>SGST → SGST</span>
                    {renderMoneyInput(manualUtilization.sgstToSgst, (value) => setManualUtilizationValue("sgstToSgst", value))}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>SGST → IGST</span>
                    {renderMoneyInput(manualUtilization.sgstToIgst, (value) => setManualUtilizationValue("sgstToIgst", value))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">Filing History</h3>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {(data?.filingHistory || []).length === 0 && <p className="text-slate-500">No filing history yet.</p>}
            {(data?.filingHistory || []).slice(0, 8).map((row, idx) => (
              <p key={`${row.filedAt}-${idx}`}>
                {new Date(row.filedAt).toLocaleString("en-IN")} - {row.month} ({row.financialYear})
              </p>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-xs text-slate-500">Processing...</p>}
    </section>
  );
}
