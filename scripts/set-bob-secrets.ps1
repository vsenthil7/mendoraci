# MendoraCI - Bob AI credential setter (PowerShell), v2.1
#
# v2.1 fix: replaced the buggy in-script verify (was passing a multi-statement
# shell line into `docker compose exec api sh -c` which alpine's sh choked on
# with "syntax error: unexpected ;"). Verify now uses simple `printenv` calls.

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

$haveTarget = -not ([string]::IsNullOrWhiteSpace($bobProject) -and [string]::IsNullOrWhiteSpace($bobDeployment))
$useMock = if ($haveTarget) { "false" } else { "true" }

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
Write-Host "Verify (BOB_API_KEY value redacted):" -ForegroundColor Cyan
# Simple one-var-per-call - no shell metacharacters that alpine sh hates
docker compose exec -T api printenv BOB_API_URL
docker compose exec -T api printenv BOB_PROJECT_ID
docker compose exec -T api printenv BOB_DEPLOYMENT_ID
docker compose exec -T api printenv BOB_MODEL_ID
docker compose exec -T api printenv USE_MOCK_BOB
# Length-only readout for the secret
$keyLen = (docker compose exec -T api printenv BOB_API_KEY) | ForEach-Object { $_.Length }
Write-Host "BOB_API_KEY length: $keyLen"
