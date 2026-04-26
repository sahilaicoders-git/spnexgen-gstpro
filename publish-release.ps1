# SPGST Pro - GitHub Release Publisher
# Usage: .\publish-release.ps1 -Token "your_github_pat_here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Token
)

$Owner   = "sahilaicoders-git"
$Repo    = "spnexgen-gstpro"
$Version = "2.1.2"
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
Write-Host "[1/3] Creating GitHub Release for $Tag ..." -ForegroundColor Yellow

$ReleaseBody = @{
    tag_name         = $Tag
    name             = "SPGST Pro v$Version"
    body             = @"
## SPGST Pro – v$Version Windows Release

### 📦 Download & Install
Download the installer below: **SPGST Pro-Setup-$Version.exe**

### ✨ What's New in v$Version

#### 🎨 Modernized Splash Screen
- Redesigned splash screen with premium visual styling
- Smooth animations and modern layout

#### 🧭 Sidebar Redesign
- Refined sidebar navigation with improved light/dark theme support
- Updated accent colours and layout transitions

#### 📊 GST Sales Module Enhancements
- Enhanced GST sales data entry and reporting
- Improved invoice management workflow

#### 🔄 Auto-Update Support
- Seamless in-app auto-update via electron-updater
- Background download and one-click restart

#### 📤 GSTR-1 Compliance
- Rate-wise HSN grouping in GSTR-1 report
- Separated Reverse Charge (RCM) GST from regular tax totals
- B2B CSV export in GST portal format

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

Write-Host "`n[2/3] Uploading installer EXE (~$([math]::Round((Get-Item $ExePath).Length/1MB))MB) ..." -ForegroundColor Yellow

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

# ── Step 3: Upload the latest.yml (for auto-update) ──────────────────────────
$YmlPath = "$PSScriptRoot\release\latest.yml"
if (Test-Path $YmlPath) {
    Write-Host "`n[3/3] Uploading latest.yml (for auto-update) ..." -ForegroundColor Yellow
    $YmlFileName  = [System.IO.Path]::GetFileName($YmlPath)
    $YmlFileBytes = [System.IO.File]::ReadAllBytes($YmlPath)

    try {
        $YmlAsset = Invoke-RestMethod `
            -Uri "${UploadUrl}?name=$([System.Uri]::EscapeDataString($YmlFileName))" `
            -Method POST `
            -Headers $Headers `
            -Body $YmlFileBytes `
            -ContentType "application/octet-stream"

        Write-Host "  ✅ latest.yml uploaded!" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️ latest.yml upload failed: $_" -ForegroundColor Yellow
        Write-Host "  You can manually upload it at: $($Release.html_url)" -ForegroundColor Magenta
    }
} else {
    Write-Host "`n  ⚠️ latest.yml not found — auto-update won't work without it." -ForegroundColor Yellow
}

Write-Host "`n🎉 Done! Release published at:" -ForegroundColor Green
Write-Host "  $($Release.html_url)" -ForegroundColor Cyan
