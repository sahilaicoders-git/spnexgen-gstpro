# SPGST Pro - GitHub Release Publisher
# Usage: .\publish-release.ps1 -Token "your_github_pat_here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$Owner   = "sahilaicoders-git"
$Repo    = "spnexgen-gstpro"
$Version = "2.0.5"
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

#### 🌐 Online Module — GST Portal Access
- New **Online** sidebar section with "Login to GST Portal" and "GST Dashboard" shortcuts
- **Auto-fill credentials** — saves username & password securely; injects them into the portal login page automatically (robust Angular-aware retry loop)
- CAPTCHA still entered manually (GST portal security)
- Quick links: GSTR-1 Filing, GSTR-3B Filing, Track Application, E-Way Bill
- Persistent browser session via `persist:gstportal`

#### 🎨 UI Redesign
- **Premium dark Topbar** — navy gradient matching the header cards, rainbow accent line, frosted-glass selectors, gradient action buttons
- **Theme-aware** — Topbar and TitleBar now switch cleanly between light (white) and dark (navy) modes
- **New Splash Screen** — deep-space ambient background, spinning orbit ring logo, shimmer progress bar, staged step labels, scan-line sweep, blur-exit transition

#### 🔧 GSTR-3B ITC Carry-Forward (from v2.0.4)
- Persistent carry-forward ITC across months/fiscal years
- Edit opening balance manually
- Auto-save remaining ITC on GSTR-3B save

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
    Write-Host "     Run 'npm run dist:win' first." -ForegroundColor Yellow
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
