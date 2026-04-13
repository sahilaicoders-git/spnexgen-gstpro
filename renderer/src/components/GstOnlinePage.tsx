import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  Save,
  Shield,
  User,
  Wifi,
} from "lucide-react";

const GST_PORTAL_URL = "https://services.gst.gov.in/services/login";
const GST_DASHBOARD_URL = "https://services.gst.gov.in/services/auth/fowelcome";
const GST_HOME_URL = "https://www.gst.gov.in/";

type PageMode = "login" | "dashboard";

const QUICK_LINKS = [
  { label: "GSTR-1 Filing", url: "https://services.gst.gov.in/services/auth/gstr1Return" },
  { label: "GSTR-3B Filing", url: "https://services.gst.gov.in/services/auth/gstr3bReturn" },
  { label: "Track Application", url: "https://services.gst.gov.in/services/searchtp" },
  { label: "E-Way Bill", url: "https://ewaybillgst.gov.in/" },
];

export default function GstOnlinePage({ initialMode }: { initialMode?: PageMode }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load saved credentials on mount
  useEffect(() => {
    if (!window.gstAPI) return;
    window.gstAPI.getGstCredentials().then((creds: { gst_username: string; has_password: boolean }) => {
      setUsername(creds.gst_username || "");
      setHasPassword(creds.has_password);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!window.gstAPI) return;
    setSaving(true);
    try {
      await window.gstAPI.saveGstCredentials({
        gst_username: username,
        gst_password: password || undefined,
      });
      setHasPassword(password.length > 0 || hasPassword);
      setPassword("");           // clear from memory
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const openPortal = (url: string) => {
    window.gstAPI?.openGstPortal({ targetUrl: url });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <section className="space-y-6 max-w-3xl mx-auto">

      {/* ── Hero header card ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-lg"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #0c2340 60%, #0f172a 100%)" }}
      >
        {/* Accent line */}
        <div
          className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
          style={{ background: "linear-gradient(180deg,#3b82f6,#06b6d4,#10b981)" }}
        />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)", boxShadow: "0 4px 14px rgba(59,130,246,0.4)" }}
            >
              <Wifi size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400">Online Services</p>
              <h1 className="text-lg font-bold text-white">GST Portal Access</h1>
            </div>
            <div className="ml-auto">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40"
                style={{ background: "rgba(16,185,129,0.12)" }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                services.gst.gov.in
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            Save your GST portal credentials here. SPGST Pro will auto-fill your username &amp; password on the portal
            login page. You only need to enter the CAPTCHA manually.
          </p>
        </div>
      </div>

      {/* ── Quick launch buttons ──────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Login to GST Portal */}
        <button
          id="btn-open-gst-login"
          type="button"
          onClick={() => openPortal(GST_PORTAL_URL)}
          className="group flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#eff6ff,#dbeafe)", borderColor: "#bfdbfe" }}
        >
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow"
            style={{ background: "linear-gradient(135deg,#3b82f6,#2563eb)" }}
          >
            <LogIn size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-blue-900">Login to GST Portal</p>
            <p className="mt-0.5 text-xs text-blue-600">Opens portal in new window and auto-fills credentials</p>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0 text-blue-400 opacity-60 group-hover:opacity-100" />
        </button>

        {/* Open GST Dashboard */}
        <button
          id="btn-open-gst-dashboard"
          type="button"
          onClick={() => openPortal(GST_DASHBOARD_URL)}
          className="group flex items-center gap-4 rounded-2xl border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", borderColor: "#bbf7d0" }}
        >
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow"
            style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}
          >
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-emerald-900">Open GST Dashboard</p>
            <p className="mt-0.5 text-xs text-emerald-600">Go directly to your GST portal dashboard</p>
          </div>
          <ExternalLink size={14} className="ml-auto shrink-0 text-emerald-400 opacity-60 group-hover:opacity-100" />
        </button>
      </div>

      {/* ── Quick links ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Globe size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quick Links</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.url}
              type="button"
              onClick={() => openPortal(link.url)}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {link.label}
              <ExternalLink size={11} className="shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* ── Credentials form ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-cyan-600" />
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Saved Credentials</h2>
          {hasPassword && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 size={10} /> Saved
            </span>
          )}
        </div>

        {/* Security notice */}
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/40">
          <Shield size={13} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Credentials are stored locally in your app settings file on this device only.
            Your password is <strong>never sent anywhere</strong> — it is only injected at runtime into the GST portal window.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="gst-username" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <User size={11} className="mr-1 inline" />
              GST Username / GSTIN
            </label>
            <input
              id="gst-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your GST portal username"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="gst-password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <KeyRound size={11} className="mr-1 inline" />
              Password {hasPassword && !password && <span className="ml-1 font-normal text-slate-400">(already saved — enter new to change)</span>}
            </label>
            <div className="relative mt-1.5">
              <input
                id="gst-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? "●●●●●●●● (saved)" : "Enter your GST portal password"}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            {saved && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} /> Credentials saved!
              </span>
            )}
            <button
              id="btn-save-gst-credentials"
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : "Save Credentials"}
            </button>
          </div>
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">How Auto-Login Works</h2>
        <ol className="mt-3 space-y-2">
          {[
            "Save your GST username and password using the form above.",
            "Click 'Login to GST Portal' — a new window opens with services.gst.gov.in.",
            "SPGST Pro automatically fills in your username and password on the login page.",
            "Enter the CAPTCHA manually (cannot be automated — GST portal security).",
            "Click Login — you're in!",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(135deg,#3b82f6,#06b6d4)" }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

    </section>
  );
}
