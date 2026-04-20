import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
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
  Info,
  Upload,
  HardDrive,
  Shield,
} from "lucide-react";
import type { ClientRecord } from "../types";

type ThemeMode = "light" | "dark" | "system";
type TabKey = "directory" | "theme" | "updates" | "backup";

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType; desc: string }> = [
  { key: "directory", label: "Directory", icon: FolderOpen, desc: "Data folder & client" },
  { key: "theme", label: "Theme", icon: Sun, desc: "Appearance" },
  { key: "updates", label: "Updates", icon: Download, desc: "Version & releases" },
  { key: "backup", label: "Backup", icon: Archive, desc: "Export & restore data" },
];

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; icon: typeof Sun; desc: string }> = [
  { id: "light", label: "Light", icon: Sun, desc: "Always light interface" },
  { id: "dark", label: "Dark", icon: Moon, desc: "Always dark interface" },
  { id: "system", label: "System", icon: RefreshCw, desc: "Follows OS preference" },
];

const CLIENT_TYPES = ["Regular", "Composition", "SEZ", "Unregistered"] as const;
const STATUS_OPTIONS = ["Active", "Inactive", "Suspended"] as const;

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "upToDate"; version: string }
  | { phase: "available"; current: string; latest: string; releaseUrl: string; releaseNotes: string; devMode?: boolean }
  | { phase: "downloading"; percentage: number }
  | { phase: "downloaded"; version: string; releaseNotes: string }
  | { phase: "error"; message: string };

type Props = {
  selectedClient: ClientRecord | null;
  theme: ThemeMode;
  onSetTheme: (t: ThemeMode) => void;
  onClientUpdated: (updated: ClientRecord) => Promise<void>;
};

// ── Shared label / input styles ────────────────────────────────────────────────
const INPUT =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-cyan-400";
const LABEL =
  "block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";

