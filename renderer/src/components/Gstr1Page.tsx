import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileCheck2, Info, RefreshCcw, Save, Search, Trash2, TriangleAlert } from "lucide-react";
import type {
  ClientRecord,
  Gstr1B2BRow,
  Gstr1B2CLRow,
  Gstr1B2CSRow,
  Gstr1DataResponse,
  Gstr1HsnRow,
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

type TabKey = "b2b" | "b2cs" | "b2cl" | "hsn" | "docs";

type TableTotals = {
  invoiceValue: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
};

type B2BInvoiceGroup = {
  key: string;
  invoiceNo: string;
  invoiceDate: string;
  gstin: string;
  receiverName: string;
  placeOfSupply: string;
  invoiceValue: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
  rows: Gstr1B2BRow[];
};

// ── Table 13: Documents Issued During Tax Period ──────────────────────────────
type DocRow = {
  id: string;
  nature: string;
  srNoFrom: string;
  srNoTo: string;
  cancelled: number;
};

const DOC_NATURES = [
  "Invoices for outward supply",
  "Invoices for inward supply (from unregistered persons)",
  "Revised Invoice",
  "Debit Note",
  "Credit Note",
  "Receipt Voucher",
  "Payment Voucher",
  "Refund Voucher",
  "Delivery Challan for job work",
  "Delivery Challan for supply on approval",
  "Delivery Challan in case of liquid gas",
  "Delivery Challan in other cases",
];

function makeDefaultDocRows(): DocRow[] {
  return DOC_NATURES.map((nature, idx) => ({
    id: `doc-${idx}`,
    nature,
    srNoFrom: "",
    srNoTo: "",
    cancelled: 0,
  }));
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "b2b", label: "B2B" },
  { key: "b2cs", label: "B2C Small" },
  { key: "b2cl", label: "B2C Large" },
  { key: "hsn", label: "HSN Summary" },
  { key: "docs", label: "Document Summary" },
];

