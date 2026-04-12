import { useEffect, useMemo, useState } from "react";
import { Calculator, Copy, Database, FileArchive, FileCode2, Hash, IndianRupee, RotateCcw } from "lucide-react";
import { hsnCodes } from "../data/hsnCodes";
import type { ClientRecord } from "../types";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  mode: UtilityPageMode;
  onStatus: (text: string) => void;
};

type UtilityPageMode = "util-calc" | "util-hsn" | "util-invoice" | "util-backup" | "util-json";

type CalcMode = "exclusive" | "inclusive";

type CalcResult = {
  taxableValue: number;
  gstAmount: number;
  totalAmount: number;
};

const HISTORY_KEY = "spgst_calc_history";
const CALC_HANDLER_MISSING_KEY = "spgst_calc_handler_missing";
const LAST_CALC_KEY = "spgst_last_calculation";

function toNum(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function currency(value: number): string {
  return `Rs ${toNum(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function UtilityModule({ selectedClient, financialYear, month, mode: pageMode, onStatus }: Props) {
  const [dark, setDark] = useState(false);

  const [amount, setAmount] = useState(0);
  const [rate, setRate] = useState(18);
  const [mode, setMode] = useState<CalcMode>("exclusive");
  const [calcResult, setCalcResult] = useState<CalcResult>({ taxableValue: 0, gstAmount: 0, totalAmount: 0 });
  const [calcHistory, setCalcHistory] = useState<Array<{ amount: number; rate: number; mode: CalcMode; result: CalcResult; at: string }>>([]);

  const [hsnQuery, setHsnQuery] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  const [jsonText, setJsonText] = useState("{}");
  const [jsonDirty, setJsonDirty] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [calcHandlerMissing, setCalcHandlerMissing] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return;
    try {
      setCalcHistory(JSON.parse(raw));
    } catch {
      setCalcHistory([]);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(LAST_CALC_KEY);
    if (!raw) return;
    try {
      const last = JSON.parse(raw) as { amount?: number; rate?: number; mode?: CalcMode };
      if (typeof last.amount === "number") setAmount(toNum(last.amount));
      if (typeof last.rate === "number") setRate(toNum(last.rate));
      if (last.mode === "exclusive" || last.mode === "inclusive") setMode(last.mode);
    } catch {
      // Ignore malformed local cache.
    }
  }, []);

  useEffect(() => {
    setCalcHandlerMissing(localStorage.getItem(CALC_HANDLER_MISSING_KEY) === "1");
  }, []);

  const localCalculateGst = (valueAmount: number, valueRate: number, valueMode: CalcMode): CalcResult => {
    const amountNum = toNum(valueAmount);
    const rateNum = toNum(valueRate);

    if (valueMode === "inclusive") {
      const taxable = rateNum > 0 ? amountNum / (1 + rateNum / 100) : amountNum;
      const gst = amountNum - taxable;
      return {
        taxableValue: toNum(taxable.toFixed(2)),
        gstAmount: toNum(gst.toFixed(2)),
        totalAmount: toNum(amountNum.toFixed(2)),
      };
    }

    const gst = amountNum * (rateNum / 100);
    return {
      taxableValue: toNum(amountNum.toFixed(2)),
      gstAmount: toNum(gst.toFixed(2)),
      totalAmount: toNum((amountNum + gst).toFixed(2)),
    };
  };

  const filteredHsn = useMemo(() => {
    const q = hsnQuery.trim().toLowerCase();
    if (!q) return hsnCodes;
    return hsnCodes.filter((row) => row.code.includes(q) || row.description.toLowerCase().includes(q));
  }, [hsnQuery]);

  const runCalculation = async () => {
    let next: CalcResult;

    if (calcHandlerMissing) {
      next = localCalculateGst(amount, rate, mode);
    } else {
      try {
        const result = await window.gstAPI.calculateGst({ amount, rate, mode });
        next = {
          taxableValue: toNum(result.taxableValue),
          gstAmount: toNum(result.gstAmount),
          totalAmount: toNum(result.totalAmount),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error || "");
        if (/No handler registered for 'calculate-gst'/i.test(msg)) {
          localStorage.setItem(CALC_HANDLER_MISSING_KEY, "1");
          setCalcHandlerMissing(true);
          onStatus("IPC handler for GST calculator is inactive. Using local fallback. Restart app once to re-enable backend handler.");
          next = localCalculateGst(amount, rate, mode);
        } else {
          throw error;
        }
      }
    }

    setCalcResult(next);
    localStorage.setItem(LAST_CALC_KEY, JSON.stringify({ amount, rate, mode, result: next, at: new Date().toISOString() }));

    const entry = { amount, rate, mode, result: next, at: new Date().toISOString() };
    const nextHistory = [entry, ...calcHistory].slice(0, 10);
    setCalcHistory(nextHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  };

  useEffect(() => {
    runCalculation().catch((e) => onStatus(e instanceof Error ? e.message : "Calculation failed"));
  }, [amount, rate, mode, calcHandlerMissing]);

  const copyCalc = async () => {
    const text = `Taxable: ${calcResult.taxableValue}\nGST: ${calcResult.gstAmount}\nTotal: ${calcResult.totalAmount}`;
    await navigator.clipboard.writeText(text);
    onStatus("GST calculation copied.");
  };

  const resetCalc = () => {
    setAmount(0);
    setRate(18);
    setMode("exclusive");
    onStatus("GST calculator reset.");
  };

  const generateInvoice = async () => {
    const result = await window.gstAPI.generateInvoice({ financialYear, month });
    setInvoiceNo(result.invoiceNo || "");
    onStatus(`Generated invoice: ${result.invoiceNo}`);
  };

  const backupData = async () => {
    const result = await window.gstAPI.backupData();
    onStatus(`Backup created: ${result.zipPath}`);
  };

  const restoreData = async (file: File | null) => {
    if (!file) return;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await window.gstAPI.restoreData({ zipBuffer: Array.from(buffer) });
    onStatus(result.ok ? "Data restored successfully." : "Restore failed.");
  };

  const loadJson = async () => {
    const payload = await window.gstAPI.loadMonthData({
      gstin: selectedClient.gstin,
      financialYear,
      month,
    });

    setJsonText(JSON.stringify(payload, null, 2));
    setJsonDirty(false);
    setJsonError("");
    onStatus(`Loaded JSON for ${month}`);
  };

  const saveJson = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      await window.gstAPI.saveMonthData({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        payload: parsed,
      });
      setJsonDirty(false);
      setJsonError("");
      onStatus(`JSON saved for ${month}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Invalid JSON";
      setJsonError(msg);
      onStatus(msg);
    }
  };

  const card = dark ? "rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-sm" : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  const text = dark ? "text-slate-100" : "text-slate-800";
  const muted = dark ? "text-slate-400" : "text-slate-500";

  const titleMap: Record<UtilityPageMode, string> = {
    "util-calc": "GST Calculator",
    "util-hsn": "HSN Code Finder",
    "util-invoice": "Invoice Number Generator",
    "util-backup": "Data Backup & Restore",
    "util-json": "JSON Viewer",
  };

  const subtitleMap: Record<UtilityPageMode, string> = {
    "util-calc": "Instant exclusive and inclusive GST computation with quick history.",
    "util-hsn": "Search product/service HSN references with applicable GST rates.",
    "util-invoice": "Generate sequential monthly invoice numbers instantly.",
    "util-backup": "Create secure backups and restore client data from ZIP.",
    "util-json": "Inspect and edit raw month JSON payload for debugging.",
  };

  const shellTone = dark
    ? "bg-slate-950"
    : pageMode === "util-calc"
      ? "bg-gradient-to-b from-cyan-50 to-slate-50"
      : pageMode === "util-hsn"
        ? "bg-gradient-to-b from-emerald-50 to-slate-50"
        : pageMode === "util-invoice"
          ? "bg-gradient-to-b from-blue-50 to-slate-50"
          : pageMode === "util-backup"
            ? "bg-gradient-to-b from-amber-50 to-slate-50"
            : "bg-gradient-to-b from-slate-100 to-slate-50";

  return (
    <section className={`space-y-4 rounded-2xl p-3 ${shellTone}`}>
      <div className={dark ? "rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-sm" : "rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-wide ${muted}`}>Utility Module</p>
            <h2 className={`text-lg font-semibold ${text}`}>{titleMap[pageMode]}</h2>
            <p className={`mt-1 text-xs ${muted}`}>{subtitleMap[pageMode]}</p>
            <p className={`mt-2 text-xs ${muted}`}>Context: {selectedClient.clientName} | {financialYear} | {month}</p>
          </div>
          <button type="button" onClick={() => setDark((v) => !v)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      {pageMode === "util-calc" && (
        <div className="mx-auto w-full max-w-4xl">
          <article className={`${card} overflow-hidden rounded-3xl border-0 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.35)]`}>
            <div className="bg-[#F8FAFC] p-5 md:p-6">
              <div className="mb-5">
                <h3 className={`text-xl font-semibold tracking-tight ${text}`}>GST Calculator</h3>
                <p className={`mt-1 text-sm ${muted}`}>Calculate GST instantly</p>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                <div className="space-y-5">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Amount</p>
                    <label className="relative mt-2 block">
                      <IndianRupee size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        value={amount}
                        placeholder="Enter amount"
                        onChange={(e) => setAmount(toNum(e.target.value))}
                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-lg font-medium text-slate-800 outline-none transition duration-200 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                  </div>

                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>GST Rate</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[5, 12, 18, 28].map((r) => {
                        const active = r === rate;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRate(r)}
                            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                              active
                                ? "bg-blue-500 text-white shadow-[0_10px_20px_-12px_rgba(59,130,246,0.9)]"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-600"
                            }`}
                          >
                            {r}%
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Mode</p>
                    <div className="mt-2 inline-flex rounded-full bg-slate-200 p-1">
                      <button
                        type="button"
                        onClick={() => setMode("exclusive")}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                          mode === "exclusive" ? "bg-blue-500 text-white shadow-sm" : "text-slate-700"
                        }`}
                      >
                        Exclusive
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("inclusive")}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                          mode === "inclusive" ? "bg-blue-500 text-white shadow-sm" : "text-slate-700"
                        }`}
                      >
                        Inclusive
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={copyCalc} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600">
                      <Copy size={13} /> Copy Result
                    </button>
                    <button type="button" onClick={resetCalc} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:text-rose-600">
                      <RotateCcw size={13} /> Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm transition-all duration-300">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Calculator size={14} /> Taxable Value</p>
                    <p key={`taxable-${calcResult.taxableValue}`} className="mt-2 text-2xl font-bold text-slate-900 transition-all duration-300">{currency(calcResult.taxableValue)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm transition-all duration-300">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Hash size={14} /> GST Amount</p>
                    <p key={`gst-${calcResult.gstAmount}`} className="mt-2 text-2xl font-bold text-blue-600 transition-all duration-300">{currency(calcResult.gstAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm transition-all duration-300">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><FileCode2 size={14} /> Total Amount</p>
                    <p key={`total-${calcResult.totalAmount}`} className="mt-2 text-2xl font-bold text-slate-900 transition-all duration-300">{currency(calcResult.totalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
                <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Recent Calculations</p>
                <div className="mt-2 max-h-24 overflow-auto text-xs">
                  {calcHistory.map((h, idx) => (
                    <p key={idx} className={muted}>{new Date(h.at).toLocaleString("en-IN")} | {h.mode} {h.rate}% on {h.amount}{" -> "}{h.result.totalAmount}</p>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      )}

      {pageMode === "util-hsn" && (
        <article className={card}>
          <h3 className={`inline-flex items-center gap-2 text-sm font-semibold ${text}`}><Hash size={16} /> HSN Code Finder</h3>
          <input value={hsnQuery} onChange={(e) => setHsnQuery(e.target.value)} placeholder="Search by HSN code or product" className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-emerald-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-emerald-100 text-emerald-900"><tr><th className="px-2 py-2 text-left">HSN</th><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-right">GST</th></tr></thead>
              <tbody>
                {filteredHsn.map((row) => (
                  <tr key={row.code} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 font-medium">{row.code}</td>
                    <td className="px-2 py-1.5">{row.description}</td>
                    <td className="px-2 py-1.5 text-right">{row.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {pageMode === "util-invoice" && (
        <article className={card}>
          <h3 className={`inline-flex items-center gap-2 text-sm font-semibold ${text}`}><FileCode2 size={16} /> Invoice Number Generator</h3>
          <p className={`mt-2 text-xs ${muted}`}>Format: INV-YYYYMM-001 (auto increment, monthly reset)</p>
          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 text-center">
            <button type="button" onClick={generateInvoice} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">Generate Invoice</button>
            <p className="mt-4 text-xs text-slate-500">Generated Number</p>
            <p className="mt-1 text-2xl font-bold tracking-wider text-blue-800">{invoiceNo || "INV-YYYYMM-001"}</p>
          </div>
        </article>
      )}

      {pageMode === "util-backup" && (
        <article className={`${card} grid gap-3 md:grid-cols-2`}>
          <div>
            <h3 className={`inline-flex items-center gap-2 text-sm font-semibold ${text}`}><FileArchive size={16} /> Data Backup & Restore</h3>
            <p className={`mt-2 text-xs ${muted}`}>Backup captures the full data/clients folder. Restore replaces existing files.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={backupData} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Backup data/clients</button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-100">
                <RotateCcw size={13} /> Restore ZIP
                <input type="file" accept=".zip" className="hidden" onChange={(e) => restoreData(e.target.files?.[0] || null).catch((er) => onStatus(er instanceof Error ? er.message : "Restore failed"))} />
              </label>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Restore Checklist</p>
            <p className="mt-1">1. Keep a fresh backup before restore.</p>
            <p>2. Use ZIP generated from this app only.</p>
            <p>3. Restart app after large restore for clean reload.</p>
          </div>
        </article>
      )}

      {pageMode === "util-json" && (
        <article className={card}>
          <h3 className={`inline-flex items-center gap-2 text-sm font-semibold ${text}`}><Database size={16} /> JSON Viewer (Debug)</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => loadJson().catch((e) => onStatus(e instanceof Error ? e.message : "Load failed"))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100">Load JSON</button>
            <button type="button" onClick={() => saveJson().catch((e) => onStatus(e instanceof Error ? e.message : "Save failed"))} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Save JSON</button>
            {jsonDirty && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-700">Unsaved changes</span>}
          </div>
          <textarea value={jsonText} onChange={(e) => { setJsonText(e.target.value); setJsonDirty(true); }} className="mt-3 h-72 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs" />
          {jsonError && <p className="mt-2 text-xs text-rose-700">{jsonError}</p>}
        </article>
      )}
    </section>
  );
}
