import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Edit3,
  ExternalLink,
  Fingerprint,
  FolderOpen,
  Loader2,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Tag,
  Download,
  Info,
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

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "upToDate"; version: string }
  | { phase: "available"; current: string; latest: string; releaseUrl: string; releaseNotes: string }
  | { phase: "error"; message: string };

type Props = {
  selectedClient: ClientRecord | null;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onClientUpdated: (updated: ClientRecord) => Promise<void>;
};

export default function SettingsSection({ selectedClient, theme, onSetTheme, onClientUpdated }: Props) {
  // ── Client editor ──────────────────────────────────────────────────────────
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState<string>("Regular");
  const [status, setStatus] = useState<string>("Active");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── Data directory ─────────────────────────────────────────────────────────
  const [dataDir, setDataDir] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [dirChanging, setDirChanging] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [newDirPath, setNewDirPath] = useState("");

  // ── Update checker ─────────────────────────────────────────────────────────
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: "idle" });
  const notesRef = useRef<HTMLDivElement | null>(null);

  // ── Load initial settings ──────────────────────────────────────────────────
  useEffect(() => {
    if (!window.gstAPI) return;
    window.gstAPI.getAppSettings().then((s) => {
      setDataDir(s.dataDirectory);
      setAppVersion(s.appVersion);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    setClientName(selectedClient.clientName);
    setClientType(selectedClient.clientType || "Regular");
    setStatus(selectedClient.status || "Active");
    setDirty(false);
    setSaveMsg(null);
  }, [selectedClient]);

  // ── Handlers ───────────────────────────────────────────────────────────────
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

  const handleChangeDir = async () => {
    if (!window.gstAPI) return;
    setDirChanging(true);
    try {
      const result = await window.gstAPI.changeDataDirectory();
      if (result.changed) {
        setNewDirPath(result.newPath);
        setPendingRestart(true);
      }
    } finally {
      setDirChanging(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (!window.gstAPI) return;
    setUpdateState({ phase: "checking" });
    try {
      const result = await window.gstAPI.checkForUpdates();
      if (!result.ok) {
        setUpdateState({ phase: "error", message: "Could not reach update server. Check your internet connection." });
        return;
      }
      if (result.hasUpdate) {
        setUpdateState({
          phase: "available",
          current: result.currentVersion,
          latest: result.latestVersion,
          releaseUrl: result.releaseUrl,
          releaseNotes: result.releaseNotes,
        });
        setTimeout(() => notesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      } else {
        setUpdateState({ phase: "upToDate", version: result.currentVersion });
      }
    } catch {
      setUpdateState({ phase: "error", message: "Unexpected error while checking for updates." });
    }
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-cyan-400";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const cardClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";

  return (
    <section className="space-y-5">

      {/* ── Data Directory ───────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-amber-500" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Data Directory</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          All client GST data files are stored in this folder. Changing it requires an app restart.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <FolderOpen size={15} className="shrink-0 text-slate-400" />
          <p className="flex-1 truncate font-mono text-sm text-slate-700 dark:text-slate-200">
            {dataDir || <span className="italic text-slate-400">Not set</span>}
          </p>
          <button
            id="change-data-dir-btn"
            type="button"
            disabled={dirChanging}
            onClick={handleChangeDir}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-400 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            {dirChanging ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
            Change Folder
          </button>
        </div>

        {/* Restart banner */}
        {pendingRestart && (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Restart required to apply</p>
              <p className="mt-0.5 font-mono text-xs text-amber-700 dark:text-amber-400 break-all">{newDirPath}</p>
            </div>
            <button
              id="restart-now-btn"
              type="button"
              onClick={() => window.gstAPI?.restartApp()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
            >
              <RotateCcw size={12} />
              Restart Now
            </button>
          </div>
        )}
      </div>

      {/* ── Check for Updates ────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Download size={16} className="text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">App Updates</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Check GitHub for the latest SPGST Pro release.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {appVersion && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-mono font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Info size={11} />
                v{appVersion}
              </span>
            )}
            <button
              id="check-updates-btn"
              type="button"
              disabled={updateState.phase === "checking"}
              onClick={handleCheckUpdate}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updateState.phase === "checking" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {updateState.phase === "checking" ? "Checking…" : "Check for Updates"}
            </button>
          </div>
        </div>

        {/* Result states */}
        {updateState.phase === "upToDate" && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              You're on the latest version (v{updateState.version}) 🎉
            </p>
          </div>
        )}

        {updateState.phase === "error" && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-950/40">
            <AlertCircle size={16} className="shrink-0 text-rose-500" />
            <p className="text-sm text-rose-700 dark:text-rose-300">{updateState.message}</p>
          </div>
        )}

        {updateState.phase === "available" && (
          <div ref={notesRef} className="mt-4 space-y-3">
            {/* Update badge */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-700 dark:bg-indigo-950/40">
              <div>
                <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                  🆕 Update Available — v{updateState.latest}
                </p>
                <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                  Current: v{updateState.current} → Latest: v{updateState.latest}
                </p>
              </div>
              <button
                id="download-update-btn"
                type="button"
                onClick={() => window.gstAPI?.openExternalUrl(updateState.releaseUrl)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                <ExternalLink size={12} />
                Download Installer
              </button>
            </div>

            {/* Release notes */}
            {updateState.releaseNotes && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Release Notes
                </p>
                <pre className="whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {updateState.releaseNotes}
                </pre>
                <button
                  type="button"
                  onClick={() => window.gstAPI?.openExternalUrl(updateState.releaseUrl)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  View full release on GitHub <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Appearance ───────────────────────────────────────────────────── */}
      <div className={cardClass}>
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

      {/* ── Edit Selected Client ─────────────────────────────────────────── */}
      <div className={cardClass}>
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
