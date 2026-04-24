import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Moon,
  Receipt,
  ShoppingCart,
  Sun,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClientRecord, MonthPayload, PurchaseRecord, SaleRecord } from "../types";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  monthOptions: string[];
  monthData: MonthPayload | null;
  onQuickAction: (menuId: string) => void;
};

type TxRow = {
  date: string;
  invoiceNo: string;
  type: "B2B" | "B2C" | "Purchase";
  party: string;
  amount: number;
};


function toNum(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function to2(value: number): number {
  return Number(value.toFixed(2));
}

function saleTax(sale: SaleRecord): number {
  if (!Array.isArray(sale.items)) return toNum(sale.gst_amount);
  return to2(
    sale.items.reduce((sum, item) => sum + toNum(item.igst) + toNum(item.cgst) + toNum(item.sgst), 0)
  );
}

function saleAmount(sale: SaleRecord): number {
  return toNum(sale.total_value);
}

function purchaseAmount(row: PurchaseRecord): number {
  const total = toNum(row.total);
  if (total > 0) return total;
  return toNum((row as { total_value?: number }).total_value);
}

function purchaseTax(row: PurchaseRecord): number {
  return to2(toNum(row.igst) + toNum(row.cgst) + toNum(row.sgst));
}

function dueDateFor(month: string, monthOptions: string[], financialYear: string, day: number): Date | null {
  const monthIdx = monthOptions.indexOf(month);
  if (monthIdx < 0) return null;

  const fyMatch = financialYear.match(/^FY_(\d{4})-(\d{2})$/);
  if (!fyMatch) return null;

  const startYear = Number(fyMatch[1]);
  // Monthly: index 0..8 is startYear, 9..11 is startYear + 1
  // Quarterly: index 0..2 is startYear, 3 is startYear + 1
  const isQuarterly = monthOptions.length === 4;
  const yearOffset = isQuarterly ? (monthIdx <= 2 ? 0 : 1) : (monthIdx <= 8 ? 0 : 1);
  const year = startYear + yearOffset;

  // Monthly: calendar month is (monthIdx + 3) % 12 + 1? No, simpler: 0->Apr(4), 8->Dec(12), 9->Jan(1)
  // We'll just use a rough estimate for quarters
  const calendarMonth = isQuarterly ? (monthIdx * 3 + 4) : (monthIdx + 4);
  const next = new Date(year, calendarMonth - 1, day);
  return next;
}

function daysLeftText(date: Date | null): string {
  if (!date) return "Due date unavailable";
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const left = Math.ceil((date.getTime() - now.getTime()) / oneDayMs);
  if (left < 0) return `${Math.abs(left)} day(s) overdue`;
  return `${left} day(s) left`;
}

function trendPercent(base: number, compare: number): { value: string; up: boolean } {
  if (compare === 0) {
    return { value: base > 0 ? "+100.0%" : "0.0%", up: base >= compare };
  }
  const pct = ((base - compare) / compare) * 100;
  const rounded = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return { value: rounded, up: pct >= 0 };
}

export default function DashboardPage({ selectedClient, financialYear, month, monthOptions, monthData, onQuickAction }: Props) {
  const [darkMode, setDarkMode] = useState(false);

  const computed = useMemo(() => {
    const b2b = monthData?.sales?.b2b || [];
    const b2c = monthData?.sales?.b2c || [];
    const purchases = monthData?.purchases || [];

    const totalSales = to2([...b2b, ...b2c].reduce((sum, s) => sum + saleAmount(s), 0));
    const totalPurchases = to2(purchases.reduce((sum, p) => sum + purchaseAmount(p), 0));

    const outputGst = to2([...b2b, ...b2c].reduce((sum, s) => sum + saleTax(s), 0));
    const inputGst = to2(purchases.reduce((sum, p) => sum + purchaseTax(p), 0));
    const netGst = to2(outputGst - inputGst);

    const salesCount = b2b.length + b2c.length;

    const salesGstSplit = [...b2b, ...b2c].reduce(
      (acc, sale) => {
        sale.items?.forEach((item) => {
          acc.igst += toNum(item.igst);
          acc.cgst += toNum(item.cgst);
          acc.sgst += toNum(item.sgst);
        });
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0 }
    );

    const purchaseGstSplit = purchases.reduce(
      (acc, row) => {
        acc.igst += toNum(row.igst);
        acc.cgst += toNum(row.cgst);
        acc.sgst += toNum(row.sgst);
        return acc;
      },
      { igst: 0, cgst: 0, sgst: 0 }
    );

    const gstBreakdown = [
      { name: "IGST", value: to2(salesGstSplit.igst + purchaseGstSplit.igst), color: "#0ea5e9" },
      { name: "CGST", value: to2(salesGstSplit.cgst + purchaseGstSplit.cgst), color: "#14b8a6" },
      { name: "SGST", value: to2(salesGstSplit.sgst + purchaseGstSplit.sgst), color: "#f59e0b" },
    ];

    const b2bValue = to2(b2b.reduce((sum, s) => sum + saleAmount(s), 0));
    const b2cValue = to2(b2c.reduce((sum, s) => sum + saleAmount(s), 0));

    const b2Series = [
      { name: "B2B", value: b2bValue, color: "#6366f1" },
      { name: "B2C", value: b2cValue, color: "#ec4899" },
    ];

    const byDay = new Map<string, { sales: number; purchase: number }>();

    [...b2b, ...b2c].forEach((sale) => {
      const day = String(sale.date || "").slice(8, 10) || "--";
      const row = byDay.get(day) || { sales: 0, purchase: 0 };
      row.sales += saleAmount(sale);
      byDay.set(day, row);
    });

    purchases.forEach((purchase) => {
      const day = String(purchase.date || "").slice(8, 10) || "--";
      const row = byDay.get(day) || { sales: 0, purchase: 0 };
      row.purchase += purchaseAmount(purchase);
      byDay.set(day, row);
    });

    const barSeries = Array.from(byDay.entries())
      .map(([day, value]) => ({ day, sales: to2(value.sales), purchase: to2(value.purchase) }))
      .sort((a, b) => Number(a.day) - Number(b.day));

    const txRows: TxRow[] = [];
    b2b.forEach((row) => {
      txRows.push({
        date: row.date,
        invoiceNo: row.invoice_no,
        type: "B2B",
        party: row.buyer_name || "Business Customer",
        amount: saleAmount(row),
      });
    });
    b2c.forEach((row) => {
      txRows.push({
        date: row.date,
        invoiceNo: row.invoice_no,
        type: "B2C",
        party: "Retail Customer",
        amount: saleAmount(row),
      });
    });
    purchases.forEach((row) => {
      txRows.push({
        date: row.date,
        invoiceNo: row.invoice_no,
        type: "Purchase",
        party: row.supplier_name || "Supplier",
        amount: purchaseAmount(row),
      });
    });

    const recentTransactions = txRows
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);

    return {
      totalSales,
      totalPurchases,
      outputGst,
      inputGst,
      netGst,
      salesCount,
      gstBreakdown,
      b2Series,
      barSeries,
      recentTransactions,
      salesPurchaseTrend: trendPercent(totalSales, totalPurchases),
      gstTrend: trendPercent(outputGst, inputGst),
    };
  }, [monthData]);

  const gstr1Due = dueDateFor(month, monthOptions, financialYear, 11);
  const gstr3bDue = dueDateFor(month, monthOptions, financialYear, 20);
  const gstr1Status = monthData?.returns?.gstr1 || "pending";
  const gstr3bStatus = monthData?.returns?.gstr3b || "pending";

  const cardTone = darkMode
    ? "border-slate-700 bg-slate-900 text-slate-100"
    : "border-slate-200 bg-white text-slate-900";

  return (
    <section className={darkMode ? "space-y-5 text-slate-100" : "space-y-5 text-slate-900"}>
      <div className={darkMode ? "rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-5" : "rounded-2xl bg-gradient-to-r from-sky-700 via-indigo-700 to-cyan-700 p-5"}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/80">GST Operations Dashboard</p>
            <h2 className="mt-1 text-2xl font-semibold">{selectedClient.clientName}</h2>
            <p className="text-sm text-white/85">
              GSTIN: {selectedClient.gstin} • {financialYear} • {month}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-sky-600">Total Sales</p>
              <p className="mt-1 text-2xl font-semibold">Rs {computed.totalSales.toLocaleString("en-IN")}</p>
            </div>
            <Receipt className="text-sky-500" size={20} />
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600">
            {computed.salesPurchaseTrend.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {computed.salesPurchaseTrend.value} vs purchases
          </p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-600">Total Purchases</p>
              <p className="mt-1 text-2xl font-semibold">Rs {computed.totalPurchases.toLocaleString("en-IN")}</p>
            </div>
            <ShoppingCart className="text-emerald-500" size={20} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Includes manual and import entries</p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-orange-600">Output GST</p>
              <p className="mt-1 text-2xl font-semibold">Rs {computed.outputGst.toLocaleString("en-IN")}</p>
            </div>
            <TrendingUp className="text-orange-500" size={20} />
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-orange-600">
            {computed.gstTrend.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {computed.gstTrend.value} against input GST
          </p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-violet-600">Input GST (ITC)</p>
              <p className="mt-1 text-2xl font-semibold">Rs {computed.inputGst.toLocaleString("en-IN")}</p>
            </div>
            <Wallet className="text-violet-500" size={20} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Available for set-off</p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-rose-600">Net GST Payable</p>
              <p className={`mt-1 text-2xl font-semibold ${computed.netGst >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
                Rs {Math.abs(computed.netGst).toLocaleString("en-IN")}
              </p>
            </div>
            <Receipt className={computed.netGst >= 0 ? "text-rose-500" : "text-emerald-500"} size={20} />
          </div>
          <p className={`mt-2 text-xs ${computed.netGst >= 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {computed.netGst >= 0 ? "Payable" : "Refundable"}
          </p>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 ${cardTone}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-cyan-600">Total Invoices</p>
              <p className="mt-1 text-2xl font-semibold">{computed.salesCount}</p>
            </div>
            <Receipt className="text-cyan-500" size={20} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Sales invoices (B2B + B2C)</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-2 ${cardTone}`}>
          <h3 className="text-sm font-semibold">Sales vs Purchase (Date-wise)</h3>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={computed.barSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[6, 6, 0, 0]} />
                <Bar dataKey="purchase" fill="#22c55e" name="Purchase" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm ${cardTone}`}>
          <h3 className="text-sm font-semibold">GST Breakdown</h3>
          <div className="mt-3 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={computed.gstBreakdown} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
                  {computed.gstBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`rounded-2xl border p-4 shadow-sm ${cardTone}`}>
          <h3 className="text-sm font-semibold">B2B vs B2C Sales</h3>
          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={computed.b2Series} dataKey="value" nameKey="name" outerRadius={86} innerRadius={52}>
                  {computed.b2Series.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-2 ${cardTone}`}>
          <h3 className="text-sm font-semibold">Recent Transactions</h3>
          <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className={darkMode ? "bg-slate-800" : "bg-slate-100"}>
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Invoice No</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Party</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {computed.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                      No transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  computed.recentTransactions.map((tx) => (
                    <tr key={`${tx.type}-${tx.invoiceNo}-${tx.date}`} className={darkMode ? "border-t border-slate-800" : "border-t border-slate-200"}>
                      <td className="px-3 py-2">{tx.date}</td>
                      <td className="px-3 py-2 font-mono">{tx.invoiceNo}</td>
                      <td className="px-3 py-2">{tx.type}</td>
                      <td className="px-3 py-2">{tx.party}</td>
                      <td className="px-3 py-2 text-right font-semibold">Rs {tx.amount.toLocaleString("en-IN")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`rounded-2xl border p-4 shadow-sm ${cardTone}`}>
          <h3 className="text-sm font-semibold">GST Status</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className={darkMode ? "rounded-xl bg-slate-800 p-3" : "rounded-xl bg-slate-50 p-3"}>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">GSTR-1</p>
              <p className="mt-1 font-semibold capitalize">{gstr1Status}</p>
              <p className="text-xs text-slate-500">Due: {gstr1Due ? gstr1Due.toISOString().slice(0, 10) : "N/A"}</p>
            </div>
            <div className={darkMode ? "rounded-xl bg-slate-800 p-3" : "rounded-xl bg-slate-50 p-3"}>
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">GSTR-3B</p>
              <p className="mt-1 font-semibold capitalize">{gstr3bStatus}</p>
              <p className="text-xs text-slate-500">Due: {gstr3bDue ? gstr3bDue.toISOString().slice(0, 10) : "N/A"}</p>
            </div>
            {gstr1Status.toLowerCase() !== "filed" && gstr1Due && Math.abs(new Date().getTime() - gstr1Due.getTime()) <= 3 * 24 * 60 * 60 * 1000 && (
              <div className="inline-flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800">
                <Bell size={16} className="mt-0.5" />
                <p className="text-xs">GSTR-1 due in 3 days ({daysLeftText(gstr1Due)}).</p>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-2 ${cardTone}`}>
          <h3 className="text-sm font-semibold">Quick Actions</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onQuickAction("sales-add")}
              className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700 transition hover:translate-y-[-1px] hover:bg-sky-100"
            >
              Add Sale
            </button>
            <button
              type="button"
              onClick={() => onQuickAction("purchase-add")}
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:translate-y-[-1px] hover:bg-emerald-100"
            >
              Add Purchase
            </button>
            <button
              type="button"
              onClick={() => onQuickAction("purchase-import")}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 transition hover:translate-y-[-1px] hover:bg-amber-100"
            >
              Import Purchase
            </button>
            <button
              type="button"
              onClick={() => onQuickAction("sales-import")}
              className="rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700 transition hover:translate-y-[-1px] hover:bg-cyan-100"
            >
              Import Sales
            </button>
            <button
              type="button"
              onClick={() => onQuickAction("sales-export")}
              className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 transition hover:translate-y-[-1px] hover:bg-violet-100"
            >
              Export GSTR-1
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
