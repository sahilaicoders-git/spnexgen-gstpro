import { useEffect, useMemo, useState } from "react";
import { FileUp, Plus, Trash2 } from "lucide-react";
import type { ClientRecord, MasterPartyResponse, PurchaseItem, PurchaseRecord } from "../types";
import PartyLookupDropdown from "./PartyLookupDropdown";

type Props = {
  selectedClient: ClientRecord;
  financialYear: string;
  month: string;
  mode: "import" | "add" | "summary";
  onStatus: (text: string) => void;
};

const STATES = ["Maharashtra", "Gujarat", "Karnataka", "Delhi", "Tamil Nadu", "Telangana", "Uttar Pradesh"];
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODES: Record<string, string> = {
  "27": "Maharashtra",
  "24": "Gujarat",
  "29": "Karnataka",
  "07": "Delhi",
  "33": "Tamil Nadu",
  "36": "Telangana",
  "09": "Uttar Pradesh",
};

function emptyItem(): PurchaseItem {
  return {
    description: "",
    hsn_sac: "",
    quantity: 1,
    rate: 0,
    taxable_value: 0,
    gst_rate: 18,
    igst: 0,
    cgst: 0,
    sgst: 0,
    total: 0,
  };
}

export default function PurchaseModule({ selectedClient, financialYear, month, mode, onStatus }: Props) {
  const [invoiceNo, setInvoiceNo] = useState(`PUR-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierGstin, setSupplierGstin] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("Maharashtra");
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem()]);
  const [supplierMaster, setSupplierMaster] = useState<MasterPartyResponse>({ map: {}, entries: [], favorites: [], recent: [] });
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [manualSupplierEntry, setManualSupplierEntry] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<PurchaseRecord[]>([]);
  const [previewMissingColumns, setPreviewMissingColumns] = useState<string[]>([]);
  const [previewSummary, setPreviewSummary] = useState({ total: 0, valid: 0, duplicates: 0, errors: 0 });
  const [previewWarning, setPreviewWarning] = useState("");
  const [overwriteImport, setOverwriteImport] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState("");

  const [summaryRows, setSummaryRows] = useState<PurchaseRecord[]>([]);
  const [summaryQuery, setSummaryQuery] = useState("");
  const [summaryFromDate, setSummaryFromDate] = useState("");
  const [summaryToDate, setSummaryToDate] = useState("");

  const supplierState = STATE_CODES[selectedClient.gstin.slice(0, 2)] || "Maharashtra";
  const isInterstate = placeOfSupply !== supplierState;

  useEffect(() => {
    let cancelled = false;
    window.gstAPI
      .loadSuppliers({ gstin: selectedClient.gstin })
      .then((data) => {
        if (cancelled) return;
        setSupplierMaster(data);
      })
      .catch(() => {
        if (cancelled) return;
        setSupplierMaster({ map: {}, entries: [], favorites: [], recent: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClient.gstin]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return supplierMaster.entries;
    return supplierMaster.entries.filter((row) => {
      return row.gstin.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
    });
  }, [supplierMaster.entries, supplierQuery]);

  const recalculate = (list: PurchaseItem[]) =>
    list.map((item) => {
      const qty = Number(item.quantity || 0);
      const rate = Number(item.rate || 0);
      const taxable = Number((qty * rate).toFixed(2));
      const gstRate = Number(item.gst_rate || 0);
      const totalTax = Number(((taxable * gstRate) / 100).toFixed(2));
      const igst = isInterstate ? totalTax : 0;
      const cgst = isInterstate ? 0 : Number((totalTax / 2).toFixed(2));
      const sgst = isInterstate ? 0 : Number((totalTax / 2).toFixed(2));
      return {
        ...item,
        taxable_value: taxable,
        igst,
        cgst,
        sgst,
        total: Number((taxable + igst + cgst + sgst).toFixed(2)),
      };
    });

  useEffect(() => {
    setItems((prev) => recalculate(prev));
  }, [placeOfSupply]);

  const totals = useMemo(() => {
    const taxable = items.reduce((sum, it) => sum + Number(it.taxable_value || 0), 0);
    const gst = items.reduce((sum, it) => sum + Number(it.igst || 0) + Number(it.cgst || 0) + Number(it.sgst || 0), 0);
    return {
      taxable: Number(taxable.toFixed(2)),
      gst: Number(gst.toFixed(2)),
      total: Number((taxable + gst).toFixed(2)),
    };
  }, [items]);

  const loadSummary = async () => {
    const rows = await window.gstAPI.loadPurchase({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      query: summaryQuery,
      fromDate: summaryFromDate,
      toDate: summaryToDate,
    });
    setSummaryRows(rows);
  };

  useEffect(() => {
    if (mode === "summary") {
      loadSummary();
    }
  }, [mode, selectedClient.gstin, financialYear, month]);

  const selectSupplier = async (supplier: { gstin: string; name: string; state: string }) => {
    setSupplierGstin(supplier.gstin);
    setSupplierName(supplier.name);
    if (supplier.state) setPlaceOfSupply(supplier.state);
    setSupplierQuery(supplier.gstin);
    setManualSupplierEntry(false);
    setShowSupplierDropdown(false);

    await window.gstAPI.saveSupplier({
      gstin: selectedClient.gstin,
      supplier,
      touchRecent: true,
    });
    const refreshed = await window.gstAPI.loadSuppliers({ gstin: selectedClient.gstin });
    setSupplierMaster(refreshed);
  };

  const handleSupplierFavorite = async (gstin: string, favorite: boolean) => {
    await window.gstAPI.toggleSupplierFavorite({ gstin: selectedClient.gstin, supplierGstin: gstin, favorite });
    const refreshed = await window.gstAPI.loadSuppliers({ gstin: selectedClient.gstin });
    setSupplierMaster(refreshed);
  };

  const handleSupplierDelete = async (gstin: string) => {
    await window.gstAPI.deleteSupplier({ gstin: selectedClient.gstin, supplierGstin: gstin });
    const refreshed = await window.gstAPI.loadSuppliers({ gstin: selectedClient.gstin });
    setSupplierMaster(refreshed);
  };

  const handleSupplierRename = async (option: { gstin: string; name: string; state: string }) => {
    const nextName = window.prompt("Supplier name", option.name) || option.name;
    const nextState = window.prompt("State", option.state || placeOfSupply) || option.state;
    await window.gstAPI.updateSupplier({
      gstin: selectedClient.gstin,
      supplier: {
        gstin: option.gstin,
        name: nextName,
        state: nextState,
      },
    });
    const refreshed = await window.gstAPI.loadSuppliers({ gstin: selectedClient.gstin });
    setSupplierMaster(refreshed);
  };

  const handleItemChange = (index: number, key: keyof PurchaseItem, value: string) => {
    const next = items.map((item, idx) => {
      if (idx !== index) return item;
      if (["quantity", "rate", "gst_rate"].includes(key)) {
        return { ...item, [key]: Number(value || 0) };
      }
      return { ...item, [key]: value };
    });
    setItems(recalculate(next));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idxToRemove: number) => {
    const next = items.filter((_, idx) => idx !== idxToRemove);
    setItems(next.length ? recalculate(next) : [emptyItem()]);
  };

  const validateManual = () => {
    if (!GSTIN_REGEX.test(supplierGstin.toUpperCase())) {
      setValidationError("Valid supplier GSTIN is required.");
      return false;
    }
    if (!invoiceNo.trim()) {
      setValidationError("Invoice number is required.");
      return false;
    }
    if (items.length === 0) {
      setValidationError("At least one item is required.");
      return false;
    }
    for (const row of items) {
      if (Number(row.quantity) <= 0 || Number(row.rate) <= 0) {
        setValidationError("Quantity and rate must be greater than 0.");
        return false;
      }
    }
    setValidationError("");
    return true;
  };

  const saveManualPurchase = async () => {
    if (!validateManual()) return;

    const record: PurchaseRecord = {
      type: "B2B",
      supplier_gstin: supplierGstin.toUpperCase(),
      supplier_name: supplierName.trim() || "Supplier",
      invoice_no: invoiceNo.trim(),
      date: invoiceDate,
      place_of_supply: placeOfSupply,
      taxable_value: totals.taxable,
      igst: items.reduce((sum, row) => sum + Number(row.igst || 0), 0),
      cgst: items.reduce((sum, row) => sum + Number(row.cgst || 0), 0),
      sgst: items.reduce((sum, row) => sum + Number(row.sgst || 0), 0),
      total: totals.total,
      source: "manual",
      items,
    };

    await window.gstAPI.savePurchase({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      purchase: record,
    });

    await window.gstAPI.saveSupplier({
      gstin: selectedClient.gstin,
      supplier: {
        gstin: supplierGstin.toUpperCase(),
        name: supplierName.trim() || "Supplier",
        state: placeOfSupply,
      },
      touchRecent: true,
    });

    const refreshed = await window.gstAPI.loadSuppliers({ gstin: selectedClient.gstin });
    setSupplierMaster(refreshed);

    onStatus(`Purchase saved: ${record.invoice_no}`);
    setInvoiceNo(`PUR-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`);
    setSupplierGstin("");
    setSupplierName("");
    setItems([emptyItem()]);
  };

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
      onStatus("File path not available. Please use desktop Electron file picker.");
      return;
    }
    setSelectedFilePath(pathFromElectronFile);

    const previewResult = await window.gstAPI.previewPurchaseImport({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      filePath: pathFromElectronFile,
    });

    setPreviewMissingColumns(previewResult.requiredMissing || []);
    setPreviewRows(previewResult.rows || []);
    setPreviewSummary(previewResult.summary || { total: 0, valid: 0, duplicates: 0, errors: 0 });
    setPreviewWarning(previewResult.warning || "");
  };

  const confirmImport = async () => {
    if (!selectedFilePath || previewRows.length === 0) {
      onStatus("Please select file first.");
      return;
    }

    const result = await window.gstAPI.importPurchaseData({
      gstin: selectedClient.gstin,
      financialYear,
      month,
      previewData: previewRows,
      overwrite: overwriteImport,
    });

    onStatus(`${result.imported || 0} records imported successfully`);
  };

  const cancelImport = () => {
    setFileName("");
    setSelectedFilePath("");
    setPreviewRows([]);
    setPreviewMissingColumns([]);
    setPreviewWarning("");
    setPreviewSummary({ total: 0, valid: 0, duplicates: 0, errors: 0 });
  };

  const deleteRow = async (id?: string) => {
    if (!id) return;
    await window.gstAPI.deletePurchase({ gstin: selectedClient.gstin, financialYear, month, id });
    onStatus("Purchase deleted");
    await loadSummary();
  };

  if (mode === "import") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Import Purchases (Excel)</h2>
          <p className="mt-1 text-sm text-slate-500">Upload GST portal Excel file, preview, validate, and confirm import.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">
              <FileUp size={16} />
              Upload File
              <input type="file" accept=".xlsx" className="hidden" onChange={onPickFile} />
            </label>
            {fileName && <span className="text-sm text-slate-600">{fileName}</span>}
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={overwriteImport} onChange={(e) => setOverwriteImport(e.target.checked)} />
              Re-import with overwrite
            </label>
            <button type="button" onClick={confirmImport} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              Confirm Import
            </button>
          </div>

          {previewWarning && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {previewWarning}
            </div>
          )}

          {previewMissingColumns.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Missing required columns: {previewMissingColumns.join(", ")}
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">Total: <span className="font-semibold">{previewSummary.total}</span></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Valid: <span className="font-semibold">{previewSummary.valid}</span></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">Duplicate: <span className="font-semibold">{previewSummary.duplicates}</span></div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Error: <span className="font-semibold">{previewSummary.errors}</span></div>
          </div>

          <div className="mt-3">
            <button type="button" onClick={cancelImport} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Cancel
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[50vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">GSTIN of Supplier</th>
                    <th className="px-3 py-2">Invoice Number</th>
                    <th className="px-3 py-2">Invoice Date</th>
                    <th className="px-3 py-2">Invoice Value</th>
                    <th className="px-3 py-2">Taxable Value</th>
                    <th className="px-3 py-2">IGST</th>
                    <th className="px-3 py-2">CGST</th>
                    <th className="px-3 py-2">SGST</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-slate-500">No preview rows yet</td>
                    </tr>
                  )}
                  {previewRows.map((row) => (
                    <tr
                      key={row.id || `${row.supplier_gstin}-${row.invoice_no}`}
                      className={
                        row.status === "error"
                          ? "bg-rose-50"
                          : row.status === "duplicate"
                          ? "bg-amber-50"
                          : "bg-emerald-50/40"
                      }
                    >
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.supplier_gstin}</td>
                      <td className="px-3 py-2 text-slate-700">{row.invoice_no}</td>
                      <td className="px-3 py-2 text-slate-600">{row.date}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.taxable_value || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.igst || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.cgst || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.sgst || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
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
      <section className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Purchase Summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Search GSTIN / Supplier / Invoice" value={summaryQuery} onChange={(e) => setSummaryQuery(e.target.value)} />
            <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={summaryFromDate} onChange={(e) => setSummaryFromDate(e.target.value)} />
            <input type="date" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" value={summaryToDate} onChange={(e) => setSummaryToDate(e.target.value)} />
            <button type="button" onClick={loadSummary} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">Apply Filters</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[58vh] overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Invoice No</th>
                    <th className="px-3 py-2">Supplier Name</th>
                    <th className="px-3 py-2">Taxable Value</th>
                    <th className="px-3 py-2">GST Amount</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {summaryRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">No purchase rows found</td>
                    </tr>
                  )}
                  {summaryRows.map((row) => (
                    <tr key={row.id || `${row.supplier_gstin}-${row.invoice_no}`}>
                      <td className="px-3 py-2 text-slate-700">{row.date}</td>
                      <td className="px-3 py-2 text-slate-700">{row.invoice_no}</td>
                      <td className="px-3 py-2 text-slate-600">{row.supplier_name || row.supplier_gstin}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.taxable_value || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{(Number(row.igst || 0) + Number(row.cgst || 0) + Number(row.sgst || 0)).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{Number(row.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-600">{row.source}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => deleteRow(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-700">
                          <Trash2 size={12} />
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
        <h2 className="text-lg font-semibold text-slate-800">Add Purchase (Manual)</h2>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <PartyLookupDropdown
            label="Supplier GSTIN"
            gstinValue={supplierGstin}
            query={supplierQuery}
            placeholder="Search GSTIN or supplier"
            options={filteredSuppliers}
            show={showSupplierDropdown}
            onShowChange={setShowSupplierDropdown}
            onQueryChange={setSupplierQuery}
            onGstinChange={(next) => {
              setSupplierGstin(next);
              setSupplierQuery(next);
              setManualSupplierEntry(true);
            }}
            onSelect={selectSupplier}
            onAddNew={() => {
              setManualSupplierEntry(true);
              setSupplierGstin("");
              setSupplierQuery("");
              setSupplierName("");
            }}
            addNewLabel="Add New Supplier"
            onToggleFavorite={handleSupplierFavorite}
            onDelete={handleSupplierDelete}
            onRename={handleSupplierRename}
          />
          <div>
            <label className="text-xs font-medium text-slate-600">Supplier Name</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              value={supplierName}
              onChange={(e) => {
                setManualSupplierEntry(true);
                setSupplierName(e.target.value);
              }}
            />
          </div>
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
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Items</h3>
          <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100">
            <Plus size={14} /> Add Item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2">HSN/SAC</th>
                <th className="px-2 py-2">Quantity</th>
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
                <tr key={`item-${idx}`} className="border-b border-slate-100">
                  <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1.5" value={item.description} onChange={(e) => handleItemChange(idx, "description", e.target.value)} /></td>
                  <td className="px-2 py-2"><input className="w-24 rounded border border-slate-300 px-2 py-1.5" value={item.hsn_sac} onChange={(e) => handleItemChange(idx, "hsn_sac", e.target.value)} /></td>
                  <td className="px-2 py-2"><input type="number" className="w-20 rounded border border-slate-300 px-2 py-1.5" value={item.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} /></td>
                  <td className="px-2 py-2"><input type="number" className="w-24 rounded border border-slate-300 px-2 py-1.5" value={item.rate} onChange={(e) => handleItemChange(idx, "rate", e.target.value)} /></td>
                  <td className="px-2 py-2">{item.taxable_value.toFixed(2)}</td>
                  <td className="px-2 py-2"><input type="number" className="w-20 rounded border border-slate-300 px-2 py-1.5" value={item.gst_rate} onChange={(e) => handleItemChange(idx, "gst_rate", e.target.value)} /></td>
                  <td className="px-2 py-2">{item.igst.toFixed(2)}</td>
                  <td className="px-2 py-2">{item.cgst.toFixed(2)}</td>
                  <td className="px-2 py-2">{item.sgst.toFixed(2)}</td>
                  <td className="px-2 py-2 font-medium">{item.total.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right"><button type="button" onClick={() => removeItem(idx)} className="rounded bg-rose-600 p-1 text-white hover:bg-rose-700"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">Taxable: <span className="font-semibold">{totals.taxable.toFixed(2)}</span></div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">GST: <span className="font-semibold">{totals.gst.toFixed(2)}</span></div>
          <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">Total: <span className="font-semibold">{totals.total.toFixed(2)}</span></div>
        </div>

        {validationError && <p className="mt-3 text-sm text-rose-600">{validationError}</p>}

        <div className="mt-4">
          <button type="button" onClick={saveManualPurchase} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Save Purchase
          </button>
        </div>
      </div>
    </section>
  );
}
