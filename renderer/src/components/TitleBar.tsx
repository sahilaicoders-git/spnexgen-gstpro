import { useEffect, useState } from "react";

/**
 * TitleBar – Custom Electron frameless window title bar.
 *
 * • The entire bar is draggable (`-webkit-app-region: drag`) so the user can
 *   move the window by clicking and dragging anywhere on it.
 * • The three control buttons are explicitly non-draggable so they get clicks.
 * • The component subscribes to the `onStateChange` IPC push so the
 *   maximize ⇄ restore icon flips live when the window is resized to full-screen
 *   or snapped via Windows Snap Assist.
 */

// ── SVG icons (crisp, no external dependency) ─────────────────────────────────

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="4.5" width="10" height="1" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Back window */}
      <rect x="2.5" y="0.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Front window */}
      <rect x="0.5" y="2.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1" fill="var(--titlebar-bg)" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  darkMode: boolean;
  appName?: string;
};

export default function TitleBar({ darkMode, appName = "SPGST Pro" }: Props) {
  const [maximized, setMaximized] = useState(false);

  // Sync initial state and subscribe to main-process push events.
  useEffect(() => {
    if (!window.windowControls) return;

    window.windowControls.isMaximized().then(setMaximized);
    const cleanup = window.windowControls.onStateChange(setMaximized);
    return cleanup;
  }, []);

  const handleMinimize = () => window.windowControls?.minimize();
  const handleMaximize = () => window.windowControls?.maximize();
  const handleClose = () => window.windowControls?.close();

  return (
    <div
      className="titlebar"
      data-dark={darkMode ? "true" : "false"}
      style={
        {
          "--titlebar-bg": darkMode ? "#0d1117" : "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* ── Logo + App name (drag region) ─────────────────────────── */}
      <div className="titlebar-brand">
        {/* App icon – 16px version fits the compact bar perfectly */}
        <img
          src="./icon_32x32.png"
          alt="SPGST"
          className="titlebar-icon"
          draggable={false}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <span className="titlebar-title">{appName}</span>
      </div>

      {/* ── Draggable spacer ─────────────────────────────────────── */}
      <div className="titlebar-drag-region" />

      {/* ── Window control buttons (non-draggable) ───────────────── */}
      <div className="titlebar-controls">
        {/* Minimize */}
        <button
          id="titlebar-minimize"
          type="button"
          className="titlebar-btn titlebar-btn--minimize"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize window"
        >
          <MinimizeIcon />
        </button>

        {/* Maximize / Restore */}
        <button
          id="titlebar-maximize"
          type="button"
          className="titlebar-btn titlebar-btn--maximize"
          onClick={handleMaximize}
          title={maximized ? "Restore" : "Maximize"}
          aria-label={maximized ? "Restore window" : "Maximize window"}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        {/* Close */}
        <button
          id="titlebar-close"
          type="button"
          className="titlebar-btn titlebar-btn--close"
          onClick={handleClose}
          title="Close"
          aria-label="Close window"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
