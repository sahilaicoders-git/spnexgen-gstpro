; =============================================================================
;   SPGST Pro  —  build/installer.nsh
;   Custom NSIS additions for electron-builder
;
;   What this file does:
;     1.  Adds a "Choose Data Folder" page as the FIRST installer screen.
;     2.  After files are copied (!macro customInstall), writes app-settings.json
;         to %APPDATA%\SPGST Pro\ using a tiny PowerShell script so the path
;         is properly JSON-encoded with escaped backslashes.
;     3.  Leaves user data intact on uninstall.
;
;   electron-builder hook macros used:
;     !macro customHeader   — runs before the standard MUI pages are registered
;     !macro customInstall  — runs after file copy; writes the settings JSON
;     !macro customUnInstall— runs during uninstall (no-op — data kept)
; =============================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ── Package-level variable declarations ───────────────────────────────────────
Var SPGST_DataDir      ; full path chosen by the user
Var SPGST_TextCtrl     ; HWND of the editable text box (persists across callbacks)

; =============================================================================
;   Page functions
; =============================================================================

; ── Show: builds the custom nsDialogs page ────────────────────────────────────
Function SPGST_DataDirShow

  ; Set default path
  StrCpy $SPGST_DataDir "$DOCUMENTS\SPGST_Data"

  ; Create the dialog canvas
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ; ── Heading label ─────────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 0 100% 12u "Choose Data Storage Folder"
  Pop $0

  ; ── Description paragraph ─────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 16u 100% 36u \
      "SPGST Pro stores all GST client records, invoices and returns in a dedicated folder.$\r$\nChoose a location below — it will be created automatically if it does not exist.$\r$\nTip: use Documents or a shared drive, not Program Files."
  Pop $0

  ; ── Path text box ─────────────────────────────────────────────────────────
  ${NSD_CreateText} 0 60u 79% 14u "$SPGST_DataDir"
  Pop $SPGST_TextCtrl

  ; ── Browse button ─────────────────────────────────────────────────────────
  ${NSD_CreateButton} 81% 59u 19% 16u "Browse..."
  Pop $0
  ${NSD_OnClick} $0 SPGST_OnBrowse

  ; ── Hint line ─────────────────────────────────────────────────────────────
  ${NSD_CreateLabel} 0 82u 100% 12u \
      "Default: $DOCUMENTS\SPGST_Data"
  Pop $0

  nsDialogs::Show

FunctionEnd

; ── Browse button callback ────────────────────────────────────────────────────
Function SPGST_OnBrowse

  ${NSD_GetText} $SPGST_TextCtrl $SPGST_DataDir
  nsDialogs::SelectFolderDialog "Select SPGST Pro Data Storage Folder" "$SPGST_DataDir"
  Pop $0
  ${If} $0 != "error"
    StrCpy $SPGST_DataDir $0
    ${NSD_SetText} $SPGST_TextCtrl $SPGST_DataDir
  ${EndIf}

FunctionEnd

; ── Leave: read back whatever the user typed ─────────────────────────────────
Function SPGST_DataDirLeave

  ${NSD_GetText} $SPGST_TextCtrl $SPGST_DataDir
  ${If} $SPGST_DataDir == ""
    StrCpy $SPGST_DataDir "$DOCUMENTS\SPGST_Data"
  ${EndIf}

FunctionEnd

; =============================================================================
;   electron-builder hook: customHeader
;   Registers our custom page BEFORE the standard MUI pages.
;   Installer page order:
;     [0] Data Folder  (ours)
;     [1] Welcome
;     [2] License
;     [3] Install Directory
;     [4] Installing
;     [5] Finish
; =============================================================================
!macro customHeader
  Page custom SPGST_DataDirShow SPGST_DataDirLeave
!macroend

; =============================================================================
;   electron-builder hook: customInstall
;   Runs after all application files have been written to disk.
;   Uses PowerShell to write app-settings.json with properly escaped JSON.
;
;   NSIS string escaping rules used below:
;     $$      ->  literal $  (used for PowerShell variables)
;     $\"     ->  literal "
;     $VAR    ->  value of NSIS variable at runtime  (e.g. the path string)
;     $\n     ->  newline written to file
; =============================================================================
!macro customInstall

  DetailPrint "Writing SPGST Pro data directory configuration..."

  ; Build a tiny PowerShell script at %TEMP%
  FileOpen $0 "$TEMP\spgst_configure.ps1" w

  FileWrite $0 "$$ErrorActionPreference = $\"Stop$\""
  FileWrite $0 "$\n"
  FileWrite $0 "$$dataDir = $\"$SPGST_DataDir$\""
  FileWrite $0 "$\n"
  FileWrite $0 "$$cfgDir  = Join-Path $$env:APPDATA $\"SPGST Pro$\""
  FileWrite $0 "$\n"
  FileWrite $0 "New-Item -Force -ItemType Directory -Path $$dataDir | Out-Null"
  FileWrite $0 "$\n"
  FileWrite $0 "New-Item -Force -ItemType Directory -Path $$cfgDir  | Out-Null"
  FileWrite $0 "$\n"
  FileWrite $0 "$$json = [ordered]@{ dataDirectory = $$dataDir } | ConvertTo-Json"
  FileWrite $0 "$\n"
  FileWrite $0 "$$utf8NoBom = New-Object System.Text.UTF8Encoding($$false)"
  FileWrite $0 "$\n"
  FileWrite $0 "[System.IO.File]::WriteAllText((Join-Path $$cfgDir $\"app-settings.json$\"), $$json, $$utf8NoBom)"

  FileClose $0

  ; Execute the script silently
  nsExec::ExecToLog '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -NoProfile -NonInteractive -WindowStyle Hidden -File "$TEMP\spgst_configure.ps1"'
  Pop $R0

  Delete "$TEMP\spgst_configure.ps1"

  ${If} $R0 != 0
    MessageBox MB_ICONEXCLAMATION "Warning: Could not write data directory settings.$\nYou can configure the data folder on first launch of SPGST Pro."
  ${Else}
    DetailPrint "Data directory configured: $SPGST_DataDir"
  ${EndIf}

!macroend

; =============================================================================
;   electron-builder hook: customUnInstall
;   GST data is precious — never auto-delete it on uninstall.
; =============================================================================
!macro customUnInstall
  ; Users can manually remove %APPDATA%\SPGST Pro and their data folder if needed.
!macroend
