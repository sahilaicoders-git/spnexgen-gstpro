import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ClientRecord, ReportsDataResponse, YearlyReportDataResponse } from "../types";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  financialYearOptions: string[];
  monthOptions: string[];
  mode: "monthly" | "gst" | "yearly";
  onChangeFinancialYear: (value: string) => void;
  onChangeMonth: (value: string) => void;
  onStatus: (text: string) => void;
};

function toNum(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function currency(value: number): string {
  return `Rs ${toNum(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function ReportsModule({
  selectedClient,
  financialYear,
  month,
  financialYearOptions,
  monthOptions,
  mode,
  onChangeFinancialYear,
  onChangeMonth,
  onStatus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportsDataResponse | null>(null);
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

  const loadData = async () => {
    if (ipcUnavailable) return;
    setLoading(true);
    try {
      if (mode === "yearly") {
        const nextYearly = await window.gstAPI.loadYearlyReportData({
          client: selectedClient.folderName,
          fy: financialYear,
        });
        setYearlyData(nextYearly);
        setData(null);
        onStatus(`Yearly report loaded for ${financialYear}`);
        return;
      }

      const next = await window.gstAPI.loadReportsData({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
      });
      setData(next);
      setYearlyData(null);
      onStatus(`Reports loaded for ${month}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to load report data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedClient.folderName, financialYear, month, mode]);

  const monthlyTotals = useMemo(() => {
    if (!data) return { salesGst: 0, purchaseGst: 0 };
    return {
      salesGst: toNum(data.summary.outputTotalGst),
      purchaseGst: toNum(data.summary.inputTotalGst),
    };
  }, [data]);

  const exportMonthly = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    try {
      const result = await window.gstAPI.exportMonthlyReport({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
        openFile: true,
      });
      onStatus(`Monthly report exported: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export monthly report."));
    }
  };

  const exportGstSummary = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    try {
      const result = await window.gstAPI.exportGstSummaryPdf({
        client: selectedClient.folderName,
        fy: financialYear,
        month,
        openFile: true,
      });
      onStatus(`GST Summary exported: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export GST summary."));
    }
  };

  const exportYearlyExcel = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    try {
      const result = await window.gstAPI.exportYearlyReport({
        client: selectedClient.folderName,
        fy: financialYear,
        openFile: true,
      });
      onStatus(`Yearly turnover exported: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export yearly report."));
    }
  };

  const exportYearlyPdf = async () => {
    if (ipcUnavailable) {
      onStatus("Restart app with npm start to activate reports handlers.");
      return;
    }
    try {
      const result = await window.gstAPI.exportYearlySummaryPdf({
        client: selectedClient.folderName,
        fy: financialYear,
        openFile: true,
      });
      onStatus(`Yearly summary exported: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export yearly summary PDF."));
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Client Name</p>
            <p className="text-sm font-semibold text-slate-800">{selectedClient.clientName}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">GSTIN</p>
            <p className="text-sm font-semibold text-slate-800">{selectedClient.gstin}</p>
          </div>
          <label className="text-xs uppercase tracking-wide text-slate-500">
            Financial Year
            <select
              value={financialYear}
              onChange={(e) => onChangeFinancialYear(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700"
            >
              {financialYearOptions.map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-500">
            Month
            <select
              value={month}
              onChange={(e) => onChangeMonth(e.target.value)}
              disabled={mode === "yearly"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <div className="xl:col-span-2 flex items-end">
            {mode === "monthly" ? (
              <button type="button" onClick={exportMonthly} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                <Download size={14} /> Export Monthly Report (Excel)
              </button>
            ) : mode === "gst" ? (
              <button type="button" onClick={exportGstSummary} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                <Download size={14} /> Export GST Summary (PDF)
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportYearlyExcel} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                  <Download size={14} /> Export Yearly Report (Excel)
                </button>
                <button type="button" onClick={exportYearlyPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  <Download size={14} /> Export Summary (PDF)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === "monthly" && data && (
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Sales Section</h3>
              <p className="text-xs text-slate-500">Total Sales: {currency(data.summary.totalSales)} | GST on Sales: {currency(monthlyTotals.salesGst)}</p>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[980px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Party Name</th>
                    <th className="px-3 py-2 text-right">Taxable Value</th>
                    <th className="px-3 py-2 text-right">GST Amount</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salesRows.map((row, idx) => (
                    <tr key={`${row.invoiceNo}-${idx}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.invoiceNo}</td>
                      <td className="px-3 py-2">{row.type}</td>
                      <td className="px-3 py-2">{row.partyName}</td>
                      <td className="px-3 py-2 text-right">{currency(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-cyan-700">{currency(row.gstAmount)}</td>
                      <td className="px-3 py-2 text-right font-medium">{currency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Purchase Section</h3>
              <p className="text-xs text-slate-500">Total Purchases: {currency(data.summary.totalPurchases)} | Total GST (ITC): {currency(monthlyTotals.purchaseGst)}</p>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[1100px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Invoice No</th>
                    <th className="px-3 py-2 text-left">Supplier Name</th>
                    <th className="px-3 py-2 text-right">Taxable Value</th>
                    <th className="px-3 py-2 text-right">IGST</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.purchaseRows.map((row, idx) => (
                    <tr key={`${row.invoiceNo}-${idx}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2">{row.invoiceNo}</td>
                      <td className="px-3 py-2">{row.supplierName}</td>
                      <td className="px-3 py-2 text-right">{currency(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-cyan-700">{currency(row.igst)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{currency(row.cgst)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{currency(row.sgst)}</td>
                      <td className="px-3 py-2 text-right font-medium">{currency(row.total)}</td>
                      <td className="px-3 py-2 capitalize">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-700">Summary Footer</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-5 text-sm">
              <div><p className="text-xs text-slate-500">Total Sales</p><p className="font-semibold">{currency(data.summary.totalSales)}</p></div>
              <div><p className="text-xs text-slate-500">Total Purchases</p><p className="font-semibold">{currency(data.summary.totalPurchases)}</p></div>
              <div><p className="text-xs text-slate-500">Output GST</p><p className="font-semibold text-rose-700">{currency(data.summary.outputTotalGst)}</p></div>
              <div><p className="text-xs text-slate-500">Input GST</p><p className="font-semibold text-emerald-700">{currency(data.summary.inputTotalGst)}</p></div>
              <div><p className="text-xs text-slate-500">Net GST Payable</p><p className="font-semibold">{currency(data.summary.netGstPayable)}</p></div>
            </div>
          </section>
        </div>
      )}

      {mode === "gst" && data && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Sales</p><p className="text-lg font-semibold">{currency(data.gstSummary.cards.totalSales)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Purchase</p><p className="text-lg font-semibold">{currency(data.gstSummary.cards.totalPurchase)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Output GST</p><p className="text-lg font-semibold text-rose-700">{currency(data.gstSummary.cards.outputGst)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Input GST (ITC)</p><p className="text-lg font-semibold text-emerald-700">{currency(data.gstSummary.cards.inputGst)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Net GST Payable</p><p className="text-lg font-semibold">{currency(data.gstSummary.cards.netGstPayable)}</p></div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tax Type</th>
                  <th className="px-3 py-2 text-right">Output</th>
                  <th className="px-3 py-2 text-right">Input</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.gstSummary.taxRows.map((row) => (
                  <tr key={row.taxType} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.taxType}</td>
                    <td className="px-3 py-2 text-right">{currency(row.output)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.input)}</td>
                    <td className="px-3 py-2 text-right font-medium">{currency(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tax Type</th>
                  <th className="px-3 py-2 text-right">Liability</th>
                  <th className="px-3 py-2 text-right">ITC Used</th>
                  <th className="px-3 py-2 text-right">Cash Payable</th>
                </tr>
              </thead>
              <tbody>
                {data.gstSummary.itcUtilizationRows.map((row) => (
                  <tr key={row.taxType} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.taxType}</td>
                    <td className="px-3 py-2 text-right">{currency(row.liability)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{currency(row.itcUsed)}</td>
                    <td className="px-3 py-2 text-right text-rose-700">{currency(row.cashPayable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === "yearly" && yearlyData && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Turnover (Year)</p><p className="text-lg font-semibold">{currency(yearlyData.summary.totalTurnover)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Purchase</p><p className="text-lg font-semibold">{currency(yearlyData.summary.totalPurchases)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Output GST</p><p className="text-lg font-semibold text-rose-700">{currency(yearlyData.summary.totalOutputGST)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Input GST</p><p className="text-lg font-semibold text-emerald-700">{currency(yearlyData.summary.totalInputGST)}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Net GST Payable</p><p className="text-lg font-semibold">{currency(yearlyData.summary.netGstPayable)}</p></div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Month</th>
                  <th className="px-3 py-2 text-right">Sales (Turnover)</th>
                  <th className="px-3 py-2 text-right">Purchases</th>
                  <th className="px-3 py-2 text-right">Output GST</th>
                  <th className="px-3 py-2 text-right">Input GST</th>
                  <th className="px-3 py-2 text-right">Net GST</th>
                </tr>
              </thead>
              <tbody>
                {yearlyData.monthRows.map((row) => (
                  <tr key={row.month} className={`border-t border-slate-100 ${row.month === yearlyData.highlights.highestSalesMonth ? "bg-emerald-50" : ""} ${row.isLoss ? "text-rose-700" : ""}`}>
                    <td className="px-3 py-2 font-medium">{row.month}</td>
                    <td className="px-3 py-2 text-right">{currency(row.sales)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.purchases)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.outputGST)}</td>
                    <td className="px-3 py-2 text-right">{currency(row.inputGST)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{currency(row.netGST)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold text-slate-900">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{currency(yearlyData.summary.totalTurnover)}</td>
                  <td className="px-3 py-2 text-right">{currency(yearlyData.summary.totalPurchases)}</td>
                  <td className="px-3 py-2 text-right">{currency(yearlyData.summary.totalOutputGST)}</td>
                  <td className="px-3 py-2 text-right">{currency(yearlyData.summary.totalInputGST)}</td>
                  <td className="px-3 py-2 text-right">{currency(yearlyData.summary.netGstPayable)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Monthly Sales Trend</h3>
              <div className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyData.charts.line}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => currency(v)} />
                    <Line dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Sales vs Purchase</h3>
              <div className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData.charts.bar}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => currency(v)} />
                    <Bar dataKey="sales" fill="#3b82f6" />
                    <Bar dataKey="purchases" fill="#0f766e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-700">
            <p><span className="font-semibold">Highest sales month:</span> {yearlyData.highlights.highestSalesMonth || "N/A"}</p>
            <p className="mt-1"><span className="font-semibold">Loss months:</span> {yearlyData.highlights.lossMonths.join(", ") || "None"}</p>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-slate-500">Loading report data...</p>}
    </section>
  );
}
