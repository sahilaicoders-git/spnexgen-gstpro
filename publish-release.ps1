# SPGST Pro - GitHub Release Publisher
# Usage: .\publish-release.ps1 -Token "your_github_pat_here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$Owner   = "sahilaicoders-git"
$Repo    = "spnexgen-gstpro"
$Version = "2.1.0"
$Tag     = "v$Version"
$ExePath = "$PSScriptRoot\release\SPGST Pro-Setup-$Version.exe"

$Headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

Write-Host "`n=== SPGST Pro GitHub Release Publisher ===" -ForegroundColor Cyan
Write-Host "Repository : $Owner/$Repo"
Write-Host "Tag        : $Tag"
Write-Host "Asset      : $ExePath`n"

# ── Step 1: Create the Release ───────────────────────────────────────────────
Write-Host "[1/2] Creating GitHub Release for $Tag ..." -ForegroundColor Yellow

$ReleaseBody = @{
    tag_name         = $Tag
    name             = "SPGST Pro v$Version"
    body             = @"
## SPGST Pro – v$Version Windows Release

### 📦 Download & Install
Download the installer below: **SPGST Pro-Setup-$Version.exe**

### ✨ What's New in v$Version

#### 🎨 Modern Sidebar Redesign
- Deep navy dark-mode sidebar with **per-section accent colours** (each section glows in its own unique colour)
- Full **light/dark theme support** — sidebar switches cleanly between white (light) and navy (dark) based on your OS/app setting
- Rounded-square icon blocks with colour glow on hover/active
- Coloured left accent bar with neon glow on active section
- Glowing dot indicators for sub-menu items
- Thin connector line on child-item accordion
- Visual dividers before Online and Settings sections

#### ⚙️ Settings — Tabbed Layout
- Settings page now has 4 clean tabs: **Directory**, **Theme**, **Updates**, **Backup**
- Each tab shows only its own content — no more scrolling through all settings
- **Backup tab**: Create ZIP backup in one click + Restore from ZIP with automatic safety-backup
- **Theme tab**: Large clickable tile cards (Light / Dark / System)

#### 📤 B2B CSV Export & SPOnline JSON Tool
- **Sales Summary → B2B tab** now has "Export B2B CSV (GST Portal Format)" button
- CSV matches the exact GST portal column format (GSTIN, Invoice date as dd-MMM-yy, Place Of Supply as code-State, etc.)
- Direct link to **SPOnline CSV→JSON Tool** for one-click GSTR-1 JSON generation
- New **Utilities → GSTR-1 JSON Converter** page with step-by-step guide and CSV format reference table

#### ✏️ Sales Edit Feature
- Edit existing B2B and B2C invoices directly from Sales Summary
- Full edit modal with line-item editing and live tax recalculation

#### 📄 GSTR-1 Document Summary (Table 13)
- Full editable Table 13 grid with all 12 GST document types
- Auto-calculates Total Number and Net Issued from serial ranges
- Auto-populates "Invoices for outward supply" from B2B dataset

### 💻 System Requirements
- Windows 10/11 (64-bit)
- ~90 MB disk space

### ⚠️ Note
On first launch, Windows SmartScreen may show a warning — click **More info → Run anyway** to proceed.
"@
    draft            = $false
    prerelease       = $false
    make_latest      = "true"
} | ConvertTo-Json -Depth 5

try {
    $Release = Invoke-RestMethod `
        -Uri "https://api.github.com/repos/$Owner/$Repo/releases" `
        -Method POST `
        -Headers $Headers `
        -Body $ReleaseBody `
        -ContentType "application/json"

    Write-Host "  ✅ Release created! ID: $($Release.id)" -ForegroundColor Green
    Write-Host "  🔗 URL: $($Release.html_url)"
} catch {
    Write-Host "  ❌ Failed to create release: $_" -ForegroundColor Red
    exit 1
}

# ── Step 2: Upload the EXE asset ─────────────────────────────────────────────
if (-not (Test-Path $ExePath)) {
    Write-Host "  ❌ EXE not found at: $ExePath" -ForegroundColor Red
    Write-Host "     Run 'npm run dist:win' first to build the installer." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[2/2] Uploading installer EXE (~$([math]::Round((Get-Item $ExePath).Length/1MB))MB) ..." -ForegroundColor Yellow

$UploadUrl = $Release.upload_url -replace '\{.*\}', ''
$FileName  = [System.IO.Path]::GetFileName($ExePath)
$FileBytes = [System.IO.File]::ReadAllBytes($ExePath)

try {
    $Asset = Invoke-RestMethod `
        -Uri "${UploadUrl}?name=$([System.Uri]::EscapeDataString($FileName))" `
        -Method POST `
        -Headers $Headers `
        -Body $FileBytes `
        -ContentType "application/octet-stream"

    Write-Host "  ✅ Asset uploaded!" -ForegroundColor Green
    Write-Host "  📥 Download URL: $($Asset.browser_download_url)"
} catch {
    Write-Host "  ❌ Upload failed: $_" -ForegroundColor Red
    Write-Host "  You can manually upload the EXE at: $($Release.html_url)" -ForegroundColor Magenta
    exit 1
}

Write-Host "`n🎉 Done! Release published at:" -ForegroundColor Green
Write-Host "  $($Release.html_url)" -ForegroundColor Cyan
