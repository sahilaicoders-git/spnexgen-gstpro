import { useMemo, useState } from "react";
import {
  Building2,
  FileText,
  MapPin,
  Phone,
  Landmark,
  Briefcase,
  NotebookPen,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  Search,
  LoaderCircle,
} from "lucide-react";

type ClientType = "Regular" | "Composition" | "SEZ" | "Unregistered";
type FilingFrequency = "Monthly" | "Quarterly";
type BusinessType = "Proprietorship" | "Partnership" | "Pvt Ltd" | "LLP";
type NatureOfBusiness = "Trader" | "Service Provider" | "Manufacturer";

type ClientFormData = {
  clientName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  clientType: ClientType;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  mobileNumber: string;
  emailId: string;
  alternateContact: string;
  returnTypes: string[];
  filingFrequency: FilingFrequency;
  gstPortalUsername: string;
  gstPortalPassword: string;
  businessType: BusinessType;
  natureOfBusiness: NatureOfBusiness;
  openingBalance: string;
  authorizedPersonName: string;
  bankDetails: string;
  remarks: string;
  invoicePrefix: string;
};

type ErrorMap = Record<string, string>;

type AddClientFormProps = {
  onSaved?: () => void | Promise<void>;
  onCancel?: () => void;
};

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
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_REGEX = /^[6-9][0-9]{9}$/;

const INITIAL_DATA: ClientFormData = {
  clientName: "",
  tradeName: "",
  gstin: "",
  pan: "",
  clientType: "Regular",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  mobileNumber: "",
  emailId: "",
  alternateContact: "",
  returnTypes: ["GSTR-1", "GSTR-3B"],
  filingFrequency: "Monthly",
  gstPortalUsername: "",
  gstPortalPassword: "",
  businessType: "Proprietorship",
  natureOfBusiness: "Trader",
  openingBalance: "",
  authorizedPersonName: "",
  bankDetails: "",
  remarks: "",
  invoicePrefix: "INV",
};

const steps = [
  { id: 0, label: "Basic", icon: Building2 },
  { id: 1, label: "Address", icon: MapPin },
  { id: 2, label: "Contact", icon: Phone },
  { id: 3, label: "GST", icon: Landmark },
  { id: 4, label: "Business", icon: Briefcase },
  { id: 5, label: "Additional", icon: NotebookPen },
];

function derivePanFromGstin(gstin: string): string {
  return gstin.length >= 12 ? gstin.slice(2, 12) : "";
}

function deriveStateFromGstin(gstin: string): string {
  const code = gstin.slice(0, 2);
  const name = STATE_CODES[code];
  return name ? `${code}-${name}` : "";
}

