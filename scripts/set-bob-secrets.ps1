# MendoraCI — Bob AI credential setter (PowerShell)
#
# Usage:
#   cd C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci
#   .\scripts\set-bob-secrets.ps1
#
# It will:
#   1. Prompt you (securely) for each Bob credential.
#   2. Write them to .env.bob (which is gitignored).
#   3. Flip USE_MOCK_BOB=false.
#   4. Restart the api container so the new env is picked up.
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

$bobUrl        = Read-Host  "BOB_API_URL (e.g. https://us-south.ml.cloud.ibm.com)"
$bobKey        = Read-Secret "BOB_API_KEY (IBM Cloud IAM API key)"
$bobProject    = Read-Host  "BOB_PROJECT_ID  (leave blank if using deployment_id)"
$bobDeployment = Read-Host  "BOB_DEPLOYMENT_ID (leave blank if using project_id)"
$bobModel      = Read-Host  "BOB_MODEL_ID (default: ibm/granite-13b-instruct-v2)"
if ([string]::IsNullOrWhiteSpace($bobModel)) { $bobModel = "ibm/granite-13b-instruct-v2" }

if ([string]::IsNullOrWhiteSpace($bobUrl) -or [string]::IsNullOrWhiteSpace($bobKey)) {
  Write-Error "BOB_API_URL and BOB_API_KEY are required."
}
if ([string]::IsNullOrWhiteSpace($bobProject) -and [string]::IsNullOrWhiteSpace($bobDeployment)) {
  Write-Error "At least one of BOB_PROJECT_ID or BOB_DEPLOYMENT_ID must be provided."
}

$envBob = @"
BOB_API_URL=$bobUrl
BOB_API_KEY=$bobKey
BOB_PROJECT_ID=$bobProject
BOB_DEPLOYMENT_ID=$bobDeployment
BOB_MODEL_ID=$bobModel
USE_MOCK_BOB=false
BOB_MAX_INPUT_TOKENS=8000
BOB_MAX_OUTPUT_TOKENS=2000
"@

$envBobPath = Join-Path $repoRoot ".env.bob"
Set-Content -Path $envBobPath -Value $envBob -Encoding UTF8 -NoNewline
Write-Host ""
Write-Host "Wrote $envBobPath (gitignored)" -ForegroundColor Green

# Also flip USE_MOCK_BOB in the main .env (so devs see live mode in compose-config)
$envPath = Join-Path $repoRoot ".env"
if (Test-Path $envPath) {
  $env = Get-Content $envPath -Raw
  if ($env -match "USE_MOCK_BOB=") {
    $env = $env -replace "USE_MOCK_BOB=.*", "USE_MOCK_BOB=false"
  } else {
    $env = $env.TrimEnd("`r","`n") + "`nUSE_MOCK_BOB=false`n"
  }
  Set-Content -Path $envPath -Value $env -Encoding UTF8 -NoNewline
  Write-Host "Flipped USE_MOCK_BOB=false in $envPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Restarting api container so new env is loaded..." -ForegroundColor Cyan
docker compose up -d --force-recreate api
Write-Host ""
Write-Host "Done. Verify with: docker compose exec api env | findstr BOB_" -ForegroundColor Cyan
