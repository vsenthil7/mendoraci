# MendoraCI - Bob/WatsonX discovery helper.
#
# Given an IBM Cloud IAM API key (read from .env.bob), this:
#   1. Exchanges the API key for a short-lived IAM Bearer token.
#   2. Probes regional WatsonX endpoints to find which region your account is in.
#   3. Lists projects you can access.
#   4. Lets you pick one (or paste a deployment_id).
#   5. Writes the chosen values back into .env.bob and restarts the api.
#
# Usage:
#   cd C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci
#   .\scripts\bob_discover.ps1
#
# Nothing leaves your machine except the IAM token exchange to https://iam.cloud.ibm.com
# and the WatsonX project listing to the regional ml.cloud.ibm.com endpoint.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envBobPath = Join-Path $repoRoot ".env.bob"
if (-not (Test-Path $envBobPath)) {
  Write-Error ".env.bob not found. Run .\scripts\set-bob-secrets.ps1 first."
  exit 1
}

# Parse .env.bob
$envMap = @{}
foreach ($line in (Get-Content $envBobPath)) {
  if ($line -match '^\s*#') { continue }
  if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') { $envMap[$Matches[1]] = $Matches[2] }
}
$apiKey = $envMap['BOB_API_KEY']
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Error "BOB_API_KEY missing in .env.bob. Re-run set-bob-secrets.ps1."
  exit 1
}

# 1. IAM token exchange
Write-Host "1) Exchanging API key for IAM bearer token..." -ForegroundColor Cyan
try {
  $iamResp = Invoke-RestMethod -Method Post -Uri "https://iam.cloud.ibm.com/identity/token" `
    -Headers @{ "Content-Type" = "application/x-www-form-urlencoded"; "Accept" = "application/json" } `
    -Body "grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=$apiKey"
} catch {
  Write-Error "IAM token exchange failed: $($_.Exception.Message). Check the API key."
  exit 2
}
$token = $iamResp.access_token
if ([string]::IsNullOrWhiteSpace($token)) { Write-Error "No access_token returned."; exit 2 }
Write-Host "   IAM token OK (length=$($token.Length))" -ForegroundColor Green

# 2. Probe regional endpoints. WatsonX has these public regions:
$regions = @(
  @{ name = "us-south";  url = "https://us-south.ml.cloud.ibm.com" },
  @{ name = "eu-de";     url = "https://eu-de.ml.cloud.ibm.com" },
  @{ name = "eu-gb";     url = "https://eu-gb.ml.cloud.ibm.com" },
  @{ name = "jp-tok";    url = "https://jp-tok.ml.cloud.ibm.com" },
  @{ name = "ca-tor";    url = "https://ca-tor.ml.cloud.ibm.com" },
  @{ name = "au-syd";    url = "https://au-syd.ml.cloud.ibm.com" }
)

Write-Host ""
Write-Host "2) Probing regional WatsonX endpoints for project access..." -ForegroundColor Cyan

# WatsonX projects API (use Cloud Pak for Data variant)
# /v2/projects?bss_account_id=... - but we don't need bss_account_id; the IAM token scopes it.
$found = @()
foreach ($r in $regions) {
  $probeUrl = "$($r.url)/ml/v1/foundation_model_specs?version=2024-08-01&limit=1"
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $probeUrl -Headers @{
      "Authorization" = "Bearer $token"
      "Accept"        = "application/json"
    } -TimeoutSec 8
    if ($resp.StatusCode -eq 200) {
      Write-Host "   $($r.name) reachable" -ForegroundColor Green
      $found += $r
    }
  } catch {
    # 401/403 still means the URL is reachable; only treat connection failures as unreachable.
    $code = ($_.Exception.Response).StatusCode.value__
    if ($code -in 401, 403) {
      Write-Host "   $($r.name) reachable (auth $code, still OK to use)" -ForegroundColor DarkYellow
      $found += $r
    }
  }
}

if ($found.Count -eq 0) {
  Write-Error "No WatsonX regions were reachable. Check network / API key entitlements."
  exit 3
}

# 3. Pick region
$pickedRegion = $found[0]
if ($found.Count -gt 1) {
  Write-Host ""
  Write-Host "Multiple regions reachable. Pick one:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $found.Count; $i++) {
    Write-Host ("  [{0}] {1}  ({2})" -f $i, $found[$i].name, $found[$i].url)
  }
  $idx = Read-Host "Enter index"
  if ($idx -match '^\d+$' -and [int]$idx -lt $found.Count) {
    $pickedRegion = $found[[int]$idx]
  }
}
Write-Host "Using region: $($pickedRegion.name) -> $($pickedRegion.url)" -ForegroundColor Green

