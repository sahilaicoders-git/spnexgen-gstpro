import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import type { ClientRecord, MasterPartyResponse, SaleItem, SaleRecord } from "../types";
import PartyLookupDropdown from "./PartyLookupDropdown";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  mode: "add" | "summary" | "export";
  onStatus: (text: string) => void;
};

const STATES = [
  "Jammu & Kashmir",
  "Himachal Pradesh",
  "Punjab",
  "Chandigarh",
  "Uttarakhand",
  "Haryana",
  "Delhi",
  "Rajasthan",
  "Uttar Pradesh",
  "Bihar",
  "Sikkim",
  "Arunachal Pradesh",
  "Nagaland",
  "Manipur",
  "Mizoram",
  "Tripura",
  "Meghalaya",
  "Assam",
  "West Bengal",
  "Jharkhand",
  "Odisha",
  "Chhattisgarh",
  "Madhya Pradesh",
  "Gujarat",
  "Maharashtra",
  "Karnataka",
  "Goa",
  "Kerala",
  "Tamil Nadu",
  "Puducherry",
  "Telangana",
  "Andhra Pradesh",
  "Ladakh",
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

function createInvoiceNumber(prefix: string) {
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${random}`;
}

export default function GstSalesModule({ selectedClient, financialYear, month, mode, onStatus }: Props) {
  const [saleType, setSaleType] = useState<"b2b" | "b2c">("b2b");
  const [invoiceNo, setInvoiceNo] = useState(createInvoiceNumber("INV"));
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
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

  const supplierState = STATE_CODES[selectedClient.gstin.slice(0, 2)] || "Maharashtra";
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
    if (!GSTIN_REGEX.test(buyerGstin)) return;
    if (buyerName.trim()) return;

    const existing = customerMaster.entries.find((c) => c.gstin.toUpperCase() === buyerGstin.toUpperCase());
    if (existing) {
      setBuyerName(existing.name);
      if (existing.state) setPlaceOfSupply(existing.state);
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
      total: Number((taxable + gstAmount).toFixed(2)),
    };
  }, [items]);

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

  if (mode === "summary") {
    return (
      <section className="space-y-4">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setSummaryTab("b2b")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${summaryTab === "b2b" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              B2B
            </button>
            <button
              type="button"
              onClick={() => setSummaryTab("b2c")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${summaryTab === "b2c" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              B2C
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
                    <th className="px-3 py-2 text-right">Action</th>
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
                  {rows.map((sale) => (
                    <tr key={sale.id || sale.invoice_no}>
                      <td className="px-3 py-2 font-medium text-slate-700">{sale.invoice_no}</td>
                      <td className="px-3 py-2 text-slate-600">{sale.date}</td>
                      <td className="px-3 py-2 text-slate-600">{summaryTab === "b2b" ? sale.buyer_name || "-" : sale.type || "B2C"}</td>
                      <td className="px-3 py-2 text-slate-700">{sale.taxable_value.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{sale.gst_amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{sale.total_value.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" className="mr-2 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">View</button>
                        <button
                          type="button"
                          onClick={() => deleteSale(summaryTab, sale)}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700"
                        >
                          Delete
                        </button>
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
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
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
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">Total: <span className="font-semibold">{totals.total.toFixed(2)}</span></div>
        </div>

        {validationError && <p className="mt-3 text-sm text-rose-600">{validationError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={saveSale} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <FileSpreadsheet size={16} /> Save Sale
          </button>
          <button type="button" onClick={() => setInvoiceNo(createInvoiceNumber("INV"))} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Auto Invoice
          </button>
        </div>
      </div>
    </section>
  );
}