function toNum(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function currency(value: number): string {
  return `Rs ${toNum(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function isValidGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(gstin || "").toUpperCase());
}

function formatDateText(isoText: string): string {
  if (!isoText) return "-";
  if (/^\d{2}-\d{2}-\d{4}$/.test(isoText)) return isoText;
  const parts = String(isoText).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return isoText;
  return `${parts[3]}-${parts[2]}-${parts[1]}`;
}

export default function Gstr1Page({
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
  const [activeTab, setActiveTab] = useState<TabKey>("b2b");
  const [data, setData] = useState<Gstr1DataResponse | null>(null);
  const [editedB2BRows, setEditedB2BRows] = useState<Gstr1B2BRow[]>([]);
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState("all");
  const [b2bPage, setB2BPage] = useState(1);
  const [b2bPageSize, setB2BPageSize] = useState<number>(10);
  const [b2csPage, setB2CSPage] = useState(1);
  const [b2csPageSize, setB2CSPageSize] = useState<number>(10);
  const [b2clPage, setB2CLPage] = useState(1);
  const [b2clPageSize, setB2CLPageSize] = useState<number>(10);
  const [hsnPage, setHsnPage] = useState(1);
  const [hsnPageSize, setHsnPageSize] = useState<number>(10);
  const [expandedB2BInvoices, setExpandedB2BInvoices] = useState<Set<string>>(new Set());
  // ── Table 13 state ──────────────────────────────────────────────────────────
  const [docRows, setDocRows] = useState<DocRow[]>(makeDefaultDocRows);

  const toUserError = (error: unknown, fallback: string): string => {
    const text = error instanceof Error ? error.message : String(error || "");
    if (text.includes("No handler registered for") || text.includes("No handler registered")) {
      return "GSTR-1 IPC handlers are not active in the current Electron process. Please close and reopen the desktop app once.";
    }
    return text || fallback;
  };

  const loadGstr1 = async () => {
    setLoading(true);
    try {
      const next = await window.gstAPI.loadGstr1Data({
        gstin: selectedClient.gstin,
        financialYear,
        month,
      });
      setData(next);
      setEditedB2BRows(next.b2bRows);

      // ── Auto-fill Table 13 Row 1: Invoices for outward supply ───────────────
      // Collect unique invoice numbers from B2B rows and sort them naturally
      const b2bInvoiceNos = Array.from(
        new Set(next.b2bRows.map((r) => String(r["Invoice Number"] || "").trim()).filter(Boolean))
      ).sort((a, b) => {
        // Natural sort: numeric suffix aware
        const numA = parseInt(a.replace(/\D/g, ""), 10);
        const numB = parseInt(b.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, "en", { sensitivity: "base" });
      });

      if (b2bInvoiceNos.length > 0) {
        setDocRows((prev) =>
          prev.map((row) =>
            row.id === "doc-0"
              ? { ...row, srNoFrom: b2bInvoiceNos[0], srNoTo: b2bInvoiceNos[b2bInvoiceNos.length - 1] }
              : row
          )
        );
      }

      onStatus(`GSTR-1 prepared for ${month}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to generate GSTR-1 data."));
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadGstr1();
  }, [selectedClient.gstin, financialYear, month]);

  const taxableMismatchMap = useMemo(() => {
    const map = new Map<string, boolean>();
    editedB2BRows.forEach((row) => {
      const expectedTax = (toNum(row["Taxable Value"]) * toNum(row.Rate)) / 100;
      const actualTax = toNum(row.IGST) + toNum(row.CGST) + toNum(row.SGST);
      const bad = Math.abs(expectedTax - actualTax) > 1;
      map.set(`${row._saleId}::${row._itemSrNo}`, bad);
    });
    return map;
  }, [editedB2BRows]);

  const filteredB2BRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return editedB2BRows.filter((row) => {
      const invoice = String(row["Invoice Number"] || "").toLowerCase();
      const gstin = String(row["GSTIN/UIN of Recipient"] || "").toLowerCase();
      const buyer = String(row["Receiver Name"] || "").toLowerCase();
      const pos = String(row["Place Of Supply"] || "");

      if (q && !invoice.includes(q) && !gstin.includes(q) && !buyer.includes(q)) return false;
      if (posFilter !== "all" && pos !== posFilter) return false;
      return true;
    });
  }, [editedB2BRows, query, posFilter]);

  const b2csRows = data?.b2csRows || [];
  const b2clRows = data?.b2clRows || [];
  const hsnRows = data?.hsnRows || [];

  const groupedB2BInvoices = useMemo<B2BInvoiceGroup[]>(() => {
    const map = new Map<string, B2BInvoiceGroup>();

    filteredB2BRows.forEach((row) => {
      const groupKey = `${row["GSTIN/UIN of Recipient"]}::${row["Invoice Number"]}::${row["Invoice Date"]}`;
      const existing = map.get(groupKey);

      if (!existing) {
        map.set(groupKey, {
          key: groupKey,
          invoiceNo: String(row["Invoice Number"] || "-"),
          invoiceDate: String(row["Invoice Date"] || ""),
          gstin: String(row["GSTIN/UIN of Recipient"] || ""),
          receiverName: String(row["Receiver Name"] || ""),
          placeOfSupply: String(row["Place Of Supply"] || ""),
          invoiceValue: toNum(row["Invoice Value"]),
          taxable: toNum(row["Taxable Value"]),
          igst: toNum(row.IGST),
          cgst: toNum(row.CGST),
          sgst: toNum(row.SGST),
          rows: [row],
        });
        return;
      }

      existing.rows.push(row);
      existing.taxable += toNum(row["Taxable Value"]);
      existing.igst += toNum(row.IGST);
      existing.cgst += toNum(row.CGST);
      existing.sgst += toNum(row.SGST);
      existing.invoiceValue = Math.max(existing.invoiceValue, toNum(row["Invoice Value"]));
    });

    return Array.from(map.values());
  }, [filteredB2BRows]);

  const b2bTotals = useMemo<TableTotals>(() => {
    return filteredB2BRows.reduce(
      (acc, row) => {
        acc.invoiceValue += toNum(row["Invoice Value"]);
        acc.taxable += toNum(row["Taxable Value"]);
        acc.igst += toNum(row.IGST);
        acc.cgst += toNum(row.CGST);
        acc.sgst += toNum(row.SGST);
        return acc;
      },
      { invoiceValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
    );
  }, [filteredB2BRows]);

  const b2csTotals = useMemo<TableTotals>(() => {
    return b2csRows.reduce(
      (acc, row) => {
        acc.taxable += toNum(row["Taxable Value"]);
        acc.igst += toNum(row.IGST);
        acc.cgst += toNum(row.CGST);
        acc.sgst += toNum(row.SGST);
        return acc;
      },
      { invoiceValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
    );
  }, [b2csRows]);

  const b2clTotals = useMemo<TableTotals>(() => {
    return b2clRows.reduce(
      (acc, row) => {
        acc.invoiceValue += toNum(row["Invoice Value"]);
        acc.taxable += toNum(row["Taxable Value"]);
        acc.igst += toNum(row.IGST);
        acc.cgst += toNum(row.CGST);
        acc.sgst += toNum(row.SGST);
        return acc;
      },
      { invoiceValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
    );
  }, [b2clRows]);

  const hsnTotals = useMemo<TableTotals>(() => {
    return hsnRows.reduce(
      (acc, row) => {
        acc.taxable += toNum(row["Taxable Value"]);
        acc.igst += toNum(row.IGST);
        acc.cgst += toNum(row.CGST);
        acc.sgst += toNum(row.SGST);
        return acc;
      },
      { invoiceValue: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 },
    );
  }, [hsnRows]);

  const b2bPageCount = Math.max(1, Math.ceil(groupedB2BInvoices.length / b2bPageSize));
  const b2csPageCount = Math.max(1, Math.ceil(b2csRows.length / b2csPageSize));
  const b2clPageCount = Math.max(1, Math.ceil(b2clRows.length / b2clPageSize));
  const hsnPageCount = Math.max(1, Math.ceil(hsnRows.length / hsnPageSize));

  const paginatedB2BInvoices = useMemo(() => {
    const start = (b2bPage - 1) * b2bPageSize;
    return groupedB2BInvoices.slice(start, start + b2bPageSize);
  }, [groupedB2BInvoices, b2bPage, b2bPageSize]);

  const paginatedB2CSRows = useMemo(() => {
    const start = (b2csPage - 1) * b2csPageSize;
    return b2csRows.slice(start, start + b2csPageSize);
  }, [b2csRows, b2csPage, b2csPageSize]);

  const paginatedB2CLRows = useMemo(() => {
    const start = (b2clPage - 1) * b2clPageSize;
    return b2clRows.slice(start, start + b2clPageSize);
  }, [b2clRows, b2clPage, b2clPageSize]);

  const paginatedHsnRows = useMemo(() => {
    const start = (hsnPage - 1) * hsnPageSize;
    return hsnRows.slice(start, start + hsnPageSize);
  }, [hsnRows, hsnPage, hsnPageSize]);

  useEffect(() => {
    if (b2bPage > b2bPageCount) setB2BPage(b2bPageCount);
  }, [b2bPage, b2bPageCount]);

  useEffect(() => {
    if (b2csPage > b2csPageCount) setB2CSPage(b2csPageCount);
  }, [b2csPage, b2csPageCount]);

  useEffect(() => {
    if (b2clPage > b2clPageCount) setB2CLPage(b2clPageCount);
  }, [b2clPage, b2clPageCount]);

  useEffect(() => {
    if (hsnPage > hsnPageCount) setHsnPage(hsnPageCount);
  }, [hsnPage, hsnPageCount]);

  useEffect(() => {
    setExpandedB2BInvoices(new Set());
  }, [query, posFilter, month, financialYear, selectedClient.gstin]);

  const renderPagination = (
    totalRows: number,
    page: number,
    pageSize: number,
    pageCount: number,
    onPageChange: (next: number) => void,
    onPageSizeChange: (next: number) => void,
  ) => {
    return (
      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-slate-500">Total rows: {totalRows}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((pageNo) => (
            <button
              key={pageNo}
              type="button"
              onClick={() => onPageChange(pageNo)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${
                pageNo === page ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700"
              }`}
            >
              {pageNo}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const posOptions = useMemo(() => {
    return Array.from(new Set(editedB2BRows.map((row) => row["Place Of Supply"]).filter(Boolean))).sort();
  }, [editedB2BRows]);

  const invalidGstinCount = useMemo(() => {
    return editedB2BRows.filter((row) => !isValidGstin(String(row["GSTIN/UIN of Recipient"] || ""))).length;
  }, [editedB2BRows]);

  const invalidTaxCount = useMemo(() => {
    let count = 0;
    taxableMismatchMap.forEach((bad) => {
      if (bad) count += 1;
    });
    return count;
  }, [taxableMismatchMap]);

  const updateB2B = (index: number, key: keyof Gstr1B2BRow, value: string) => {
    setEditedB2BRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (key === "Rate" || key === "Taxable Value") {
        const numeric = toNum(value);
        row[key] = numeric as never;

        const rate = toNum(key === "Rate" ? numeric : row.Rate);
        const taxable = toNum(key === "Taxable Value" ? numeric : row["Taxable Value"]);
        const tax = (taxable * rate) / 100;

        const gstinCode = String(row["GSTIN/UIN of Recipient"] || "").slice(0, 2);
        const sellerCode = String(selectedClient.gstin || "").slice(0, 2);
        if (gstinCode && gstinCode !== sellerCode) {
          row.IGST = Number(tax.toFixed(2));
          row.CGST = 0;
          row.SGST = 0;
        } else {
          row.IGST = 0;
          row.CGST = Number((tax / 2).toFixed(2));
          row.SGST = Number((tax / 2).toFixed(2));
        }
      } else {
        (row as Record<string, unknown>)[key] = value;
      }

      next[index] = row;
      return next;
    });
  };

  const deleteB2BRow = (index: number) => {
    setEditedB2BRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveEdits = async () => {
    setLoading(true);
    try {
      const next = await window.gstAPI.saveGstr1Data({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        b2bRows: editedB2BRows,
      });
      setData(next);
      setEditedB2BRows(next.b2bRows);
      onStatus("GSTR-1 edits saved to JSON.");
    } catch (error) {
      onStatus(toUserError(error, "Unable to save GSTR-1 edits."));
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = async () => {
    setLoading(true);
    try {
      const result = await window.gstAPI.exportGstr1({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        openFile: true,
      });
      onStatus(`Exported GSTR-1 Excel: ${result.filePath}`);
    } catch (error) {
      onStatus(toUserError(error, "Unable to export GSTR-1 Excel."));
    } finally {
      setLoading(false);
    }
  };

  const markFiled = async () => {
    setLoading(true);
    try {
      await window.gstAPI.markGstr1Filed({
        gstin: selectedClient.gstin,
        financialYear,
        month,
      });
      await loadGstr1();
      onStatus("GSTR-1 marked as filed.");
    } catch (error) {
      onStatus(toUserError(error, "Unable to mark GSTR-1 as filed."));
    } finally {
      setLoading(false);
    }
  };

  const renderB2B = () => {
    const toggleB2BInvoice = (groupKey: string) => {
      setExpandedB2BInvoices((prev) => {
        const next = new Set(prev);
        if (next.has(groupKey)) {
          next.delete(groupKey);
        } else {
          next.add(groupKey);
        }
        return next;
      });
    };

    return (
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span className="mb-1 block text-xs font-medium text-slate-500">Search invoice / GSTIN / buyer</span>
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-none p-0 text-sm outline-none"
                placeholder="Type to filter"
              />
            </div>
          </label>
          <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span className="mb-1 block font-medium text-slate-500">Filter POS</span>
            <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm">
              <option value="all">All</option>
              {posOptions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto">
            <table className="w-full min-w-[1380px] text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">GSTIN of Buyer</th>
                <th className="px-3 py-2 text-left">Party Name</th>
                <th className="px-3 py-2 text-left">Invoice No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Invoice Value</th>
                <th className="px-3 py-2 text-left">Place of Supply</th>
                <th className="px-3 py-2 text-left">Taxable Value</th>
                <th className="px-3 py-2 text-left">GST Rate</th>
                <th className="px-3 py-2 text-left">IGST</th>
                <th className="px-3 py-2 text-left">CGST</th>
                <th className="px-3 py-2 text-left">SGST</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
              <tbody>
              {paginatedB2BInvoices.map((group) => {
                const isExpanded = expandedB2BInvoices.has(group.key);
                const mixedRate = new Set(group.rows.map((row) => toNum(row.Rate))).size > 1;

                return (
                  <>
                    <tr key={`${group.key}-summary`} className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
                      <td className="px-2 py-2">{group.gstin || "-"}</td>
                      <td className="px-2 py-2 min-w-[180px]">{group.receiverName || "-"}</td>
                      <td className="px-2 py-2 min-w-[120px]">
                        <button
                          type="button"
                          onClick={() => toggleB2BInvoice(group.key)}
                          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left text-slate-900 hover:bg-slate-200"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>{group.invoiceNo}</span>
                          <span className="text-xs font-medium text-slate-500">({group.rows.length} items)</span>
                        </button>
                      </td>
                      <td className="px-2 py-2 min-w-[110px]">{formatDateText(group.invoiceDate)}</td>
                      <td className="px-2 py-2">{currency(group.invoiceValue)}</td>
                      <td className="px-2 py-2">{group.placeOfSupply || "-"}</td>
                      <td className="px-2 py-2">{currency(group.taxable)}</td>
                      <td className="px-2 py-2">{mixedRate ? "Multiple" : `${toNum(group.rows[0]?.Rate)}%`}</td>
                      <td className="px-2 py-2 text-cyan-700">{currency(group.igst)}</td>
                      <td className="px-2 py-2 text-emerald-700">{currency(group.cgst)}</td>
                      <td className="px-2 py-2 text-emerald-700">{currency(group.sgst)}</td>
                      <td className="px-2 py-2 text-xs text-slate-500">{isExpanded ? "Collapse" : "Expand"}</td>
                    </tr>

                    {isExpanded &&
                      group.rows.map((row) => {
                        const sourceIndex = editedB2BRows.findIndex((x) => x._saleId === row._saleId && x._itemSrNo === row._itemSrNo);
                        const key = `${row._saleId}::${row._itemSrNo}`;
                        const gstinBad = !isValidGstin(String(row["GSTIN/UIN of Recipient"] || ""));
                        const taxBad = Boolean(taxableMismatchMap.get(key));

                        return (
                          <tr key={key} className={`border-t border-slate-100 ${gstinBad || taxBad ? "bg-rose-50" : "bg-white"}`}>
                            <td className="px-2 py-2">
                              <input
                                value={row["GSTIN/UIN of Recipient"]}
                                onChange={(e) => updateB2B(sourceIndex, "GSTIN/UIN of Recipient", e.target.value.toUpperCase())}
                                className={`w-[170px] rounded border px-2 py-1 text-sm ${gstinBad ? "border-rose-400" : "border-slate-200"}`}
                              />
                            </td>
                            <td className="px-2 py-2 min-w-[180px]">{row["Receiver Name"] || "-"}</td>
                            <td className="px-2 py-2 min-w-[120px] pl-7 text-slate-700">{row["Invoice Number"]} - Item {row._itemSrNo}</td>
                            <td className="px-2 py-2 min-w-[110px]">{formatDateText(row["Invoice Date"])}</td>
                            <td className="px-2 py-2">{currency(row["Invoice Value"])}</td>
                            <td className="px-2 py-2">{row["Place Of Supply"]}</td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                value={row["Taxable Value"]}
                                onChange={(e) => updateB2B(sourceIndex, "Taxable Value", e.target.value)}
                                className={`w-[120px] rounded border px-2 py-1 text-sm ${taxBad ? "border-rose-400" : "border-slate-200"}`}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                value={row.Rate}
                                onChange={(e) => updateB2B(sourceIndex, "Rate", e.target.value)}
                                className="w-[82px] rounded border border-slate-200 px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2 text-cyan-700">{row.IGST.toFixed(2)}</td>
                            <td className="px-2 py-2 text-emerald-700">{row.CGST.toFixed(2)}</td>
                            <td className="px-2 py-2 text-emerald-700">{row.SGST.toFixed(2)}</td>
                            <td className="px-2 py-2">
                              <button
                                type="button"
                                onClick={() => deleteB2BRow(sourceIndex)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </>
                );
              })}
              {filteredB2BRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                    No B2B rows found.
                  </td>
                </tr>
              )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-100 text-sm font-bold text-slate-800">
                <tr className="border-t border-slate-300">
                  <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                  <td className="px-3 py-2">{currency(b2bTotals.invoiceValue)}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2">{currency(b2bTotals.taxable)}</td>
                  <td className="px-3 py-2">-</td>
                  <td className="px-3 py-2 text-cyan-800">{currency(b2bTotals.igst)}</td>
                  <td className="px-3 py-2 text-emerald-800">{currency(b2bTotals.cgst)}</td>
                  <td className="px-3 py-2 text-emerald-800">{currency(b2bTotals.sgst)}</td>
                  <td className="px-3 py-2">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {renderPagination(groupedB2BInvoices.length, b2bPage, b2bPageSize, b2bPageCount, setB2BPage, setB2BPageSize)}
        </div>
      </div>
    );
  };

  const renderB2CS = () => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">POS</th>
                <th className="px-3 py-2 text-left">GST Rate</th>
                <th className="px-3 py-2 text-left">Taxable Value</th>
                <th className="px-3 py-2 text-left">IGST</th>
                <th className="px-3 py-2 text-left">CGST</th>
                <th className="px-3 py-2 text-left">SGST</th>
              </tr>
            </thead>
            <tbody>
              {paginatedB2CSRows.map((row, idx) => (
                <tr key={`${row["Place Of Supply"]}-${row.Rate}-${idx}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row["Place Of Supply"]}</td>
                  <td className="px-3 py-2">{row.Rate}%</td>
                  <td className="px-3 py-2">{currency(row["Taxable Value"])}</td>
                  <td className="px-3 py-2 text-cyan-700">{currency(row.IGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.CGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.SGST)}</td>
                </tr>
              ))}
              {b2csRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No B2C Small rows found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-100 text-sm font-bold text-slate-800">
              <tr className="border-t border-slate-300">
                <td className="px-3 py-2" colSpan={2}>TOTAL</td>
                <td className="px-3 py-2">{currency(b2csTotals.taxable)}</td>
                <td className="px-3 py-2 text-cyan-800">{currency(b2csTotals.igst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(b2csTotals.cgst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(b2csTotals.sgst)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {renderPagination(b2csRows.length, b2csPage, b2csPageSize, b2csPageCount, setB2CSPage, setB2CSPageSize)}
      </div>
    );
  };

  const renderB2CL = () => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="min-w-[1060px] text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Invoice No</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">POS</th>
                <th className="px-3 py-2 text-left">Invoice Value</th>
                <th className="px-3 py-2 text-left">Taxable Value</th>
                <th className="px-3 py-2 text-left">GST Rate</th>
                <th className="px-3 py-2 text-left">IGST</th>
                <th className="px-3 py-2 text-left">CGST</th>
                <th className="px-3 py-2 text-left">SGST</th>
              </tr>
            </thead>
            <tbody>
              {paginatedB2CLRows.map((row, idx) => (
                <tr key={`${row["Invoice Number"]}-${idx}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row["Invoice Number"]}</td>
                  <td className="px-3 py-2">{formatDateText(row["Invoice Date"])}</td>
                  <td className="px-3 py-2">{row["Place Of Supply"]}</td>
                  <td className="px-3 py-2">{currency(row["Invoice Value"])}</td>
                  <td className="px-3 py-2">{currency(row["Taxable Value"])}</td>
                  <td className="px-3 py-2">{row.Rate}%</td>
                  <td className="px-3 py-2 text-cyan-700">{currency(row.IGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.CGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.SGST)}</td>
                </tr>
              ))}
              {b2clRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No B2C Large rows found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-100 text-sm font-bold text-slate-800">
              <tr className="border-t border-slate-300">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2">{currency(b2clTotals.invoiceValue)}</td>
                <td className="px-3 py-2">{currency(b2clTotals.taxable)}</td>
                <td className="px-3 py-2">-</td>
                <td className="px-3 py-2 text-cyan-800">{currency(b2clTotals.igst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(b2clTotals.cgst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(b2clTotals.sgst)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {renderPagination(b2clRows.length, b2clPage, b2clPageSize, b2clPageCount, setB2CLPage, setB2CLPageSize)}
      </div>
    );
  };

  const renderHSN = () => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">HSN Code</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Quantity</th>
                <th className="px-3 py-2 text-left">GST Rate</th>
                <th className="px-3 py-2 text-left">Taxable Value</th>
                <th className="px-3 py-2 text-left">IGST</th>
                <th className="px-3 py-2 text-left">CGST</th>
                <th className="px-3 py-2 text-left">SGST</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHsnRows.map((row, idx) => (
                <tr key={`${row.HSN}-${idx}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.HSN}</td>
                  <td className="px-3 py-2 min-w-[280px]">{row.Description}</td>
                  <td className="px-3 py-2">{row["Total Quantity"]}</td>
                  <td className="px-3 py-2">{row.Rate}%</td>
                  <td className="px-3 py-2">{currency(row["Taxable Value"])}</td>
                  <td className="px-3 py-2 text-cyan-700">{currency(row.IGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.CGST)}</td>
                  <td className="px-3 py-2 text-emerald-700">{currency(row.SGST)}</td>
                </tr>
              ))}
              {hsnRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    No HSN rows found.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gray-100 text-sm font-bold text-slate-800">
              <tr className="border-t border-slate-300">
                <td className="px-3 py-2" colSpan={4}>TOTAL</td>
                <td className="px-3 py-2">{currency(hsnTotals.taxable)}</td>
                <td className="px-3 py-2 text-cyan-800">{currency(hsnTotals.igst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(hsnTotals.cgst)}</td>
                <td className="px-3 py-2 text-emerald-800">{currency(hsnTotals.sgst)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {renderPagination(hsnRows.length, hsnPage, hsnPageSize, hsnPageCount, setHsnPage, setHsnPageSize)}
      </div>
    );
  };

  return (
    <section className="space-y-4">
      {/* ── Modern Header Card ──────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0c2340 100%)",
        }}
      >
        {/* Decorative accent line */}
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
          style={{ background: "linear-gradient(180deg, #6366f1, #3b82f6, #06b6d4)" }}
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">GSTR-1 Return</p>
              <p className="mt-0.5 truncate text-base font-bold text-white">{selectedClient.clientName}</p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide"
                  style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
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
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              id="btn-generate-gstr1"
              type="button"
              onClick={loadGstr1}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}
            >
              <RefreshCcw size={13} />
              Generate GSTR-1
            </button>
            <button
              id="btn-save-gstr1"
              type="button"
              onClick={saveEdits}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", color: "#e2e8f0" }}
            >
              <Save size={13} />
              Save Changes
            </button>
            <button
              id="btn-export-gstr1"
              type="button"
              onClick={exportExcel}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.13)", color: "#e2e8f0" }}
            >
              <Download size={13} />
              Export Excel
            </button>
            <button
              id="btn-filed-gstr1"
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total B2B Sales</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{currency(data.summary.totalB2BSales)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total B2C Sales</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{currency(data.summary.totalB2CSales)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Taxable Value</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{currency(data.summary.totalTaxableValue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Regular GST</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{currency(data.summary.totalGst)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Reverse Charge GST (Deemed)</p>
            <p className="mt-1 text-lg font-bold text-blue-800">{currency(data.summary.reverseChargeGst || 0)}</p>
          </div>
        </div>
      )}

      {(invalidGstinCount > 0 || invalidTaxCount > 0 || (data?.warnings.length || 0) > 0) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="inline-flex items-center gap-2 font-semibold">
            <TriangleAlert size={15} /> Validation Warnings
          </p>
          <p className="mt-1">Missing/Invalid GSTIN rows: {invalidGstinCount} | GST mismatch rows: {invalidTaxCount}</p>
          {(data?.warnings || []).slice(0, 4).map((warning, idx) => (
            <p key={`${warning}-${idx}`} className="mt-0.5 text-xs">• {warning}</p>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "b2b" && renderB2B()}
      {activeTab === "b2cs" && renderB2CS()}
      {activeTab === "b2cl" && renderB2CL()}
      {activeTab === "hsn" && renderHSN()}

      {activeTab === "docs" && (
        <div className="space-y-4">
          {/* Table 13 header */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Info size={15} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-900">Table 13 — Documents Issued During the Tax Period</h3>
                <p className="mt-0.5 text-xs text-blue-700">
                  Mandatory from May 2025. Enter the serial number range for each document type issued this month.
                  Total and Net Issued are auto-calculated. Leave blank for document types not used.
                </p>
              </div>
            </div>
          </div>

          {/* Table 13 editable grid */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-left w-8">#</th>
                    <th className="px-3 py-3 text-left">Nature of Document</th>
                    <th className="px-3 py-3 text-center w-32">Sr. No. From</th>
                    <th className="px-3 py-3 text-center w-32">Sr. No. To</th>
                    <th className="px-3 py-3 text-center w-28">Total Number</th>
                    <th className="px-3 py-3 text-center w-28">Cancelled</th>
                    <th className="px-3 py-3 text-center w-28">Net Issued</th>
                  </tr>
                </thead>
                <tbody>
                  {docRows.map((row, idx) => {
                    // Auto-calculate Total from Sr. No. From/To (numeric suffix extraction)
                    const fromNum = parseInt(String(row.srNoFrom || "").replace(/\D/g, ""), 10);
                    const toNum2 = parseInt(String(row.srNoTo || "").replace(/\D/g, ""), 10);
                    const total = (!isNaN(fromNum) && !isNaN(toNum2) && toNum2 >= fromNum)
                      ? toNum2 - fromNum + 1
                      : (row.srNoFrom || row.srNoTo ? "-" : "");
                    const netIssued = typeof total === "number"
                      ? Math.max(0, total - (Number(row.cancelled) || 0))
                      : "";

                    const isOutward = idx === 0;
                    const rowBg = isOutward
                      ? "bg-indigo-50/60"
                      : idx % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50/50";

                    return (
                      <tr key={row.id} className={`border-t border-slate-100 transition hover:bg-blue-50/30 ${rowBg}`}>
                        <td className="px-3 py-2.5 text-center text-xs font-medium text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-sm ${isOutward ? "font-semibold text-indigo-800" : "text-slate-700"}`}>
                            {row.nature}
                          </span>
                          {isOutward && (
                            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">Primary</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="text"
                            placeholder="e.g. INV-001"
                            value={row.srNoFrom}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDocRows((prev) =>
                                prev.map((r) => r.id === row.id ? { ...r, srNoFrom: val } : r)
                              );
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="text"
                            placeholder="e.g. INV-100"
                            value={row.srNoTo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDocRows((prev) =>
                                prev.map((r) => r.id === row.id ? { ...r, srNoTo: val } : r)
                              );
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-mono focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-sm font-semibold ${
                            typeof total === "number" && total > 0 ? "text-slate-800" : "text-slate-400"
                          }`}>
                            {total === "" ? "—" : total}
                          </span>
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            min={0}
                            value={row.cancelled}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setDocRows((prev) =>
                                prev.map((r) => r.id === row.id ? { ...r, cancelled: val } : r)
                              );
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs text-rose-700 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-sm font-bold ${
                            typeof netIssued === "number" && netIssued > 0
                              ? "text-emerald-700"
                              : "text-slate-400"
                          }`}>
                            {netIssued === "" ? "—" : netIssued}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer totals */}
                <tfoot className="bg-slate-100 text-sm font-bold text-slate-800">
                  <tr className="border-t-2 border-slate-300">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-xs uppercase tracking-wide text-slate-500">Grand Total</td>
                    <td className="px-3 py-2.5 text-center text-slate-800">
                      {docRows.reduce((sum, row) => {
                        const f = parseInt(String(row.srNoFrom || "").replace(/\D/g, ""), 10);
                        const t = parseInt(String(row.srNoTo || "").replace(/\D/g, ""), 10);
                        if (!isNaN(f) && !isNaN(t) && t >= f) return sum + (t - f + 1);
                        return sum;
                      }, 0) || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-rose-700">
                      {docRows.reduce((sum, row) => sum + (Number(row.cancelled) || 0), 0) || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-emerald-700">
                      {(() => {
                        let total = 0;
                        docRows.forEach((row) => {
                          const f = parseInt(String(row.srNoFrom || "").replace(/\D/g, ""), 10);
                          const t = parseInt(String(row.srNoTo || "").replace(/\D/g, ""), 10);
                          if (!isNaN(f) && !isNaN(t) && t >= f) total += (t - f + 1) - (Number(row.cancelled) || 0);
                        });
                        return total || "—";
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Quick-fill helper */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
              <p className="text-xs text-slate-500">
                💡 <strong>Tip:</strong> Enter the first and last invoice serial numbers issued this month. Cancelled = docs voided/not used.
              </p>
              <button
                type="button"
                onClick={() => setDocRows(makeDefaultDocRows())}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Reset Table
              </button>
            </div>
          </div>

          {/* Document Summary card + Filing History side by side */}
          {data && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">Auto-Computed Document Summary</h3>
                <p className="mt-0.5 text-xs text-slate-500">Derived from B2B and B2C sales entered in the system</p>
                <div className="mt-3 divide-y divide-slate-100 text-sm">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Total Invoices Issued</span>
                    <span className="font-bold text-slate-800">{data.documentSummary.totalInvoicesIssued}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Cancelled Invoices</span>
                    <span className="font-medium text-rose-700">{data.documentSummary.cancelledInvoices}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-semibold text-slate-700">Net Issued</span>
                    <span className="font-bold text-emerald-700">{data.documentSummary.netIssued}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">Filing History</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {data.filingHistory.length === 0 && (
                    <p className="text-slate-500">No filing history yet.</p>
                  )}
                  {data.filingHistory.slice(0, 6).map((row, idx) => (
                    <div key={`${row.filedAt}-${idx}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs text-slate-500">{row.month} · {row.financialYear}</span>
                      <span className="text-xs font-medium text-slate-700">{new Date(row.filedAt).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {loading && <p className="text-xs text-slate-500">Processing...</p>}
    </section>
  );
}
