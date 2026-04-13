import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, FileBarChart2, Landmark, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClientRecord, ReportsDataResponse, YearlyReportDataResponse } from "../types";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  onOpenReport: (menuId: "report-monthly" | "report-gst" | "report-yearly") => void;
  onStatus: (text: string) => void;
};

type TxPreviewRow = {
  date: string;
  invoiceNo: string;
  type: "Sale" | "Purchase";
  amount: number;
};

function toNum(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function currency(value: number): string {
  return `Rs ${toNum(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ReportsPreviewDashboard({ selectedClient, financialYear, month, onOpenReport, onStatus }: Props) {
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<ReportsDataResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyReportDataResponse | null>(null);
  const [ipcUnavailable, setIpcUnavailable] = useState(false);

  const toUserError = (error: unknown, fallback: string): string => {
    const text = error instanceof Error ? error.message : String(error || "");
    if (text.includes("No handler registered for")) {
      setIpcUnavailable(true);
      return "Reports IPC handlers are not active in the current Electron process. Close and reopen the app using npm start.";
    }
    return text || fallback;
  };

  const loadAll = async () => {
    if (ipcUnavailable) return;
    setLoading(true);
    try {
      const [monthly, yearly] = await Promise.all([
        window.gstAPI.loadReportsData({
          client: selectedClient.folderName,
          fy: financialYear,
          month,
        }),
        window.gstAPI.loadYearlyReportData({
          client: selectedClient.folderName,
          fy: financialYear,
        }),
      ]);

      setMonthlyData(monthly);
      setYearlyData(yearly);
      onStatus(`Reports preview ready for ${month} / ${financialYear}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to load reports preview."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [selectedClient.folderName, financialYear, month]);

  const txPreviewRows = useMemo<TxPreviewRow[]>(() => {
    if (!monthlyData) return [];

    const sales = monthlyData.salesRows.map((row) => ({
      date: row.date,
      invoiceNo: row.invoiceNo,
      type: "Sale" as const,
      amount: row.total,
    }));

    const purchases = monthlyData.purchaseRows.map((row) => ({
      date: row.date,
      invoiceNo: row.invoiceNo,
      type: "Purchase" as const,
      amount: row.total,
    }));

    return [...sales, ...purchases]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);
  }, [monthlyData]);

  const yearlyLast3 = useMemo(() => {
    if (!yearlyData) return [];
    return yearlyData.monthRows.slice(-3);
  }, [yearlyData]);

  const exportMonthly = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    const result = await window.gstAPI.exportMonthlyReport({
      client: selectedClient.folderName,
      fy: financialYear,
      month,
      openFile: true,
    });
    onStatus(`Monthly report exported: ${result.filePath}`);
  };

  const exportGstSummary = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    const result = await window.gstAPI.exportGstSummaryPdf({
      client: selectedClient.folderName,
      fy: financialYear,
      month,
      openFile: true,
    });
    onStatus(`GST summary exported: ${result.filePath}`);
  };

  const exportYearly = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    const result = await window.gstAPI.exportYearlyReport({
      client: selectedClient.folderName,
      fy: financialYear,
      openFile: true,
    });
    onStatus(`Yearly report exported: ${result.filePath}`);
  };

  const netMonth = toNum(monthlyData?.summary.netGstPayable);
  const netYear = toNum(yearlyData?.summary.netGstPayable);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Reports Preview Dashboard</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-800">{selectedClient.clientName} ({selectedClient.gstin})</h2>
        <p className="text-sm text-slate-600">Showing unified report preview for {month} / {financialYear}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FileBarChart2 size={16} /> Monthly Report Preview
            </h3>
            <button
              type="button"
              onClick={exportMonthly}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Download size={12} /> Export
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Total Sales: <span className="font-semibold text-slate-800">{currency(toNum(monthlyData?.summary.totalSales))}</span></p>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Total Purchases: <span className="font-semibold text-slate-800">{currency(toNum(monthlyData?.summary.totalPurchases))}</span></p>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Output GST: <span className="font-semibold text-rose-700">{currency(toNum(monthlyData?.summary.outputTotalGst))}</span></p>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Input GST: <span className="font-semibold text-emerald-700">{currency(toNum(monthlyData?.summary.inputTotalGst))}</span></p>
          </div>

          <p className={`mt-2 text-sm font-semibold ${netMonth > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            Net GST Payable: {currency(netMonth)}
          </p>

          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Invoice No</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txPreviewRows.map((row, idx) => (
                  <tr key={`${row.invoiceNo}-${idx}`} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{row.date}</td>
                    <td className="px-2 py-1.5">{row.invoiceNo}</td>
                    <td className="px-2 py-1.5">{row.type}</td>
                    <td className="px-2 py-1.5 text-right">{currency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => onOpenReport("report-monthly")}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-600"
          >
            View Full Report <ArrowRight size={13} />
          </button>
        </article>

        <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Landmark size={16} /> GST Summary Preview
            </h3>
            <button
              type="button"
              onClick={exportGstSummary}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Download size={12} /> Export
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Output GST: <span className="font-semibold text-rose-700">{currency(toNum(monthlyData?.gstSummary.cards.outputGst))}</span></p>
            <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Input GST: <span className="font-semibold text-emerald-700">{currency(toNum(monthlyData?.gstSummary.cards.inputGst))}</span></p>
            <p className={`rounded-lg p-2 text-xs ${netMonth > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>Net GST: <span className="font-semibold">{currency(netMonth)}</span></p>
          </div>

          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Tax Type</th>
                  <th className="px-2 py-2 text-right">Output</th>
                  <th className="px-2 py-2 text-right">Input</th>
                  <th className="px-2 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {(monthlyData?.gstSummary.taxRows || []).map((row) => (
                  <tr key={row.taxType} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{row.taxType}</td>
                    <td className="px-2 py-1.5 text-right">{currency(row.output)}</td>
                    <td className="px-2 py-1.5 text-right">{currency(row.input)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{currency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 rounded-lg bg-slate-50 p-2">
            <p className="text-[11px] font-semibold text-slate-600">ITC Utilization (Preview)</p>
            {(monthlyData?.gstSummary.itcUtilizationRows || []).map((row) => (
              <p key={row.taxType} className="mt-1 text-[11px] text-slate-700">
                {row.taxType}: Liability {currency(row.liability)} | ITC {currency(row.itcUsed)} | Cash {currency(row.cashPayable)}
              </p>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenReport("report-gst")}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-600"
          >
            View GST Summary <ArrowRight size={13} />
          </button>
        </article>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <TrendingUp size={16} /> Yearly Turnover Preview
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportYearly}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Total Turnover (Year): <span className="font-semibold text-slate-800">{currency(toNum(yearlyData?.summary.totalTurnover))}</span></p>
          <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Total GST (Year): <span className="font-semibold text-rose-700">{currency(toNum(yearlyData?.summary.totalOutputGST))}</span></p>
          <p className={`rounded-lg p-2 text-xs ${netYear > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>Net GST (Year): <span className="font-semibold">{currency(netYear)}</span></p>
        </div>

        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Month</th>
                  <th className="px-2 py-2 text-right">Sales</th>
                  <th className="px-2 py-2 text-right">GST</th>
                </tr>
              </thead>
              <tbody>
                {yearlyLast3.map((row) => (
                  <tr key={row.month} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{row.month}</td>
                    <td className="px-2 py-1.5 text-right">{currency(row.sales)}</td>
                    <td className="px-2 py-1.5 text-right">{currency(row.outputGST)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-40 rounded-xl border border-slate-200 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyData?.charts.line || []}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => currency(v)} />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenReport("report-yearly")}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-600"
        >
          View Full Yearly Report <ArrowRight size={13} />
        </button>
      </article>

      {loading && <p className="text-xs text-slate-500">Loading preview data...</p>}
    </section>
  );
}
