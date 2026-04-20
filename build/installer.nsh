; =============================================================================
;   SPGST Pro  —  build/installer.nsh
;   Custom NSIS additions for electron-builder
;
;   What this file does:
;     1.  On FRESH INSTALL: shows a "Choose Data Folder" page as the FIRST
;         installer screen, then writes app-settings.json.
;     2.  On UPGRADE (app-settings.json already exists with a dataDirectory):
;         skips the data-folder page entirely and preserves all existing
;         settings — the user's data directory is NEVER reset.
;     3.  Leaves user data intact on uninstall.
;
;   electron-builder hook macros used:
;     !macro customHeader    — runs before the standard MUI pages are registered
;     !macro customInstall   — runs after file copy; smart-merges settings JSON
;     !macro customUnInstall — runs during uninstall (no-op — data kept)
; =============================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ── Package-level variable declarations ───────────────────────────────────────
Var SPGST_DataDir      ; full path chosen by the user (or read from existing config)
Var SPGST_TextCtrl     ; HWND of the editable text box (persists across callbacks)
Var SPGST_IsUpgrade    ; "1" if an existing app-settings.json was found, "" otherwise

; =============================================================================
;   Helper: read existing dataDirectory from app-settings.json via PowerShell
;   Result is stored in $SPGST_DataDir; $SPGST_IsUpgrade is set to "1" if found.
; =============================================================================
Function SPGST_ReadExistingConfig

  StrCpy $SPGST_IsUpgrade ""
  StrCpy $SPGST_DataDir   "$DOCUMENTS\SPGST_Data"

  ; Write a PowerShell helper that prints the existing dataDirectory (or nothing)
  FileOpen $0 "$TEMP\spgst_read_cfg.ps1" w
  FileWrite $0 "$$cfgFile = Join-Path $$env:APPDATA $\"SPGST Pro$\" | Join-Path -ChildPath $\"app-settings.json$\""
  FileWrite $0 "$\n"
  FileWrite $0 "if (Test-Path $$cfgFile) {"
  FileWrite $0 "$\n"
  FileWrite $0 "  try {"
  FileWrite $0 "$\n"
  FileWrite $0 "    $$s = Get-Content $$cfgFile -Raw | ConvertFrom-Json"
  FileWrite $0 "$\n"
  FileWrite $0 "    if ($$s.dataDirectory -and $$s.dataDirectory.Trim() -ne '') {"
  FileWrite $0 "$\n"
  FileWrite $0 "      Write-Output $$s.dataDirectory.Trim()"
  FileWrite $0 "$\n"
  FileWrite $0 "    }"
  FileWrite $0 "$\n"
  FileWrite $0 "  } catch {}"
  FileWrite $0 "$\n"
  FileWrite $0 "}"
  FileClose $0

  ; Run PowerShell and capture stdout into a temp file
  nsExec::ExecToStack '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -NoProfile -NonInteractive -WindowStyle Hidden -File "$TEMP\spgst_read_cfg.ps1"'
  Pop $R0   ; exit code
  Pop $R1   ; stdout (trimmed)

  Delete "$TEMP\spgst_read_cfg.ps1"

  ; Strip trailing whitespace/newlines that PowerShell may add
  ; (nsExec captures the full stdout; a single path line is fine)
  ${If} $R0 == 0
  ${AndIf} $R1 != ""
    StrCpy $SPGST_DataDir   $R1
    StrCpy $SPGST_IsUpgrade "1"
  ${EndIf}

FunctionEnd

; =============================================================================
;   Page functions
; =============================================================================

