# MendoraCI - Bob AI credential setter (PowerShell), relaxed v2.
#
# Usage:
#   cd C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci
#   .\scripts\set-bob-secrets.ps1
#
# v2 changes:
#  - Accepts partial creds. Only BOB_API_KEY is strictly required.
#  - URL defaults to https://us-south.ml.cloud.ibm.com if you don't know.
#  - project_id and deployment_id can BOTH be blank now (you can fill later
#    via .\scripts\bob_discover.ps1 once the API key is loaded).
#  - USE_MOCK_BOB stays `true` until both URL and (project_id OR deployment_id) are set,
#    so the API container never crashes from incomplete config.
#
# Nothing is written to chat / git / logs.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host ""
Write-Host "MendoraCI - Set IBM Bob AI credentials (.env.bob)" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

function Read-Secret([string]$label) {
  $secure = Read-Host -AsSecureString "$label"
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try   { return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# --- prompts ---
$bobUrl = Read-Host "BOB_API_URL (blank = https://us-south.ml.cloud.ibm.com)"
if ([string]::IsNullOrWhiteSpace($bobUrl)) { $bobUrl = "https://us-south.ml.cloud.ibm.com" }

$bobKey = Read-Secret "BOB_API_KEY (IBM Cloud IAM API key, required)"
if ([string]::IsNullOrWhiteSpace($bobKey)) {
  Write-Error "BOB_API_KEY is required. Aborting."
  exit 1
}

$bobProject    = Read-Host "BOB_PROJECT_ID    (optional, blank ok - discover later)"
$bobDeployment = Read-Host "BOB_DEPLOYMENT_ID (optional, blank ok)"
$bobModel      = Read-Host "BOB_MODEL_ID (default: ibm/granite-13b-instruct-v2)"
if ([string]::IsNullOrWhiteSpace($bobModel)) { $bobModel = "ibm/granite-13b-instruct-v2" }

# If neither project nor deployment is known, force mock mode so api keeps running.
$haveTarget = -not ([string]::IsNullOrWhiteSpace($bobProject) -and [string]::IsNullOrWhiteSpace($bobDeployment))
$useMock = if ($haveTarget) { "false" } else { "true" }

# --- write .env.bob ---
$envBob = @"
BOB_API_URL=$bobUrl
BOB_API_KEY=$bobKey
BOB_PROJECT_ID=$bobProject
BOB_DEPLOYMENT_ID=$bobDeployment
BOB_MODEL_ID=$bobModel
USE_MOCK_BOB=$useMock
BOB_MAX_INPUT_TOKENS=8000
BOB_MAX_OUTPUT_TOKENS=2000
"@

$envBobPath = Join-Path $repoRoot ".env.bob"
Set-Content -Path $envBobPath -Value $envBob -Encoding UTF8 -NoNewline
Write-Host ""
Write-Host "Wrote $envBobPath (gitignored)" -ForegroundColor Green
Write-Host "USE_MOCK_BOB=$useMock" -ForegroundColor (@{ "true" = "Yellow"; "false" = "Green" }[$useMock])
if (-not $haveTarget) {
  Write-Host ""
  Write-Host "No project_id/deployment_id yet -> mock mode stays on." -ForegroundColor Yellow
  Write-Host "Run .\scripts\bob_discover.ps1 next to fetch them from IBM Cloud using your key."
}

# Mirror USE_MOCK_BOB in .env too (so docker compose config shows the current mode)
$envPath = Join-Path $repoRoot ".env"
if (Test-Path $envPath) {
  $env = Get-Content $envPath -Raw
  if ($env -match "USE_MOCK_BOB=") {
    $env = $env -replace "USE_MOCK_BOB=.*", "USE_MOCK_BOB=$useMock"
  } else {
    $env = $env.TrimEnd("`r","`n") + "`nUSE_MOCK_BOB=$useMock`n"
  }
  Set-Content -Path $envPath -Value $env -Encoding UTF8 -NoNewline
  Write-Host "Mirrored USE_MOCK_BOB=$useMock in $envPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Restarting api container so new env is loaded..." -ForegroundColor Cyan
docker compose up -d --force-recreate api | Out-Host
Start-Sleep -Seconds 4
Write-Host ""
Write-Host "Verify (BOB_API_KEY value hidden):" -ForegroundColor Cyan
docker compose exec api sh -c "echo BOB_API_URL=`$BOB_API_URL; echo BOB_PROJECT_ID=`$BOB_PROJECT_ID; echo BOB_DEPLOYMENT_ID=`$BOB_DEPLOYMENT_ID; echo BOB_MODEL_ID=`$BOB_MODEL_ID; echo USE_MOCK_BOB=`$USE_MOCK_BOB; if [ -n `"`$BOB_API_KEY`" ]; then echo BOB_API_KEY=<set, length=`$(printf %s `"`$BOB_API_KEY`" | wc -c)>; else echo BOB_API_KEY=<empty>; fi"
