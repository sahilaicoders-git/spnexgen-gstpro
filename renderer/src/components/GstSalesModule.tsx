import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileDown, FileSpreadsheet, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { ClientRecord, MasterPartyResponse, SaleItem, SaleRecord } from "../types";
import PartyLookupDropdown from "./PartyLookupDropdown";

// ── GST State code map for CSV POS format ────────────────────────────────────
const STATE_CODE_MAP: Record<string, string> = {
  "Jammu & Kashmir": "01", "Himachal Pradesh": "02", "Punjab": "03",
  "Chandigarh": "04", "Uttarakhand": "05", "Haryana": "06", "Delhi": "07",
  "Rajasthan": "08", "Uttar Pradesh": "09", "Bihar": "10", "Sikkim": "11",
  "Arunachal Pradesh": "12", "Nagaland": "13", "Manipur": "14", "Mizoram": "15",
  "Tripura": "16", "Meghalaya": "17", "Assam": "18", "West Bengal": "19",
  "Jharkhand": "20", "Odisha": "21", "Chhattisgarh": "22", "Madhya Pradesh": "23",
  "Gujarat": "24", "Maharashtra": "27", "Karnataka": "29", "Goa": "30",
  "Kerala": "32", "Tamil Nadu": "33", "Puducherry": "34", "Telangana": "36",
  "Andhra Pradesh": "37", "Ladakh": "38",
};