; ── Show: builds the custom nsDialogs page ────────────────────────────────────
Function SPGST_DataDirShow

  ; Read any existing config first
  Call SPGST_ReadExistingConfig

  ; If this is an upgrade, skip the data-folder page completely
  ${If} $SPGST_IsUpgrade == "1"
    Abort   ; Abort in a Page-Show function skips that page silently
  ${EndIf}

  ; ── Fresh install: show the folder-selection dialog ───────────────────────

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
;   Installer page order (fresh install):
;     [0] Data Folder  (ours — skipped on upgrade)
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
;
;   UPGRADE path  ($SPGST_IsUpgrade == "1"):
;     - Reads the existing app-settings.json
;     - Preserves ALL existing keys (dataDirectory, gst_username, etc.)
;     - Does NOT overwrite anything
;
;   FRESH INSTALL path ($SPGST_IsUpgrade == ""):
;     - Creates the data directory chosen by the user
;     - Writes a new app-settings.json with { dataDirectory: <chosen path> }
;
;   NSIS string escaping rules used below:
;     $$      ->  literal $  (used for PowerShell variables)
;     $\"     ->  literal "
;     $VAR    ->  value of NSIS variable at runtime  (e.g. the path string)
;     $\n     ->  newline written to file
; =============================================================================
!macro customInstall

  ${If} $SPGST_IsUpgrade == "1"

    ; ── Upgrade: just make sure the data directory still exists ─────────────
    DetailPrint "Upgrade detected — preserving existing SPGST Pro data directory..."

    FileOpen $0 "$TEMP\spgst_upgrade.ps1" w

    FileWrite $0 "$$ErrorActionPreference = $\"Stop$\""
    FileWrite $0 "$\n"
    FileWrite $0 "$$cfgFile = Join-Path $$env:APPDATA $\"SPGST Pro$\" | Join-Path -ChildPath $\"app-settings.json$\""
    FileWrite $0 "$\n"
    FileWrite $0 "if (Test-Path $$cfgFile) {"
    FileWrite $0 "$\n"
    FileWrite $0 "  try {"
    FileWrite $0 "$\n"
    FileWrite $0 "    $$s = Get-Content $$cfgFile -Raw | ConvertFrom-Json"
    FileWrite $0 "$\n"
    FileWrite $0 "    if ($$s.dataDirectory -and $$s.dataDirectory.Trim() -ne '') {"
    FileWrite $0 "$\n"
    FileWrite $0 "      New-Item -Force -ItemType Directory -Path $$s.dataDirectory | Out-Null"
    FileWrite $0 "$\n"
    FileWrite $0 "    }"
    FileWrite $0 "$\n"
    FileWrite $0 "  } catch {}"
    FileWrite $0 "$\n"
    FileWrite $0 "}"

    FileClose $0

    nsExec::ExecToLog '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -NoProfile -NonInteractive -WindowStyle Hidden -File "$TEMP\spgst_upgrade.ps1"'
    Pop $R0

    Delete "$TEMP\spgst_upgrade.ps1"

    DetailPrint "Upgrade complete — your data and settings are unchanged."

  ${Else}

    ; ── Fresh install: write the initial app-settings.json ──────────────────
    DetailPrint "Writing SPGST Pro data directory configuration..."

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
    FileWrite $0 "$$cfgFile = Join-Path $$cfgDir $\"app-settings.json$\""
    FileWrite $0 "$\n"
    FileWrite $0 "# Only write if not already present (safety guard)"
    FileWrite $0 "$\n"
    FileWrite $0 "if (-not (Test-Path $$cfgFile)) {"
    FileWrite $0 "$\n"
    FileWrite $0 "  $$json = [ordered]@{ dataDirectory = $$dataDir } | ConvertTo-Json"
    FileWrite $0 "$\n"
    FileWrite $0 "  $$utf8NoBom = New-Object System.Text.UTF8Encoding($$false)"
    FileWrite $0 "$\n"
    FileWrite $0 "  [System.IO.File]::WriteAllText($$cfgFile, $$json, $$utf8NoBom)"
    FileWrite $0 "$\n"
    FileWrite $0 "}"

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

  ${EndIf}

!macroend

; =============================================================================
;   electron-builder hook: customUnInstall
;   GST data is precious — never auto-delete it on uninstall.
; =============================================================================
!macro customUnInstall
  ; Users can manually remove %APPDATA%\SPGST Pro and their data folder if needed.
!macroend