export default function SettingsSection({ selectedClient, theme, onSetTheme, onClientUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("directory");

  // ── Directory & client ────────────────────────────────────────────────────────
  const [dataDir, setDataDir] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [dirChanging, setDirChanging] = useState(false);
  const [pendingRestart, setPendingRestart] = useState(false);
  const [newDirPath, setNewDirPath] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState<string>("Regular");
  const [status, setStatus] = useState<string>("Active");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // ── Updates ───────────────────────────────────────────────────────────────────
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: "idle" });
  const notesRef = useRef<HTMLDivElement | null>(null);

  // ── Backup ────────────────────────────────────────────────────────────────────
  type BackupState = "idle" | "busy" | "done" | "error";
  const [backupState, setBackupState] = useState<BackupState>("idle");
  const [backupPath, setBackupPath] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [restoreState, setRestoreState] = useState<BackupState>("idle");
  const [restoreMsg, setRestoreMsg] = useState("");

  // ── Load settings ─────────────────────────────────────────────────────────────
  useEffect(() => {
    window.gstAPI?.getAppSettings().then((s) => {
      setDataDir(s.dataDirectory);
      setAppVersion(s.appVersion);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!window.gstAPI?.onUpdaterEvent) return;

    const cleanup = window.gstAPI.onUpdaterEvent((data: any) => {
      switch (data.event) {
        case "checking":
          setUpdateState({ phase: "checking" });
          break;
        case "available":
          setUpdateState({
            phase: "available",
            current: appVersion,
            latest: data.version,
            releaseUrl: "",
            releaseNotes: data.releaseNotes || "",
          });
          break;
        case "not-available":
          setUpdateState({ phase: "upToDate", version: appVersion });
          break;
        case "download-progress":
          setUpdateState({ phase: "downloading", percentage: data.percent });
          break;
        case "downloaded":
          setUpdateState({
            phase: "downloaded",
            version: data.version,
            releaseNotes: data.releaseNotes || "",
          });
          break;
        case "error":
          setUpdateState({ phase: "error", message: data.message || "Update failed." });
          break;
      }
    });

    return cleanup;
  }, [appVersion]);

  useEffect(() => {
    if (!selectedClient) return;
    setClientName(selectedClient.clientName);
    setClientType(selectedClient.clientType || "Regular");
    setStatus(selectedClient.status || "Active");
    setDirty(false);
    setSaveMsg(null);
  }, [selectedClient]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
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

  const handleSaveClient = async () => {
    if (!selectedClient || !window.gstAPI) return;
    if (!clientName.trim()) { setSaveMsg({ type: "err", text: "Client name cannot be empty." }); return; }
    setSaving(true); setSaveMsg(null);
    try {
      await window.gstAPI.createClientStructure({ clientName: clientName.trim(), gstin: selectedClient.gstin, clientType, status });
      await onClientUpdated({ ...selectedClient, clientName: clientName.trim(), clientType, status });
      setSaveMsg({ type: "ok", text: "Client updated successfully." });
      setDirty(false);
    } catch (err) {
      setSaveMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (!window.gstAPI) return;
    setUpdateState({ phase: "checking" });
    try {
      const result = await window.gstAPI.checkForUpdates();
      if (!result.ok) {
        setUpdateState({ phase: "error", message: result.error || "Could not reach update server. Check your internet connection." });
        return;
      }

      // If in devMode, main process returns result directly instead of using events
      if (result.devMode && result.hasUpdate) {
        setUpdateState({
          phase: "available",
          current: result.currentVersion,
          latest: result.latestVersion,
          releaseUrl: result.releaseUrl,
          releaseNotes: result.releaseNotes,
          devMode: true,
        });
        setTimeout(() => notesRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
      } else if (result.devMode && !result.hasUpdate) {
        setUpdateState({ phase: "upToDate", version: result.currentVersion });
      }
      // If triggeredAutoUpdater is true, we wait for 'updater-event' via IPC (handled by useEffect)
    } catch {
      setUpdateState({ phase: "error", message: "Unexpected error while checking for updates." });
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.gstAPI) return;
    try {
      const result = await window.gstAPI.downloadUpdate();
      if (!result.ok) {
        setUpdateState({ phase: "error", message: result.reason || "Failed to start download." });
      }
    } catch {
      setUpdateState({ phase: "error", message: "Error starting download." });
    }
  };

  const handleInstallUpdate = () => {
    if (!window.gstAPI) return;
    window.gstAPI.installUpdate();
  };

  const handleBackup = async () => {
    if (!window.gstAPI) return;
    setBackupState("busy"); setBackupMsg("");
    try {
      const result = await window.gstAPI.backupDataFolder();
      setBackupPath(result.zipPath);
      setBackupState("done");
      setBackupMsg(`Backup saved to: ${result.zipPath}`);
    } catch (err) {
      setBackupState("error");
      setBackupMsg(err instanceof Error ? err.message : "Backup failed.");
    }
  };

  const handleRestore = async () => {
    if (!window.gstAPI) return;
    setRestoreState("busy"); setRestoreMsg("");
    try {
      // Trigger a file picker via native dialog (uses backupData restore flow)
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".zip";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { setRestoreState("idle"); return; }
        const buffer = await file.arrayBuffer();
        const result = await window.gstAPI.restoreData({ zipBuffer: Array.from(new Uint8Array(buffer)) });
        if (result.ok) {
          setRestoreState("done");
          setRestoreMsg(`Data restored successfully. Previous backup saved at:\n${result.previousBackupPath}`);
        } else {
          setRestoreState("error");
          setRestoreMsg("Restore failed. The ZIP may be invalid.");
        }
      };
      input.click();
    } catch (err) {
      setRestoreState("error");
      setRestoreMsg(err instanceof Error ? err.message : "Restore failed.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-0">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your application preferences and client configuration
        </p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-700 dark:bg-slate-800">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────────── */}
      <div className="mt-5 flex-1">

        {/* ────────────── DIRECTORY ────────────── */}
        {activeTab === "directory" && (
          <div className="space-y-5">

            {/* Data folder card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                  <HardDrive size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Data Directory</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Where all client GST data files are stored — changing requires a restart
                  </p>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <FolderOpen size={15} className="shrink-0 text-slate-400" />
                  <p className="min-w-0 flex-1 truncate font-mono text-sm text-slate-700 dark:text-slate-200">
                    {dataDir || <span className="italic text-slate-400">Not configured</span>}
                  </p>
                  <button
                    id="change-data-dir-btn"
                    type="button"
                    disabled={dirChanging}
                    onClick={handleChangeDir}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-400 hover:text-amber-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  >
                    {dirChanging ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
                    {dirChanging ? "Opening…" : "Change Folder"}
                  </button>
                </div>

                {pendingRestart && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Restart required</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-amber-700 dark:text-amber-400">{newDirPath}</p>
                    </div>
                    <button
                      id="restart-now-btn"
                      type="button"
                      onClick={() => window.gstAPI?.restartApp()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                    >
                      <RotateCcw size={12} /> Restart Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Edit client card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                  <Edit3 size={20} className="text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Edit Selected Client</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Update the name, type, and status of the currently active client
                  </p>
                </div>
              </div>
              <div className="px-6 py-5">
                {!selectedClient ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-700 dark:bg-amber-950/40">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      No client selected. Please select a client from the Client Selection screen first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                      <Fingerprint size={15} className="shrink-0 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">GSTIN — read only</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{selectedClient.gstin}</p>
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor="edit-client-name" className={LABEL}>
                          <Building2 size={11} className="mr-1 inline" /> Client Name *
                        </label>
                        <input id="edit-client-name" className={INPUT} value={clientName}
                          onChange={(e) => { setClientName(e.target.value); setDirty(true); }}
                          placeholder="Full legal business name" />
                      </div>
                      <div>
                        <label htmlFor="edit-client-type" className={LABEL}>
                          <Tag size={11} className="mr-1 inline" /> Client Type
                        </label>
                        <select id="edit-client-type" className={INPUT} value={clientType}
                          onChange={(e) => { setClientType(e.target.value); setDirty(true); }}>
                          {CLIENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-client-status" className={LABEL}>Status</label>
                        <select id="edit-client-status" className={INPUT} value={status}
                          onChange={(e) => { setStatus(e.target.value); setDirty(true); }}>
                          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {saveMsg && (
                      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                        saveMsg.type === "ok"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}>
                        {saveMsg.type === "ok" ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
                        {saveMsg.text}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className={`text-xs font-medium ${dirty ? "text-amber-600" : "text-slate-400"}`}>
                        {dirty ? "● Unsaved changes" : "No pending changes"}
                      </p>
                      <button id="edit-client-save-btn" type="button" disabled={saving || !dirty} onClick={handleSaveClient}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-50">
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ────────────── THEME ────────────── */}
        {activeTab === "theme" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/40">
                <Sun size={20} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Appearance</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Choose your preferred color theme — saved on this device
                </p>
              </div>
            </div>
            <div className="px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                {THEME_OPTIONS.map(({ id, label, icon: Icon, desc }) => {
                  const active = theme === id;
                  return (
                    <button key={id} type="button" id={`theme-btn-${id}`} onClick={() => onSetTheme(id)}
                      className={`group relative flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all ${
                        active
                          ? "border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200 dark:border-blue-400 dark:bg-blue-900/20 dark:ring-blue-800"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        active ? "bg-blue-100 dark:bg-blue-900/60" : "bg-white shadow-sm dark:bg-slate-700"
                      }`}>
                        <Icon size={22} className={active ? "text-blue-600 dark:text-blue-300" : "text-slate-500 dark:text-slate-400"} />
                      </div>
                      <div>
                        <p className={`text-base font-bold ${active ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"}`}>
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{desc}</p>
                      </div>
                      {active && (
                        <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow">
                          <Check size={13} className="text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                💡 <strong>System</strong> mode automatically switches between light and dark based on your Windows display settings.
              </p>
            </div>
          </div>
        )}

        {/* ────────────── UPDATES ────────────── */}
        {activeTab === "updates" && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                <Download size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">App Updates</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Check GitHub for the latest SPGST Pro release
                </p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Version + button row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {appVersion && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Info size={11} /> v{appVersion}
                    </span>
                  )}
                  <span className="text-sm text-slate-500">Installed version</span>
                </div>
                <button id="check-updates-btn" type="button" disabled={updateState.phase === "checking"} onClick={handleCheckUpdate}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60">
                  {updateState.phase === "checking" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {updateState.phase === "checking" ? "Checking…" : "Check for Updates"}
                </button>
              </div>

              {/* Up-to-date */}
              {updateState.phase === "upToDate" && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    You're on the latest version (v{updateState.version}) 🎉
                  </p>
                </div>
              )}

              {/* Error */}
              {updateState.phase === "error" && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-950/40">
                  <AlertCircle size={16} className="shrink-0 text-rose-500" />
                  <p className="text-sm text-rose-700 dark:text-rose-300">{updateState.message}</p>
                </div>
              )}

              {/* Update available */}
              {updateState.phase === "available" && (
                <div ref={notesRef} className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 dark:border-indigo-700 dark:from-indigo-950/40 dark:to-blue-950/40">
                    <div>
                      <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                        🆕 Update Available — v{updateState.latest}
                      </p>
                      <p className="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                        Current: v{updateState.current} → Latest: v{updateState.latest}
                      </p>
                    </div>
                    {updateState.devMode ? (
                      <button
                        id="download-manual-btn"
                        type="button"
                        onClick={() => window.gstAPI?.openExternalUrl(updateState.releaseUrl)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                      >
                        <ExternalLink size={13} /> Download Installer
                      </button>
                    ) : (
                      <button
                        id="download-auto-btn"
                        type="button"
                        onClick={handleDownloadUpdate}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                      >
                        <Download size={13} /> Download Now
                      </button>
                    )}
                  </div>
                  {updateState.releaseNotes && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Release Notes</p>
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {updateState.releaseNotes}
                      </pre>
                      {updateState.releaseUrl && (
                        <button
                          type="button"
                          onClick={() => window.gstAPI?.openExternalUrl(updateState.releaseUrl)}
                          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          View full release on GitHub <ChevronRight size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Downloading state */}
              {updateState.phase === "downloading" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-700 dark:bg-indigo-950/40">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Loader2 size={16} className="animate-spin text-indigo-600" />
                        <p className="text-sm font-bold text-indigo-800 dark:text-indigo-200">Downloading update...</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600">{updateState.percentage}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${updateState.percentage}%` }}
                      ></div>
                    </div>
                    <p className="mt-3 text-xs text-indigo-500">
                      SPGST Pro is fetching the latest version. You can keep working while the update downloads.
                    </p>
                  </div>
                </div>
              )}

              {/* Downloaded state */}
              {updateState.phase === "downloaded" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-700 dark:bg-emerald-950/40">
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                        ✅ Update Ready — v{updateState.version}
                      </p>
                      <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                        The update has been downloaded and is ready to install
                      </p>
                    </div>
                    <button
                      id="install-now-btn"
                      type="button"
                      onClick={handleInstallUpdate}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-500"
                    >
                      <RefreshCw size={14} /> Install & Restart Now
                    </button>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <Shield size={15} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Don't worry:</strong> Your GST data and folder settings are stored separately and will
                      remain safe after the update.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ────────────── BACKUP ────────────── */}
        {activeTab === "backup" && (
          <div className="space-y-5">

            {/* Create Backup */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <Archive size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Create Backup</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Export all client data as a ZIP archive to a secure location
                  </p>
                </div>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This will create a complete ZIP backup of your entire data folder including all clients, financial years, and months.
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <button type="button" onClick={handleBackup} disabled={backupState === "busy"}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60">
                    {backupState === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                    {backupState === "busy" ? "Creating Backup…" : "Create Backup Now"}
                  </button>
                </div>

                {backupState === "done" && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Backup created successfully!</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-emerald-700 dark:text-emerald-400">{backupPath}</p>
                    </div>
                  </div>
                )}

                {backupState === "error" && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-950/40">
                    <AlertCircle size={16} className="shrink-0 text-rose-500" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{backupMsg}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Restore Backup */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/40">
                  <Upload size={20} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Restore Backup</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Replace current data with a previously exported ZIP backup
                  </p>
                </div>
              </div>
              <div className="px-6 py-5">
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800 dark:bg-rose-950/30">
                  <Shield size={15} className="mt-0.5 shrink-0 text-rose-500" />
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    <strong>Warning:</strong> Restoring will overwrite all existing data. A safety backup of your current data will be created automatically before restoring.
                  </p>
                </div>

                <button type="button" onClick={handleRestore} disabled={restoreState === "busy"}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60">
                  {restoreState === "busy" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {restoreState === "busy" ? "Restoring…" : "Select Backup ZIP to Restore"}
                </button>

                {restoreState === "done" && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/40">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Data restored successfully!</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-all font-mono text-xs text-emerald-700 dark:text-emerald-400">{restoreMsg}</p>
                    </div>
                  </div>
                )}

                {restoreState === "error" && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-700 dark:bg-rose-950/40">
                    <AlertCircle size={16} className="shrink-0 text-rose-500" />
                    <p className="text-sm text-rose-700 dark:text-rose-300">{restoreMsg}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