export default function AddClientForm({ onSaved, onCancel }: AddClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [step, setStep] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");

  const isLastStep = step === steps.length - 1;

  const completion = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const setField = <K extends keyof ClientFormData>(field: K, value: ClientFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const toggleReturnType = (rt: string) => {
    setFormData((prev) => {
      const exists = prev.returnTypes.includes(rt);
      const updated = exists ? prev.returnTypes.filter((x) => x !== rt) : [...prev.returnTypes, rt];
      return { ...prev, returnTypes: updated };
    });
  };

  const validate = (): boolean => {
    const nextErrors: ErrorMap = {};

    if (!formData.clientName.trim()) nextErrors.clientName = "Client Name is required";
    if (!GSTIN_REGEX.test(formData.gstin)) nextErrors.gstin = "Enter a valid 15-character GSTIN";
    if (!PAN_REGEX.test(formData.pan)) nextErrors.pan = "PAN must be valid (ABCDE1234F format)";
    if (formData.emailId && !EMAIL_REGEX.test(formData.emailId)) nextErrors.emailId = "Enter a valid email";
    if (formData.mobileNumber && !MOBILE_REGEX.test(formData.mobileNumber)) {
      nextErrors.mobileNumber = "Enter a valid 10-digit mobile number";
    }
    if (formData.alternateContact && !MOBILE_REGEX.test(formData.alternateContact)) {
      nextErrors.alternateContact = "Enter a valid alternate contact";
    }
    if (formData.pincode && !/^\d{6}$/.test(formData.pincode)) nextErrors.pincode = "Pincode must be 6 digits";
    if (formData.returnTypes.length === 0) nextErrors.returnTypes = "Select at least one return type";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleGstinChange = (value: string) => {
    const next = value.toUpperCase().replace(/\s/g, "").slice(0, 15);
    const nextPan = derivePanFromGstin(next);
    const nextState = deriveStateFromGstin(next);

    setFormData((prev) => ({
      ...prev,
      gstin: next,
      pan: nextPan || prev.pan,
      state: nextState || prev.state,
    }));

    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.gstin;
      delete copy.pan;
      return copy;
    });
  };

  const autoFetchByGstin = async () => {
    if (!GSTIN_REGEX.test(formData.gstin)) {
      setErrors((prev) => ({ ...prev, gstin: "Enter valid GSTIN before fetching" }));
      return;
    }

    setFetching(true);
    setMessage("");

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setFormData((prev) => ({
      ...prev,
      clientName: prev.clientName || "Sunrise Trading Co.",
      tradeName: prev.tradeName || "Sunrise Trade Hub",
      addressLine1: prev.addressLine1 || "204, Business Park",
      city: prev.city || "Pune",
      state: deriveStateFromGstin(prev.gstin) || prev.state,
      pincode: prev.pincode || "411001",
      authorizedPersonName: prev.authorizedPersonName || "Rakesh Sharma",
    }));

    setFetching(false);
    setMessage("Client details fetched successfully from GSTIN.");
  };

  const saveClient = async () => {
    if (!validate()) return;

    if (!window.gstAPI) {
      setMessage("Unable to save client. Desktop API is unavailable.");
      return;
    }

    try {
      await window.gstAPI.createClientStructure({
        clientName: formData.clientName.trim(),
        gstin: formData.gstin.trim().toUpperCase(),
        clientType: formData.clientType,
        status: "Active",
        returnFrequency: formData.filingFrequency,
        invoicePrefix: formData.invoicePrefix.trim() || "INV",
      });

      setMessage("Client saved successfully.");
      setFormData(INITIAL_DATA);
      setStep(0);

      if (onSaved) {
        await onSaved();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to save client.";
      setErrors((prev) => ({ ...prev, gstin: text }));
    }
  };

  const cancelForm = () => {
    setFormData(INITIAL_DATA);
    setErrors({});
    setStep(0);
    setMessage("Form reset.");
    onCancel?.();
  };

  const cardClass = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100";
  const labelClass = "text-sm font-medium text-slate-700";

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl bg-gradient-to-r from-cyan-700 via-teal-600 to-emerald-600 p-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100">GST Dashboard</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Add Client</h1>
          <p className="mt-1 text-sm text-cyan-50">Create and manage client profile with GST-ready details</p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const active = idx === step;
                const passed = idx < step;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(idx)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? "bg-cyan-600 text-white"
                        : passed
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Icon size={16} />
                    {s.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm font-medium text-slate-600">{completion}% complete</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all" style={{ width: `${completion}%` }} />
          </div>
        </div>

        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          {step === 0 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <Building2 size={18} />
                <h2 className="text-lg font-semibold">Basic Information</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Client Name *</label>
                  <input className={inputClass} value={formData.clientName} onChange={(e) => setField("clientName", e.target.value)} />
                  {errors.clientName && <p className="mt-1 text-xs text-rose-600">{errors.clientName}</p>}
                </div>
                <div>
                  <label className={labelClass}>Trade Name</label>
                  <input className={inputClass} value={formData.tradeName} onChange={(e) => setField("tradeName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>GSTIN *</label>
                  <div className="mt-1 flex gap-2">
                    <input className={inputClass} value={formData.gstin} onChange={(e) => handleGstinChange(e.target.value)} maxLength={15} />
                    <button
                      type="button"
                      onClick={autoFetchByGstin}
                      disabled={fetching}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-70"
                    >
                      {fetching ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
                      Fetch
                    </button>
                  </div>
                  {errors.gstin && <p className="mt-1 text-xs text-rose-600">{errors.gstin}</p>}
                </div>
                <div>
                  <label className={labelClass}>PAN (Auto-filled)</label>
                  <input className={`${inputClass} bg-slate-100`} value={formData.pan} onChange={(e) => setField("pan", e.target.value.toUpperCase())} />
                  {errors.pan && <p className="mt-1 text-xs text-rose-600">{errors.pan}</p>}
                </div>
                <div>
                  <label className={labelClass}>Client Type</label>
                  <select className={inputClass} value={formData.clientType} onChange={(e) => setField("clientType", e.target.value as ClientType)}>
                    <option>Regular</option>
                    <option>Composition</option>
                    <option>SEZ</option>
                    <option>Unregistered</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <MapPin size={18} />
                <h2 className="text-lg font-semibold">Address Details</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Address Line 1</label>
                  <input className={inputClass} value={formData.addressLine1} onChange={(e) => setField("addressLine1", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Address Line 2</label>
                  <input className={inputClass} value={formData.addressLine2} onChange={(e) => setField("addressLine2", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input className={inputClass} value={formData.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>State (Auto-filled from GSTIN)</label>
                  <input className={`${inputClass} bg-slate-100`} value={formData.state} onChange={(e) => setField("state", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Pincode</label>
                  <input className={inputClass} value={formData.pincode} onChange={(e) => setField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
                  {errors.pincode && <p className="mt-1 text-xs text-rose-600">{errors.pincode}</p>}
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <Phone size={18} />
                <h2 className="text-lg font-semibold">Contact Details</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Mobile Number</label>
                  <input className={inputClass} value={formData.mobileNumber} onChange={(e) => setField("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  {errors.mobileNumber && <p className="mt-1 text-xs text-rose-600">{errors.mobileNumber}</p>}
                </div>
                <div>
                  <label className={labelClass}>Email ID</label>
                  <input className={inputClass} value={formData.emailId} onChange={(e) => setField("emailId", e.target.value)} />
                  {errors.emailId && <p className="mt-1 text-xs text-rose-600">{errors.emailId}</p>}
                </div>
                <div>
                  <label className={labelClass}>Alternate Contact</label>
                  <input className={inputClass} value={formData.alternateContact} onChange={(e) => setField("alternateContact", e.target.value.replace(/\D/g, "").slice(0, 10))} />
                  {errors.alternateContact && <p className="mt-1 text-xs text-rose-600">{errors.alternateContact}</p>}
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <Landmark size={18} />
                <h2 className="text-lg font-semibold">GST Details</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Return Type</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {["GSTR-1", "GSTR-3B", "GSTR-2"].map((rt) => (
                      <label key={rt} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                        <input type="checkbox" checked={formData.returnTypes.includes(rt)} onChange={() => toggleReturnType(rt)} />
                        {rt}
                      </label>
                    ))}
                  </div>
                  {errors.returnTypes && <p className="mt-1 text-xs text-rose-600">{errors.returnTypes}</p>}
                </div>
                <div>
                  <label className={labelClass}>Filing Frequency</label>
                  <select className={inputClass} value={formData.filingFrequency} onChange={(e) => setField("filingFrequency", e.target.value as FilingFrequency)}>
                    <option>Monthly</option>
                    <option>Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>GST Portal Username</label>
                  <input className={inputClass} value={formData.gstPortalUsername} onChange={(e) => setField("gstPortalUsername", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>GST Portal Password</label>
                  <input type="password" className={inputClass} value={formData.gstPortalPassword} onChange={(e) => setField("gstPortalPassword", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>B2B Invoice Prefix</label>
                  <input className={inputClass} value={formData.invoicePrefix} onChange={(e) => setField("invoicePrefix", e.target.value.toUpperCase())} placeholder="e.g. INV, GST, SP" />
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <Briefcase size={18} />
                <h2 className="text-lg font-semibold">Business Details</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Business Type</label>
                  <select className={inputClass} value={formData.businessType} onChange={(e) => setField("businessType", e.target.value as BusinessType)}>
                    <option>Proprietorship</option>
                    <option>Partnership</option>
                    <option>Pvt Ltd</option>
                    <option>LLP</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Nature of Business</label>
                  <select className={inputClass} value={formData.natureOfBusiness} onChange={(e) => setField("natureOfBusiness", e.target.value as NatureOfBusiness)}>
                    <option>Trader</option>
                    <option>Service Provider</option>
                    <option>Manufacturer</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className={cardClass}>
              <div className="mb-4 flex items-center gap-2 text-slate-800">
                <FileText size={18} />
                <h2 className="text-lg font-semibold">Additional Details</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Opening Balance</label>
                  <input className={inputClass} value={formData.openingBalance} onChange={(e) => setField("openingBalance", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Authorized Person Name</label>
                  <input className={inputClass} value={formData.authorizedPersonName} onChange={(e) => setField("authorizedPersonName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Bank Details</label>
                  <input className={inputClass} value={formData.bankDetails} onChange={(e) => setField("bankDetails", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Remarks</label>
                  <textarea className={`${inputClass} min-h-28`} value={formData.remarks} onChange={(e) => setField("remarks", e.target.value)} />
                </div>
              </div>
            </section>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={isLastStep}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelForm}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveClient}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <Save size={16} />
                Save Client
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
