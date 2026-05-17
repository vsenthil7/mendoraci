# MendoraCI - Bob/WatsonX discovery helper. v2.
#
# v2 fixes:
#  - IAM token call now passes a hashtable to -Body (PS handles form encoding).
#    v1 passed a pre-encoded string which PS re-encoded, breaking the grant_type
#    URN's colons and producing 400 Bad Request.
#  - Adds explicit diagnostics on each step so we can see exactly where it stops.
#  - Reads .env.bob defensively (BOM-tolerant).
#
# Usage:
#   cd C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci
#   .\scripts\bob_discover.ps1

$ErrorActionPreference = "Stop"
$ProgressPreference   = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envBobPath = Join-Path $repoRoot ".env.bob"
if (-not (Test-Path $envBobPath)) {
  Write-Error ".env.bob not found. Run .\scripts\set-bob-secrets.ps1 first."
  exit 1
}

# Parse .env.bob (BOM-tolerant)
$envMap = @{}
foreach ($raw in (Get-Content $envBobPath)) {
  $line = $raw -replace "^\xEF\xBB\xBF", ""   # strip UTF-8 BOM if present
  if ($line -match '^\s*#') { continue }
  if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') { $envMap[$Matches[1]] = $Matches[2] }
}
$apiKey = $envMap['BOB_API_KEY']
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Error "BOB_API_KEY missing in .env.bob. Re-run set-bob-secrets.ps1."
  exit 1
}
Write-Host "Loaded API key (length=$($apiKey.Length))" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# 1) IAM token exchange — use hashtable body so PS encodes properly
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "1) Exchanging API key for IAM bearer token..." -ForegroundColor Cyan

$iamBody = @{
  grant_type = "urn:ibm:params:oauth:grant-type:apikey"
  apikey     = $apiKey
}

try {
  $iamResp = Invoke-RestMethod -Method Post `
    -Uri "https://iam.cloud.ibm.com/identity/token" `
    -Headers @{ "Accept" = "application/json" } `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $iamBody
} catch {
  $resp = $_.Exception.Response
  $code = $null; $bodyText = ""
  if ($resp -ne $null) {
    $code = $resp.StatusCode.value__
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $bodyText = $sr.ReadToEnd()
    } catch {}
  }
  Write-Host ("   IAM call failed: HTTP {0}" -f $code) -ForegroundColor Red
  if ($bodyText) { Write-Host "   Body: $bodyText" -ForegroundColor Red }
  Write-Error "IAM token exchange failed. Most common cause: API key copy-paste lost characters, or extra whitespace. Re-run .\scripts\set-bob-secrets.ps1 and re-paste."
  exit 2
}

$token = $iamResp.access_token
if ([string]::IsNullOrWhiteSpace($token)) { Write-Error "No access_token returned."; exit 2 }
Write-Host "   IAM token OK (length=$($token.Length))" -ForegroundColor Green

# Inspect token claims so we know which IBM Cloud account we're scoped to
try {
  $parts = $token.Split('.')
  if ($parts.Count -ge 2) {
    $pad = ($parts[1].Length % 4); if ($pad) { $pad = 4 - $pad } else { $pad = 0 }
    $b64 = $parts[1] + ('=' * $pad)
    $b64 = $b64.Replace('-', '+').Replace('_', '/')
    $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64))
    $payload = $payloadJson | ConvertFrom-Json
    if ($payload.account.bss) { Write-Host "   Account (BSS): $($payload.account.bss)" -ForegroundColor DarkGray }
    if ($payload.email)       { Write-Host "   Email: $($payload.email)" -ForegroundColor DarkGray }
  }
} catch {}

# ---------------------------------------------------------------------------
# 2) Probe WatsonX regions
# ---------------------------------------------------------------------------
$regions = @(
  @{ name = "us-south"; url = "https://us-south.ml.cloud.ibm.com"; dp = "https://api.dataplatform.cloud.ibm.com" },
  @{ name = "eu-de";    url = "https://eu-de.ml.cloud.ibm.com";    dp = "https://api.eu-de.dataplatform.cloud.ibm.com" },
  @{ name = "eu-gb";    url = "https://eu-gb.ml.cloud.ibm.com";    dp = "https://api.eu-gb.dataplatform.cloud.ibm.com" },
  @{ name = "jp-tok";   url = "https://jp-tok.ml.cloud.ibm.com";   dp = "https://api.jp-tok.dataplatform.cloud.ibm.com" },
  @{ name = "ca-tor";   url = "https://ca-tor.ml.cloud.ibm.com";   dp = "https://api.ca-tor.dataplatform.cloud.ibm.com" },
  @{ name = "au-syd";   url = "https://au-syd.ml.cloud.ibm.com";   dp = "https://api.au-syd.dataplatform.cloud.ibm.com" }
)

Write-Host ""
Write-Host "2) Probing regional WatsonX endpoints..." -ForegroundColor Cyan
$found = @()
foreach ($r in $regions) {
  $probe = "$($r.url)/ml/v1/foundation_model_specs?version=2024-08-01&limit=1"
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $probe -Headers @{
      "Authorization" = "Bearer $token"; "Accept" = "application/json"
    } -TimeoutSec 8
    Write-Host ("   {0,-8} reachable (HTTP {1})" -f $r.name, $resp.StatusCode) -ForegroundColor Green
    $found += $r
  } catch {
    $code = ($_.Exception.Response).StatusCode.value__
    if ($code -in 401, 403) {
      Write-Host ("   {0,-8} reachable (auth {1}, still OK)" -f $r.name, $code) -ForegroundColor DarkYellow
      $found += $r
    } else {
      Write-Host ("   {0,-8} unreachable ({1})" -f $r.name, ($code ?? "net err")) -ForegroundColor DarkGray
    }
  }
}

if ($found.Count -eq 0) {
  Write-Error "No WatsonX regions reachable. Check entitlements / network."
  exit 3
}

# ---------------------------------------------------------------------------
# 3) Pick region
# ---------------------------------------------------------------------------
$pickedRegion = $found[0]
if ($found.Count -gt 1) {
  Write-Host ""
  Write-Host "Multiple regions reachable. Pick one:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $found.Count; $i++) {
    Write-Host ("  [{0}] {1}  ({2})" -f $i, $found[$i].name, $found[$i].url)
  }
  $idx = Read-Host "Enter index (default 0)"
  if ($idx -match '^\d+$' -and [int]$idx -lt $found.Count) {
    $pickedRegion = $found[[int]$idx]
  }
}
Write-Host "Using region: $($pickedRegion.name) -> $($pickedRegion.url)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4) List projects via dataplatform endpoint
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "3) Listing projects via $($pickedRegion.dp)..." -ForegroundColor Cyan
$projects = @()
try {
  $resp = Invoke-RestMethod -Method Get -Uri "$($pickedRegion.dp)/v2/projects?limit=50" `
    -Headers @{ "Authorization" = "Bearer $token"; "Accept" = "application/json" }
  $projects = @($resp.resources)
} catch {
  $code = ($_.Exception.Response).StatusCode.value__
  Write-Host ("   Project list failed (HTTP {0}). You can still paste project_id manually." -f $code) -ForegroundColor Yellow
}