// ── Format date as dd-MMM-yy for GST portal CSV ──────────────────────────────
function formatDateForCsv(isoDate: string): string {
  if (!isoDate) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Accept YYYY-MM-DD or DD-MM-YYYY or DD/MM/YYYY
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    d = new Date(isoDate);
  } else {
    const parts = isoDate.replace(/\//g, "-").split("-");
    if (parts.length === 3 && parts[0].length <= 2) {
      d = new Date(`${parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}`);
    }
  }
  if (!d || isNaN(d.getTime())) return isoDate;
  const yy = String(d.getFullYear()).slice(-2);
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${yy}`;
}

// ── Build POS string like "27-Maharashtra" ───────────────────────────────────
function buildPosString(state: string): string {
  if (!state) return "";
  // If already in "27-Maharashtra" format, return as-is
  if (/^\d{2}-/.test(state)) return state;
  const code = STATE_CODE_MAP[state] || "";
  return code ? `${code}-${state}` : state;
}

// ── Generate B2B CSV (GST portal format) ─────────────────────────────────────
function generateB2BCSVContent(b2bSales: SaleRecord[]): string {
  const header = [
    "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice date",
    "Invoice Value", "Place Of Supply", "Reverse Charge", "Applicable % of Tax Rate",
    "Invoice Type", "E-Commerce GSTIN", "Rate", "Taxable Value", "Cess Amount",
  ];

  const lines: string[] = [header.join(",")];

  for (const sale of b2bSales) {
    // Each sale may have multiple items at different rates — emit one row per item
    const items = sale.items && sale.items.length > 0 ? sale.items : [{
      gst_rate: 0, taxable_value: sale.taxable_value, igst: 0, cgst: 0, sgst: 0,
      description: "", hsn_sac: "", quantity: 1, rate: 0, total_amount: sale.total_value, sr_no: 1,
    }];

    // Group by GST rate and sum taxable values
    const rateMap = new Map<number, number>();
    for (const item of items) {
      const r = item.gst_rate ?? 0;
      rateMap.set(r, (rateMap.get(r) || 0) + (item.taxable_value ?? 0));
    }

    for (const [gstRate, taxableSum] of rateMap.entries()) {
      const row = [
        sale.buyer_gstin || "",
        sale.buyer_name || "",
        sale.invoice_no || "",
        formatDateForCsv(sale.date),
        sale.total_value.toFixed(0),
        buildPosString(sale.place_of_supply || ""),
        sale.reverse_charge === "Yes" ? "Y" : "N",
        "",                      // Applicable % of Tax Rate
        "Regular B2B",           // Invoice Type
        "",                      // E-Commerce GSTIN
        String(gstRate),
        taxableSum.toFixed(0),
        "0",                     // Cess Amount
      ];
      lines.push(row.map(v => String(v).includes(",") ? `"${v}"` : v).join(","));
    }
  }

  return lines.join("\r\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  mode: "add" | "summary" | "export" | "import";
  onStatus: (text: string) => void;
};

const STATES = [
  "01-Jammu & Kashmir",
  "02-Himachal Pradesh",
  "03-Punjab",
  "04-Chandigarh",
  "05-Uttarakhand",
  "06-Haryana",
  "07-Delhi",
  "08-Rajasthan",
  "09-Uttar Pradesh",
  "10-Bihar",
  "11-Sikkim",
  "12-Arunachal Pradesh",
  "13-Nagaland",
  "14-Manipur",
  "15-Mizoram",
  "16-Tripura",
  "17-Meghalaya",
  "18-Assam",
  "19-West Bengal",
  "20-Jharkhand",
  "21-Odisha",
  "22-Chhattisgarh",
  "23-Madhya Pradesh",
  "24-Gujarat",
  "26-Dadra & Nagar Haveli and Daman & Diu",
  "27-Maharashtra",
  "29-Karnataka",
  "30-Goa",
  "31-Lakshadweep",
  "32-Kerala",
  "33-Tamil Nadu",
  "34-Puducherry",
  "35-Andaman & Nicobar Islands",
  "36-Telangana",
  "37-Andhra Pradesh",
  "38-Ladakh",
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

function emptyItem(srNo: number): SaleItem {
  return {
    sr_no: srNo,
    description: "",
    hsn_sac: "",
    quantity: 1,
    rate: 0,
    taxable_value: 0,
    gst_rate: 18,
    igst: 0,
    cgst: 0,
    sgst: 0,
    total_amount: 0,
  };
}

function createInvoiceNumber(prefix: string, existingSales: SaleRecord[] = []) {
  if (!existingSales || existingSales.length === 0) {
    return `${prefix}1`;
  }

  const numericSuffixes = existingSales
    .filter((s) => s.invoice_no.startsWith(prefix))
    .map((s) => {
      const suffix = s.invoice_no.slice(prefix.length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? 0 : num;
    });

  const maxSuffix = numericSuffixes.length > 0 ? Math.max(...numericSuffixes) : 0;
  const nextNum = (maxSuffix + 1).toString();
  return `${prefix}${nextNum}`;
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────
type EditModalProps = {
  sale: SaleRecord;
  saleType: "b2b" | "b2c";
  supplierState: string;
  customerMaster: MasterPartyResponse;
  clientGstin: string;
  onSave: (updated: SaleRecord) => Promise<void>;
  onClose: () => void;
  onRefreshCustomers: () => Promise<void>;
};

function EditSaleModal({ sale, saleType, supplierState, customerMaster, clientGstin, onSave, onClose, onRefreshCustomers }: EditModalProps) {
  const [invoiceNo, setInvoiceNo] = useState(sale.invoice_no);
  const [invoiceDate, setInvoiceDate] = useState(sale.date);
  const [placeOfSupply, setPlaceOfSupply] = useState(sale.place_of_supply || supplierState);
  const [reverseCharge, setReverseCharge] = useState<"Yes" | "No">(
    (sale.reverse_charge as "Yes" | "No") || "No"
  );
  const [b2cType, setB2cType] = useState<"B2C Large" | "B2C Small">(
    (sale.type as "B2C Large" | "B2C Small") || "B2C Small"
  );
  const [buyerGstin, setBuyerGstin] = useState(sale.buyer_gstin || "");
  const [buyerName, setBuyerName] = useState(sale.buyer_name || "");
  const [items, setItems] = useState<SaleItem[]>(
    sale.items && sale.items.length > 0 ? sale.items : [emptyItem(1)]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer suggestion state for modal
  const [customerQuery, setCustomerQuery] = useState(sale.buyer_gstin || "");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customerMaster.entries;
    return customerMaster.entries.filter((row) => {
      return row.gstin.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
  }, [customerMaster.entries, customerQuery]);

  const selectCustomer = async (customer: { gstin: string; name: string; state: string }) => {
    setBuyerGstin(customer.gstin);
    setBuyerName(customer.name);
    if (customer.state) {
      const withCode = STATES.find(s => s.includes(customer.state));
      setPlaceOfSupply(withCode || customer.state);
    }
    setCustomerQuery(customer.gstin);
    setShowCustomerSuggestions(false);

    await window.gstAPI.saveCustomer({
      gstin: clientGstin,
      customer,
      touchRecent: true,
    });
    await onRefreshCustomers();
  };

  const handleCustomerFavorite = async (gstin: string, favorite: boolean) => {
    await window.gstAPI.toggleCustomerFavorite({ gstin: clientGstin, customerGstin: gstin, favorite });
    await onRefreshCustomers();
  };

  const handleCustomerDelete = async (gstin: string) => {
    await window.gstAPI.deleteCustomer({ gstin: clientGstin, customerGstin: gstin });
    await onRefreshCustomers();
  };

  const handleCustomerRename = async (option: { gstin: string; name: string; state: string }) => {
    const nextName = window.prompt("Customer name", option.name) || option.name;
    const nextState = window.prompt("State", option.state || placeOfSupply) || option.state;
    await window.gstAPI.updateCustomer({
      gstin: clientGstin,
      customer: { gstin: option.gstin, name: nextName, state: nextState },
    });
    await onRefreshCustomers();
  };

  const interstate = placeOfSupply !== supplierState;

  const recalcItems = (list: SaleItem[]) =>
    list.map((item) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const taxable = Number((qty * rate).toFixed(2));
      const gstRate = Number(item.gst_rate || 0);
      const totalTax = Number(((taxable * gstRate) / 100).toFixed(2));
      const igst = interstate ? totalTax : 0;
      const cgst = interstate ? 0 : Number((totalTax / 2).toFixed(2));
      const sgst = interstate ? 0 : Number((totalTax / 2).toFixed(2));
      return {
        ...item,
        taxable_value: taxable,
        igst,
        cgst,
        sgst,
        total_amount: Number((taxable + igst + cgst + sgst).toFixed(2)),
      };
    });

  useEffect(() => {
    setItems((prev) => recalcItems(prev));
  }, [placeOfSupply]);

  const handleItemChange = (index: number, key: keyof SaleItem, value: string) => {
    const updated = items.map((item, idx) => {
      if (idx !== index) return item;
      if (["quantity", "rate", "gst_rate"].includes(key)) {
        return { ...item, [key]: Number(value || 0) };
      }
      return { ...item, [key]: value };
    });
    setItems(recalcItems(updated));
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  const removeRow = (index: number) => {
    const next = items
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, sr_no: idx + 1 }));
    setItems(next.length > 0 ? recalcItems(next) : [emptyItem(1)]);
  };

  const totals = useMemo(() => {
    const taxable = items.reduce((sum, item) => sum + Number(item.taxable_value || 0), 0);
    const gstAmount = items.reduce(
      (sum, item) => sum + Number(item.igst || 0) + Number(item.cgst || 0) + Number(item.sgst || 0),
      0
    );
    return {
      taxable: Number(taxable.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      total: Math.round(taxable + (reverseCharge === "Yes" ? 0 : gstAmount)),
    };
  }, [items]);

  const handleSave = async () => {
    if (!invoiceNo.trim()) { setError("Invoice number is required."); return; }
    if (saleType === "b2b" && !GSTIN_REGEX.test(buyerGstin.toUpperCase())) {
      setError("Valid buyer GSTIN is required for B2B."); return;
    }
    for (const item of items) {
      if (Number(item.quantity) <= 0) { setError("Quantity must be > 0."); return; }
      if (Number(item.rate) <= 0) { setError("Rate must be > 0."); return; }
    }
    setError("");
    setSaving(true);
    try {
      const updated: SaleRecord = {
        ...sale,
        invoice_no: invoiceNo.trim(),
        date: invoiceDate,
        place_of_supply: placeOfSupply,
        buyer_gstin: saleType === "b2b" ? buyerGstin.toUpperCase() : undefined,
        buyer_name: saleType === "b2b" ? buyerName.trim() : undefined,
        reverse_charge: saleType === "b2b" ? reverseCharge : undefined,
        type: saleType === "b2c" ? b2cType : undefined,
        items,
        taxable_value: totals.taxable,
        gst_amount: totals.gstAmount,
        total_value: totals.total,
      };
      await onSave(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Edit {saleType.toUpperCase()} Sale
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Invoice: <span className="font-medium text-slate-700">{sale.invoice_no}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Invoice header fields */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Invoice Number</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Invoice Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Place of Supply</label>
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {saleType === "b2b" && (
              <>
                <PartyLookupDropdown
                  label="Buyer GSTIN"
                  gstinValue={buyerGstin}
                  query={customerQuery}
                  placeholder="Search GSTIN or customer"
                  options={filteredCustomers}
                  show={showCustomerSuggestions}
                  onShowChange={setShowCustomerSuggestions}
                  onQueryChange={setCustomerQuery}
                  onGstinChange={(next) => {
                    setBuyerGstin(next);
                    setCustomerQuery(next);
                  }}
                  onSelect={selectCustomer}
                  onAddNew={() => {
                    setBuyerGstin("");
                    setCustomerQuery("");
                    setBuyerName("");
                    setShowCustomerSuggestions(false);
                  }}
                  addNewLabel="Clear / Add New"
                  onToggleFavorite={handleCustomerFavorite}
                  onDelete={handleCustomerDelete}
                  onRename={handleCustomerRename}
                />
                <div>
                  <label className="text-xs font-medium text-slate-600">Buyer Name</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Reverse Charge</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    value={reverseCharge}
                    onChange={(e) => setReverseCharge(e.target.value as "Yes" | "No")}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
              </>
            )}

            {saleType === "b2c" && (
              <div>
                <label className="text-xs font-medium text-slate-600">Supply Type</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  value={b2cType}
                  onChange={(e) => setB2cType(e.target.value as "B2C Large" | "B2C Small")}
                >
                  <option>B2C Small</option>
                  <option>B2C Large</option>
                </select>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Items</h3>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
              >
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[1040px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-2 py-2">Sr</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">HSN/SAC</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Rate</th>
                    <th className="px-2 py-2">Taxable</th>
                    <th className="px-2 py-2">GST %</th>
                    <th className="px-2 py-2">IGST</th>
                    <th className="px-2 py-2">CGST</th>
                    <th className="px-2 py-2">SGST</th>
                    <th className="px-2 py-2">Total</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item, idx) => (
                    <tr key={item.sr_no}>
                      <td className="px-2 py-2 text-slate-600">{item.sr_no}</td>
                      <td className="px-2 py-2">
                        <input
                          className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
                          value={item.hsn_sac}
                          onChange={(e) => handleItemChange(idx, "hsn_sac", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-18 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-slate-700">{item.taxable_value.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
                          value={item.gst_rate}
                          onChange={(e) => handleItemChange(idx, "gst_rate", e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-2 text-slate-700">{item.igst.toFixed(2)}</td>
                      <td className="px-2 py-2 text-slate-700">{item.cgst.toFixed(2)}</td>
                      <td className="px-2 py-2 text-slate-700">{item.sgst.toFixed(2)}</td>
                      <td className="px-2 py-2 font-medium text-slate-700">
                        {item.total_amount.toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="rounded bg-rose-100 p-1 text-rose-600 hover:bg-rose-200"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals row */}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                Taxable: <span className="font-semibold">{totals.taxable.toFixed(2)}</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                GST: <span className="font-semibold">{totals.gstAmount.toFixed(2)}</span>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">
                Total: <span className="font-semibold text-cyan-700">₹{Math.round(totals.total).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GstSalesModule({ selectedClient, financialYear, month, mode, onStatus }: Props) {
  const supplierCode = selectedClient.gstin.slice(0, 2);
  const supplierName = STATE_CODES[supplierCode] || "Maharashtra";
  const supplierState = `${supplierCode}-${supplierName}`;

  const [saleType, setSaleType] = useState<"b2b" | "b2c">("b2b");
  const [invoiceNo, setInvoiceNo] = useState(createInvoiceNumber(selectedClient.invoicePrefix || "INV"));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState(supplierState);
  const [reverseCharge, setReverseCharge] = useState<"Yes" | "No">("No");
  const [b2cType, setB2cType] = useState<"B2C Large" | "B2C Small">("B2C Small");
  const [items, setItems] = useState<SaleItem[]>([emptyItem(1)]);
  const [customerMaster, setCustomerMaster] = useState<MasterPartyResponse>({ map: {}, entries: [], favorites: [], recent: [] });
  const [customerQuery, setCustomerQuery] = useState("");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [manualCustomerEntry, setManualCustomerEntry] = useState(false);

  const [salesData, setSalesData] = useState<{ b2b: SaleRecord[]; b2c: SaleRecord[] }>({ b2b: [], b2c: [] });
  const [summaryTab, setSummaryTab] = useState<"b2b" | "b2c">("b2b");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [openAfterExport, setOpenAfterExport] = useState(true);

  useEffect(() => {
    // Synchronize invoice number with current client's prefix preference and next available number
    const relevantSales = saleType === "b2b" ? salesData.b2b : salesData.b2c;
    setInvoiceNo(createInvoiceNumber(selectedClient.invoicePrefix || "INV", relevantSales));
  }, [selectedClient.gstin, selectedClient.invoicePrefix, salesData, saleType]);

  // ── Import state ────────────────────────────────────────────────────────────
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<SaleRecord[]>([]);
  const [previewMissingColumns, setPreviewMissingColumns] = useState<string[]>([]);
  const [previewSummary, setPreviewSummary] = useState({ total: 0, valid: 0, duplicates: 0, errors: 0 });
  const [previewWarning, setPreviewWarning] = useState("");
  const [overwriteImport, setOverwriteImport] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState("");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      onStatus("Invalid file type. Please upload .xlsx");
      return;
    }
    setFileName(file.name);
    const pathFromElectronFile = (file as File & { path?: string }).path || "";
    if (!pathFromElectronFile) {
      onStatus("File path not available.");
      return;
    }
    setSelectedFilePath(pathFromElectronFile);

    try {
      const result = await window.gstAPI.previewSalesImport({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        filePath: pathFromElectronFile,
      });

      if (!result.ok && result.warning) {
        setPreviewWarning(result.warning);
      } else {
        setPreviewWarning("");
      }

      setPreviewMissingColumns(result.requiredMissing || []);
      setPreviewRows(result.rows || []);
      setPreviewSummary(result.summary || { total: 0, valid: 0, duplicates: 0, errors: 0 });
    } catch (err: any) {
      onStatus(`Error: ${err.message}`);
    }
  };

  const confirmImport = async () => {
    if (!selectedFilePath || previewRows.length === 0) {
      onStatus("Please select file first.");
      return;
    }
    try {
      const result = await window.gstAPI.importSalesData({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        previewData: previewRows,
        overwrite: overwriteImport,
      });
      onStatus(`${result.imported || 0} records imported successfully`);
      cancelImport();
      loadSales();
    } catch (err: any) {
      onStatus(`Import failed: ${err.message}`);
    }
  };

  const cancelImport = () => {
    setFileName("");
    setSelectedFilePath("");
    setPreviewRows([]);
    setPreviewMissingColumns([]);
    setPreviewWarning("");
    setPreviewSummary({ total: 0, valid: 0, duplicates: 0, errors: 0 });
  };

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editSale, setEditSale] = useState<{ sale: SaleRecord; saleType: "b2b" | "b2c" } | null>(null);

  const interstate = placeOfSupply !== supplierState;

  const recalculateItems = (list: SaleItem[]) => {
    return list.map((item) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const taxable = Number((qty * rate).toFixed(2));
      const gstRate = Number(item.gst_rate || 0);
      const totalTax = Number(((taxable * gstRate) / 100).toFixed(2));

      const igst = interstate ? totalTax : 0;
      const cgst = interstate ? 0 : Number((totalTax / 2).toFixed(2));
      const sgst = interstate ? 0 : Number((totalTax / 2).toFixed(2));

      return {
        ...item,
        taxable_value: taxable,
        igst,
        cgst,
        sgst,
        total_amount: Number((taxable + igst + cgst + sgst).toFixed(2)),
      };
    });
  };

  useEffect(() => {
    setItems((prev) => recalculateItems(prev));
  }, [placeOfSupply]);

  useEffect(() => {
    if (saleType !== "b2b") {
      setCustomerMaster({ map: {}, entries: [], favorites: [], recent: [] });
      setShowCustomerSuggestions(false);
      return;
    }

    let cancelled = false;
    window.gstAPI
      .loadCustomers({ gstin: selectedClient.gstin })
      .then((data) => {
        if (cancelled) return;
        setCustomerMaster(data);
      })
      .catch(() => {
        if (cancelled) return;
        setCustomerMaster({ map: {}, entries: [], favorites: [], recent: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [saleType, selectedClient.gstin]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customerMaster.entries;
    return customerMaster.entries.filter((row) => {
      return row.gstin.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
  }, [customerMaster.entries, customerQuery]);

  useEffect(() => {
    if (saleType !== "b2b") return;
    
    // Auto-fill state based on first 2 digits of GSTIN
    if (buyerGstin.length >= 2) {
      const code = buyerGstin.slice(0, 2);
      const matchedState = STATES.find(s => s.startsWith(code));
      if (matchedState) setPlaceOfSupply(matchedState);
    }

    if (!GSTIN_REGEX.test(buyerGstin)) return;
    if (buyerName.trim()) return;

    const existing = customerMaster.entries.find((c) => c.gstin.toUpperCase() === buyerGstin.toUpperCase());
    if (existing) {
      setBuyerName(existing.name);
      if (existing.state) {
        const withCode = STATES.find(s => s.includes(existing.state));
        if (withCode) setPlaceOfSupply(withCode);
        else setPlaceOfSupply(existing.state);
      }
      return;
    }

    const pan = buyerGstin.slice(2, 12);
    setBuyerName(`Buyer ${pan}`);
  }, [buyerGstin, buyerName, saleType, customerMaster.entries]);

  const totals = useMemo(() => {
    const taxable = items.reduce((sum, item) => sum + Number(item.taxable_value || 0), 0);
    const gstAmount = items.reduce((sum, item) => sum + Number(item.igst || 0) + Number(item.cgst || 0) + Number(item.sgst || 0), 0);
    return {
      taxable: Number(taxable.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      total: Number((taxable + (reverseCharge === "Yes" ? 0 : gstAmount)).toFixed(2)),
    };
  }, [items, reverseCharge]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await window.gstAPI.loadSales({
        gstin: selectedClient.gstin,
        financialYear,
        month,
        invoiceQuery: invoiceSearch,
        fromDate,
        toDate,
      });
      setSalesData(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [selectedClient.gstin, financialYear, month]);

  const handleItemChange = (index: number, key: keyof SaleItem, value: string) => {
    const updated = items.map((item, idx) => {
      if (idx !== index) return item;
      if (["quantity", "rate", "gst_rate"].includes(key)) {
        return { ...item, [key]: Number(value || 0) };
      }
      return { ...item, [key]: value };
    });
    setItems(recalculateItems(updated));
  };

  const addRow = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  const removeRow = (index: number) => {
    const next = items.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, sr_no: idx + 1 }));
    setItems(next.length > 0 ? recalculateItems(next) : [emptyItem(1)]);
  };

  const validate = () => {
    if (!invoiceNo.trim()) {
      setValidationError("Invoice number is required.");
      return false;
    }
    if (items.length === 0) {
      setValidationError("At least one item is required.");
      return false;
    }

    for (const item of items) {
      if (Number(item.quantity) <= 0) {
        setValidationError("Quantity must be greater than 0.");
        return false;
      }
      if (Number(item.rate) <= 0) {
        setValidationError("Rate must be greater than 0.");
        return false;
      }
    }

    if (saleType === "b2b" && !GSTIN_REGEX.test(buyerGstin.toUpperCase())) {
      setValidationError("Valid buyer GSTIN is required for B2B.");
      return false;
    }

    setValidationError("");
    return true;
  };

  const saveSale = async () => {
    if (!validate()) return;

    const payload: SaleRecord = {
      invoice_no: invoiceNo.trim(),
      date: invoiceDate,
      buyer_gstin: saleType === "b2b" ? buyerGstin.toUpperCase() : undefined,
      buyer_name: saleType === "b2b" ? buyerName.trim() : undefined,
      place_of_supply: placeOfSupply,
      reverse_charge: saleType === "b2b" ? reverseCharge : undefined,
      type: saleType === "b2c" ? b2cType : undefined,
      items,
      taxable_value: totals.taxable,
      gst_amount: totals.gstAmount,
      total_value: totals.total,
    };

    await window.gstAPI.saveSale({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      saleType,
      sale: payload,
    });

    if (saleType === "b2b") {
      await window.gstAPI.saveCustomer({
        gstin: selectedClient.gstin,
        customer: {
          gstin: buyerGstin.toUpperCase(),
          name: buyerName.trim(),
          state: placeOfSupply,
        },
        touchRecent: true,
      });

      const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
      setCustomerMaster(refreshed);
    }

    onStatus(`Saved ${saleType.toUpperCase()} sale ${invoiceNo}`);
    setInvoiceNo(createInvoiceNumber("INV"));
    setBuyerGstin("");
    setBuyerName("");
    setItems([emptyItem(1)]);
    await loadSales();
  };

  const deleteSale = async (tab: "b2b" | "b2c", sale: SaleRecord) => {
    await window.gstAPI.deleteSale({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      saleType: tab,
      id: sale.id,
      invoiceNo: sale.invoice_no,
    });

    onStatus(`Deleted invoice ${sale.invoice_no}`);
    await loadSales();
  };

  // ── Update sale handler (called from EditSaleModal) ─────────────────────────
  const handleUpdateSale = async (updated: SaleRecord) => {
    if (!editSale) return;
    await window.gstAPI.updateSale({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      saleType: editSale.saleType,
      sale: updated,
    });
    onStatus(`Updated ${editSale.saleType.toUpperCase()} invoice ${updated.invoice_no}`);
    setEditSale(null);
    await loadSales();
  };

  const exportSales = async () => {
    const result = await window.gstAPI.exportSales({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      openFile: openAfterExport,
    });
    if (result.isEmpty) {
      onStatus(`Export created with no rows: ${result.filePath}`);
      return;
    }
    onStatus(`Exported GSTR-1 (${result.b2bCount} B2B rows, ${result.b2cCount} B2C rows): ${result.filePath}`);
  };

  const rows = summaryTab === "b2b" ? salesData.b2b : salesData.b2c;

  const selectCustomer = async (customer: { gstin: string; name: string; state: string }) => {
    setBuyerGstin(customer.gstin);
    setBuyerName(customer.name);
    if (customer.state) setPlaceOfSupply(customer.state);
    setCustomerQuery(customer.gstin);
    setManualCustomerEntry(false);
    setShowCustomerSuggestions(false);

    await window.gstAPI.saveCustomer({
      gstin: selectedClient.gstin,
      customer,
      touchRecent: true,
    });

    const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
    setCustomerMaster(refreshed);
  };

  const handleCustomerFavorite = async (gstin: string, favorite: boolean) => {
    await window.gstAPI.toggleCustomerFavorite({ gstin: selectedClient.gstin, customerGstin: gstin, favorite });
    const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
    setCustomerMaster(refreshed);
  };

  const handleCustomerDelete = async (gstin: string) => {
    await window.gstAPI.deleteCustomer({ gstin: selectedClient.gstin, customerGstin: gstin });
    const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
    setCustomerMaster(refreshed);
  };

  const handleCustomerRename = async (option: { gstin: string; name: string; state: string }) => {
    const nextName = window.prompt("Customer name", option.name) || option.name;
    const nextState = window.prompt("State", option.state || placeOfSupply) || option.state;
    await window.gstAPI.updateCustomer({
      gstin: selectedClient.gstin,
      customer: {
        gstin: option.gstin,
        name: nextName,
        state: nextState,
      },
    });
    const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
    setCustomerMaster(refreshed);
  };

  const handleAddNewCustomer = () => {
    setManualCustomerEntry(true);
    setBuyerGstin("");
    setCustomerQuery("");
    setBuyerName("");
    onStatus("Manual customer entry enabled. Enter GSTIN and Buyer Name, then Save Sale.");
  };

  if (mode === "export") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Export Sales (GSTR-1 Format)</h2>
        <p className="mt-1 text-sm text-slate-500">Exports current month sales to Excel with B2B and B2C sheets.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportSales}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download size={16} />
            Export GSTR-1 Excel
          </button>
          <button
            type="button"
            onClick={loadSales}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Refresh Sales Data
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={openAfterExport} onChange={(e) => setOpenAfterExport(e.target.checked)} />
            Open file after export
          </label>
        </div>
      </section>
    );
  }
  if (mode === "import") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Import Sales (Excel)</h2>
              <p className="mt-1 text-sm text-slate-500">Upload Excel file, preview, validate, and confirm import to B2B sales.</p>
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Simple template generation or download instruction could go here
                alert("Template should have columns: buyerGstin, invoiceNo, invoiceDate, taxableValue, gstRate (optional), igst, cgst, sgst, buyerName (optional), placeOfSupply (optional)");
              }}
              className="text-xs font-medium text-cyan-600 hover:underline"
            >
              View Template Requirements
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 transition shadow-sm">
              <Plus size={16} />
              Upload Excel
              <input type="file" accept=".xlsx" className="hidden" onChange={onPickFile} />
            </label>
            {fileName && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <FileSpreadsheet size={14} className="text-emerald-500" />
                <span className="font-medium">{fileName}</span>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                checked={overwriteImport}
                onChange={(e) => setOverwriteImport(e.target.checked)}
              />
              Overwrite existing
            </label>
            <button
              type="button"
              onClick={confirmImport}
              disabled={previewRows.length === 0}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Confirm Import
            </button>
          </div>

          {previewWarning && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <X size={16} className="text-amber-500" />
              {previewWarning}
            </div>
          )}

          {previewMissingColumns.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <p className="font-semibold mb-1">Missing required columns:</p>
              <div className="flex flex-wrap gap-2">
                {previewMissingColumns.map(col => (
                  <span key={col} className="rounded bg-rose-100 px-2 py-0.5 text-xs">{col}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Rows</p>
              <p className="text-xl font-bold text-slate-700">{previewSummary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Valid</p>
              <p className="text-xl font-bold text-emerald-700">{previewSummary.valid}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">Duplicate</p>
              <p className="text-xl font-bold text-amber-700">{previewSummary.duplicates}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">Error</p>
              <p className="text-xl font-bold text-rose-700">{previewSummary.errors}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={cancelImport}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel / Reset
            </button>
            <p className="text-xs text-slate-400 italic">* Only showing up to 100 rows in preview</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-[45vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 z-10">
                  <tr>
                    <th className="px-4 py-3">Buyer GSTIN</th>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Taxable Value</th>
                    <th className="px-4 py-3">GST Amount</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 italic">
                        No preview data available. Please upload a file.
                      </td>
                    </tr>
                  )}
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.status === "error"
                          ? "bg-rose-50/50"
                          : row.status === "duplicate"
                          ? "bg-amber-50/50"
                          : "hover:bg-slate-50 transition-colors"
                      }
                    >
                      <td className="px-4 py-2 font-mono text-xs text-slate-700">{row.buyer_gstin}</td>
                      <td className="px-4 py-2 text-slate-700 font-medium">{row.invoice_no}</td>
                      <td className="px-4 py-2 text-slate-600">{row.date}</td>
                      <td className="px-4 py-2 text-slate-700">₹{row.taxable_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-slate-700">₹{(row.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-slate-700 font-semibold">₹{row.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2">
                        <span
                          title={row.errorMessage}
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            row.status === "error"
                              ? "bg-rose-100 text-rose-700"
                              : row.status === "duplicate"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {row.status || "valid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (mode === "summary") {
    return (
      <>
        {/* Edit Modal */}
        {editSale && (
          <EditSaleModal
            sale={editSale.sale}
            saleType={editSale.saleType}
            supplierState={supplierState}
            customerMaster={customerMaster}
            clientGstin={selectedClient.gstin}
            onSave={handleUpdateSale}
            onClose={() => setEditSale(null)}
            onRefreshCustomers={async () => {
              const refreshed = await window.gstAPI.loadCustomers({ gstin: selectedClient.gstin });
              setCustomerMaster(refreshed);
            }}
          />
        )}

        <section className="space-y-4">
          {/* Filter bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Sales Summary</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <button type="button" onClick={loadSales} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
                Apply Filters
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSummaryTab("b2b")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${summaryTab === "b2b" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                B2B {salesData.b2b.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{salesData.b2b.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => setSummaryTab("b2c")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${summaryTab === "b2c" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}
              >
                B2C {salesData.b2c.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{salesData.b2c.length}</span>}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[58vh] overflow-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Invoice No</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Party Name / Type</th>
                      <th className="px-3 py-2">Taxable Value</th>
                      <th className="px-3 py-2">GST Amount</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                          No sales found
                        </td>
                      </tr>
                    )}
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loading && rows.map((sale) => (
                      <tr key={sale.id || sale.invoice_no} className="transition hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{sale.invoice_no}</td>
                        <td className="px-3 py-2 text-slate-600">{sale.date}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {summaryTab === "b2b"
                            ? (sale.buyer_name ? `${sale.buyer_name}` : "—")
                            : sale.type || "B2C"}
                          {summaryTab === "b2b" && sale.buyer_gstin && (
                            <span className="ml-1.5 font-mono text-xs text-slate-400">{sale.buyer_gstin}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">₹{sale.taxable_value.toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-700">₹{sale.gst_amount.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">₹{Math.round(sale.total_value).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditSale({ sale, saleType: summaryTab })}
                              title="Edit sale"
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSale(summaryTab, sale)}
                              title="Delete sale"
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-rose-700"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer totals + Export */}
            {rows.length > 0 && (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                {/* Totals row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>
                    <strong className="text-slate-700">{rows.length}</strong> invoice{rows.length !== 1 ? "s" : ""}
                  </span>
                  <span>
                    Taxable:{" "}
                    <strong className="text-slate-700">
                      ₹{rows.reduce((s, r) => s + r.taxable_value, 0).toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    GST:{" "}
                    <strong className="text-slate-700">
                      ₹{rows.reduce((s, r) => s + r.gst_amount, 0).toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    Total:{" "}
                    <strong className="text-emerald-700">
                      ₹{Math.round(rows.reduce((s, r) => s + (r.reverse_charge === "Yes" ? r.taxable_value : r.total_value), 0)).toLocaleString("en-IN")}
                    </strong>
                  </span>
                </div>

                {/* Export B2B CSV — only shown on B2B tab */}
                {summaryTab === "b2b" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const csv = generateB2BCSVContent(salesData.b2b);
                        const clientName = selectedClient.clientName.replace(/[^a-zA-Z0-9]/g, "_");
                        downloadCSV(csv, `B2B_${clientName}_${financialYear}_${month}.csv`);
                        onStatus(`B2B CSV exported: B2B_${clientName}_${financialYear}_${month}.csv`);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <FileDown size={14} />
                      Export B2B CSV (GST Portal Format)
                    </button>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); window.gstAPI?.openExternalUrl("https://sponlinetool.vercel.app/"); }}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <ExternalLink size={14} />
                      Open SPOnline CSV→JSON Tool
                    </a>
                    <p className="text-[11px] text-slate-400">Export CSV → Upload to SPOnline Tool → Get GSTR-1 JSON</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Add Sale</h2>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={saleType === "b2b"} onChange={() => setSaleType("b2b")} />
            B2B
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked={saleType === "b2c"} onChange={() => setSaleType("b2c")} />
            B2C
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Invoice Number</label>
            <div className="mt-1 flex items-center">
              <span className="inline-flex h-[42px] items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-500">
                {selectedClient.invoicePrefix || "INV"}
              </span>
              <input
                className="w-full h-[42px] rounded-r-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:outline-none"
                value={invoiceNo.startsWith(selectedClient.invoicePrefix || "INV") ? invoiceNo.slice((selectedClient.invoicePrefix || "INV").length) : invoiceNo}
                onChange={(e) => {
                  const val = e.target.value;
                  const pref = selectedClient.invoicePrefix || "INV";
                  setInvoiceNo(pref + val);
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Invoice Date</label>
            <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Place of Supply</label>
            <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {saleType === "b2b" && (
            <>
              <PartyLookupDropdown
                label="GSTIN of Buyer"
                gstinValue={buyerGstin}
                query={customerQuery}
                placeholder="Search GSTIN or customer"
                options={filteredCustomers}
                show={showCustomerSuggestions}
                onShowChange={setShowCustomerSuggestions}
                onQueryChange={setCustomerQuery}
                onGstinChange={(next) => {
                  setBuyerGstin(next);
                  setCustomerQuery(next);
                  setManualCustomerEntry(true);
                }}
                onSelect={selectCustomer}
                onAddNew={handleAddNewCustomer}
                addNewLabel="Add New Customer"
                onToggleFavorite={handleCustomerFavorite}
                onDelete={handleCustomerDelete}
                onRename={handleCustomerRename}
              />
              {manualCustomerEntry && (
                <p className="mt-1 text-xs font-medium text-cyan-700">Manual customer mode: enter new GSTIN and buyer name.</p>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600">Buyer Name</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                  value={buyerName}
                  onChange={(e) => {
                    setManualCustomerEntry(true);
                    setBuyerName(e.target.value);
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Reverse Charge</label>
                <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={reverseCharge} onChange={(e) => setReverseCharge(e.target.value as "Yes" | "No")}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </>
          )}

          {saleType === "b2c" && (
            <div>
              <label className="text-xs font-medium text-slate-600">Supply Type</label>
              <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={b2cType} onChange={(e) => setB2cType(e.target.value as "B2C Large" | "B2C Small")}>
                <option>B2C Large</option>
                <option>B2C Small</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Items</h3>
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100">
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Sr</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">HSN/SAC</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Rate</th>
                <th className="px-2 py-2">Taxable</th>
                <th className="px-2 py-2">GST %</th>
                <th className="px-2 py-2">IGST</th>
                <th className="px-2 py-2">CGST</th>
                <th className="px-2 py-2">SGST</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.sr_no} className="border-b border-slate-100">
                  <td className="px-2 py-2">{item.sr_no}</td>
                  <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1.5" value={item.description} onChange={(e) => handleItemChange(idx, "description", e.target.value)} /></td>
                  <td className="px-2 py-2"><input className="w-28 rounded border border-slate-300 px-2 py-1.5" value={item.hsn_sac} onChange={(e) => handleItemChange(idx, "hsn_sac", e.target.value)} /></td>
                  <td className="px-2 py-2"><input type="number" className="w-20 rounded border border-slate-300 px-2 py-1.5" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} /></td>
                  <td className="px-2 py-2"><input type="number" className="w-24 rounded border border-slate-300 px-2 py-1.5" value={item.rate} onChange={(e) => handleItemChange(idx, "rate", e.target.value)} /></td>
                  <td className="px-2 py-2 text-slate-700">{item.taxable_value.toFixed(2)}</td>
                  <td className="px-2 py-2"><input type="number" className="w-20 rounded border border-slate-300 px-2 py-1.5" value={item.gst_rate} onChange={(e) => handleItemChange(idx, "gst_rate", e.target.value)} /></td>
                  <td className="px-2 py-2 text-slate-700">{item.igst.toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-700">{item.cgst.toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-700">{item.sgst.toFixed(2)}</td>
                  <td className="px-2 py-2 font-medium text-slate-700">{item.total_amount.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right"><button type="button" onClick={() => removeRow(idx)} className="rounded bg-rose-600 p-1 text-white hover:bg-rose-700"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Taxable: <span className="font-semibold">{totals.taxable.toFixed(2)}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">GST: <span className="font-semibold">{totals.gstAmount.toFixed(2)}</span></div>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">Total: <span className="font-semibold">₹{Math.round(totals.total).toLocaleString("en-IN")}</span></div>
        </div>

        {validationError && <p className="mt-3 text-sm text-rose-600">{validationError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={saveSale} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <FileSpreadsheet size={16} /> Save Sale
          </button>
          <button type="button" onClick={() => {
            const relevantSales = saleType === "b2b" ? salesData.b2b : salesData.b2c;
            setInvoiceNo(createInvoiceNumber(selectedClient.invoicePrefix || "INV", relevantSales));
          }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Auto Invoice
          </button>
        </div>
      </div>
    </section>
  );
}
