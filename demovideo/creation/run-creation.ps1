# MendoraCI Demo Video Creation pipeline
# Ported from forensa/demovideo/creation/run-creation.ps1

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $here)
$demoDir = Join-Path $projectRoot 'demo'
$backupDir = Join-Path $demoDir '_backup'
$resultsDir = Join-Path (Split-Path -Parent $here) 'results\creation'
$playwrightDir = Join-Path $projectRoot 'tests\playwright'

Write-Host ''
Write-Host '[creation] === MendoraCI Demo Video Creation (1 minute) === ' -ForegroundColor Yellow

# 1) Pre-flight
Write-Host '[creation] 1/4 pre-flight: docker compose stack up?' -ForegroundColor Cyan
$webStatus = docker ps --filter 'name=mendoraci-web' --format '{{.Names}}:{{.Status}}' 2>$null
$apiStatus = docker ps --filter 'name=mendoraci-api' --format '{{.Names}}:{{.Status}}' 2>$null
if (-not ($webStatus -match 'Up') -or -not ($apiStatus -match 'Up')) {
    Write-Host '  stack not fully up - running docker compose up -d' -ForegroundColor Yellow
    Push-Location $projectRoot
    try { docker compose up -d; Start-Sleep -Seconds 8 } finally { Pop-Location }
} else {
    Write-Host "  web : $webStatus"
    Write-Host "  api : $apiStatus"
}

# 2) Run playwright spec
Write-Host '[creation] 2/4 running playwright captioned spec (DEMO=1)' -ForegroundColor Cyan
Push-Location $playwrightDir
try {
    $env:DEMO = '1'
    $env:WEB_BASE_URL = if ($env:WEB_BASE_URL) { $env:WEB_BASE_URL } else { 'http://localhost:3000' }
    $env:API_BASE_URL = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { 'http://localhost:4000' }
    npx playwright test demo/scr-001-demo.spec.ts --config=playwright.demo.config.ts --reporter=line
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[creation] playwright spec failed - aborting archive' -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item Env:DEMO -ErrorAction SilentlyContinue
    Pop-Location
}

# 3) Locate video
Write-Host '[creation] 3/4 locating recorded video' -ForegroundColor Cyan
New-Item -Path $demoDir -ItemType Directory -Force | Out-Null
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
New-Item -Path $resultsDir -ItemType Directory -Force | Out-Null

$testResultsDir = Join-Path $playwrightDir 'test-results-demo'
$src = Get-ChildItem $testResultsDir -Recurse -Filter 'video.webm' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $src) {
    Write-Host "[creation] no recorded video found in $testResultsDir" -ForegroundColor Red
    exit 1
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$dstName = "mendoraci-1min-$stamp.webm"
$dstMain = Join-Path $demoDir $dstName
$dstBackup = Join-Path $backupDir $dstName

# 4) Trim + archive
Write-Host '[creation] 4/4 trimming + archiving' -ForegroundColor Cyan
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host '  trimming leading 1.0s via ffmpeg re-encode' -ForegroundColor Cyan
    & ffmpeg -y -ss 1.0 -i $src.FullName -c:v libvpx -b:v 1M -crf 10 -an $dstMain 2>&1 | Out-Null
    if ((Test-Path $dstMain) -and ((Get-Item $dstMain).Length -gt 0)) {
        Copy-Item $dstMain $dstBackup -Force
    } else {
        Write-Host '  ffmpeg trim failed - falling back to copy' -ForegroundColor Yellow
        Copy-Item $src.FullName $dstMain -Force
        Copy-Item $src.FullName $dstBackup -Force
    }
} else {
    Write-Host '  ffmpeg not on PATH - skipping leading-frame trim' -ForegroundColor Yellow
    Copy-Item $src.FullName $dstMain -Force
    Copy-Item $src.FullName $dstBackup -Force
}

# MP4 transcode for upload portals
$mp4Dst = [System.IO.Path]::ChangeExtension($dstMain, '.mp4')
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host '  producing MP4 for upload portals' -ForegroundColor Cyan
    & ffmpeg -y -i $dstMain -c:v libx264 -crf 22 -preset slow -an $mp4Dst 2>&1 | Out-Null
    if ((Test-Path $mp4Dst) -and ((Get-Item $mp4Dst).Length -gt 0)) {
        Write-Host "  mp4    : $mp4Dst"
    }
}

Set-Content -Path (Join-Path $resultsDir 'latest.txt') -Value $dstMain -Encoding ASCII
Write-Host "  active : $dstMain"
Write-Host "  backup : $dstBackup"
Write-Host ("  size   : {0} MB" -f [math]::Round((Get-Item $dstMain).Length / 1MB, 2))

Write-Host '[creation] done' -ForegroundColor Green
