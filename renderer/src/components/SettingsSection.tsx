import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  Edit3,
  Fingerprint,
  Loader2,
  Moon,
  RefreshCw,
  Sun,
  Tag,
} from "lucide-react";
import type { ClientRecord } from "../types";

type ThemeMode = "light" | "dark" | "system";

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun }> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: RefreshCw },
];

const CLIENT_TYPES = ["Regular", "Composition", "SEZ", "Unregistered"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"] as const;

type Props = {
  selectedClient: ClientRecord | null;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onClientUpdated: (updated: ClientRecord) => Promise<void>;
};

export default function SettingsSection({ selectedClient, theme, onSetTheme, onClientUpdated }: Props) {
  const [clientName, setClientName]     = useState("");
  const [clientType, setClientType]     = useState<string>("Regular");
  const [status, setStatus]             = useState<string>("Active");
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty]               = useState(false);

  // Populate form whenever the selected client changes
  useEffect(() => {
    if (!selectedClient) return;
    setClientName(selectedClient.clientName);
    setClientType(selectedClient.clientType || "Regular");
    setStatus(selectedClient.status || "Active");
    setDirty(false);
    setSaveMsg(null);
  }, [selectedClient]);

  const handleSave = async () => {
    if (!selectedClient || !window.gstAPI) return;
    if (!clientName.trim()) {
      setSaveMsg({ type: "err", text: "Client name cannot be empty." });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    try {
      await window.gstAPI.createClientStructure({
        clientName: clientName.trim(),
        gstin: selectedClient.gstin,
        clientType,
        status,
      });

      const updated: ClientRecord = {
        ...selectedClient,
        clientName: clientName.trim(),
        clientType,
        status,
      };

      await onClientUpdated(updated);
      setSaveMsg({ type: "ok", text: "Client updated successfully." });
      setDirty(false);
    } catch (err) {
      setSaveMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-cyan-400";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

  return (
    <section className="space-y-5">

      {/* ── Theme ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Appearance</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Choose your preferred color theme. Saved on this device.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                id={`theme-btn-${id}`}
                onClick={() => onSetTheme(id)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-slate-800 dark:text-blue-300"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Icon size={15} />
                {label}
                {active && <Check size={14} className="ml-auto text-blue-500 dark:text-blue-300" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Edit Selected Client ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-cyan-600" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Edit Selected Client</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Update the details for the currently active client. GSTIN cannot be changed.
        </p>

        {!selectedClient ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            No client selected. Please select a client from the Client Selection screen first.
          </div>
        ) : (
          <div className="mt-5 space-y-4">

            {/* GSTIN — read-only pill */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
              <Fingerprint size={15} className="shrink-0 text-slate-400" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">GSTIN (read-only)</p>
                <p className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {selectedClient.gstin}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Client Name */}
              <div className="sm:col-span-2">
                <label htmlFor="edit-client-name" className={labelClass}>
                  <Building2 size={12} className="mr-1 inline" />
                  Client Name *
                </label>
                <input
                  id="edit-client-name"
                  className={inputClass}
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); setDirty(true); }}
                  placeholder="Full legal business name"
                />
              </div>

              {/* Client Type */}
              <div>
                <label htmlFor="edit-client-type" className={labelClass}>
                  <Tag size={12} className="mr-1 inline" />
                  Client Type
                </label>
                <select
                  id="edit-client-type"
                  className={inputClass}
                  value={clientType}
                  onChange={(e) => { setClientType(e.target.value); setDirty(true); }}
                >
                  {CLIENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="edit-client-status" className={labelClass}>
                  Status
                </label>
                <select
                  id="edit-client-status"
                  className={inputClass}
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setDirty(true); }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save feedback */}
            {saveMsg && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  saveMsg.type === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
              >
                {saveMsg.text}
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
              <p className="text-xs text-slate-400">
                {dirty ? "You have unsaved changes." : "No pending changes."}
              </p>
              <button
                id="edit-client-save-btn"
                type="button"
                disabled={saving || !dirty}
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