# 4. List projects via Cloud Pak for Data API
Write-Host ""
Write-Host "3) Listing projects you can access..." -ForegroundColor Cyan
$projects = @()
try {
  # Cloud Pak for Data Projects API is at api.dataplatform.cloud.ibm.com (regional)
  $dpHost = switch ($pickedRegion.name) {
    "us-south" { "https://api.dataplatform.cloud.ibm.com" }
    "eu-de"    { "https://api.eu-de.dataplatform.cloud.ibm.com" }
    "eu-gb"    { "https://api.eu-gb.dataplatform.cloud.ibm.com" }
    "jp-tok"   { "https://api.jp-tok.dataplatform.cloud.ibm.com" }
    "ca-tor"   { "https://api.ca-tor.dataplatform.cloud.ibm.com" }
    "au-syd"   { "https://api.au-syd.dataplatform.cloud.ibm.com" }
    default    { "https://api.dataplatform.cloud.ibm.com" }
  }
  $resp = Invoke-RestMethod -Method Get -Uri "$dpHost/v2/projects?limit=50" `
    -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/json" }
  $projects = @($resp.resources)
} catch {
  Write-Host "   Could not list projects via $dpHost ($_)." -ForegroundColor Yellow
}

$chosenProject = ""
if ($projects.Count -gt 0) {
  Write-Host "Found $($projects.Count) project(s):" -ForegroundColor Green
  for ($i = 0; $i -lt $projects.Count; $i++) {
    $name = $projects[$i].entity.name
    $id   = $projects[$i].metadata.guid
    Write-Host ("  [{0}] {1}   ({2})" -f $i, $name, $id)
  }
  $sel = Read-Host "Pick project index (blank = none, paste deployment_id later)"
  if ($sel -match '^\d+$' -and [int]$sel -lt $projects.Count) {
    $chosenProject = $projects[[int]$sel].metadata.guid
  }
} else {
  Write-Host "No projects returned. You'll need to create one in https://dataplatform.cloud.ibm.com" -ForegroundColor Yellow
}

# 5. Optional deployment id
$chosenDeployment = ""
if ([string]::IsNullOrWhiteSpace($chosenProject)) {
  $chosenDeployment = Read-Host "BOB_DEPLOYMENT_ID (paste if you have one, else blank stays in mock)"
}

# 6. Write back into .env.bob
$envMap['BOB_API_URL']      = $pickedRegion.url
$envMap['BOB_PROJECT_ID']   = $chosenProject
$envMap['BOB_DEPLOYMENT_ID'] = $chosenDeployment
$envMap['USE_MOCK_BOB']     = if ([string]::IsNullOrWhiteSpace($chosenProject) -and [string]::IsNullOrWhiteSpace($chosenDeployment)) { "true" } else { "false" }

$out = @(
  "BOB_API_URL=$($envMap['BOB_API_URL'])",
  "BOB_API_KEY=$($envMap['BOB_API_KEY'])",
  "BOB_PROJECT_ID=$($envMap['BOB_PROJECT_ID'])",
  "BOB_DEPLOYMENT_ID=$($envMap['BOB_DEPLOYMENT_ID'])",
  "BOB_MODEL_ID=$($envMap['BOB_MODEL_ID'])",
  "USE_MOCK_BOB=$($envMap['USE_MOCK_BOB'])",
  "BOB_MAX_INPUT_TOKENS=$($envMap['BOB_MAX_INPUT_TOKENS'])",
  "BOB_MAX_OUTPUT_TOKENS=$($envMap['BOB_MAX_OUTPUT_TOKENS'])"
) -join "`n"

Set-Content -Path $envBobPath -Value $out -Encoding UTF8 -NoNewline
Write-Host ""
Write-Host "Updated $envBobPath" -ForegroundColor Green
Write-Host "  BOB_API_URL      = $($envMap['BOB_API_URL'])"
Write-Host "  BOB_PROJECT_ID   = $($envMap['BOB_PROJECT_ID'])"
Write-Host "  BOB_DEPLOYMENT_ID= $($envMap['BOB_DEPLOYMENT_ID'])"
Write-Host "  USE_MOCK_BOB     = $($envMap['USE_MOCK_BOB'])"

# Mirror USE_MOCK_BOB in .env
$envPath = Join-Path $repoRoot ".env"
if (Test-Path $envPath) {
  $env = Get-Content $envPath -Raw
  if ($env -match "USE_MOCK_BOB=") {
    $env = $env -replace "USE_MOCK_BOB=.*", "USE_MOCK_BOB=$($envMap['USE_MOCK_BOB'])"
  } else {
    $env = $env.TrimEnd("`r","`n") + "`nUSE_MOCK_BOB=$($envMap['USE_MOCK_BOB'])`n"
  }
  Set-Content -Path $envPath -Value $env -Encoding UTF8 -NoNewline
}

Write-Host ""
Write-Host "Restarting api container..." -ForegroundColor Cyan
docker compose up -d --force-recreate api | Out-Host