$chosenProject = ""
if ($projects.Count -gt 0) {
  Write-Host "Found $($projects.Count) project(s):" -ForegroundColor Green
  for ($i = 0; $i -lt $projects.Count; $i++) {
    $name = $projects[$i].entity.name
    $id   = $projects[$i].metadata.guid
    Write-Host ("  [{0}] {1}   ({2})" -f $i, $name, $id)
  }
  $sel = Read-Host "Pick project index (blank = paste deployment_id below instead)"
  if ($sel -match '^\d+$' -and [int]$sel -lt $projects.Count) {
    $chosenProject = $projects[[int]$sel].metadata.guid
  }
} else {
  Write-Host "No projects returned. You'll need to create one at:" -ForegroundColor Yellow
  Write-Host "  https://dataplatform.cloud.ibm.com" -ForegroundColor Yellow
}

# Optional deployment id
$chosenDeployment = ""
if ([string]::IsNullOrWhiteSpace($chosenProject)) {
  $chosenDeployment = Read-Host "BOB_DEPLOYMENT_ID (paste if you have one, blank = stay in mock)"
}

# ---------------------------------------------------------------------------
# 5) Write back into .env.bob and restart
# ---------------------------------------------------------------------------
$envMap['BOB_API_URL']       = $pickedRegion.url
$envMap['BOB_PROJECT_ID']    = $chosenProject
$envMap['BOB_DEPLOYMENT_ID'] = $chosenDeployment
$envMap['USE_MOCK_BOB']      = if ([string]::IsNullOrWhiteSpace($chosenProject) -and [string]::IsNullOrWhiteSpace($chosenDeployment)) { "true" } else { "false" }

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
Write-Host "Updated $envBobPath:" -ForegroundColor Green
Write-Host "  BOB_API_URL       = $($envMap['BOB_API_URL'])"
Write-Host "  BOB_PROJECT_ID    = $($envMap['BOB_PROJECT_ID'])"
Write-Host "  BOB_DEPLOYMENT_ID = $($envMap['BOB_DEPLOYMENT_ID'])"
Write-Host "  USE_MOCK_BOB      = $($envMap['USE_MOCK_BOB'])"

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
