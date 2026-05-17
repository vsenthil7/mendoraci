<#
.SYNOPSIS  Generate strong secrets and populate .env for MendoraCI on Windows.
.DESCRIPTION  Replaces every __CHANGE_ME__ in .env with a strong random secret.
              Prompts privately for IBM Bob credentials (Enter to skip => mock-bob).
              Never echoes secrets.
.EXAMPLE  PS> .\scripts\set-secrets.ps1
#>
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$envFile  = Join-Path $repoRoot '.env'

if (-not (Test-Path $envFile)) {
  Write-Host "Copying .env.example -> .env" -ForegroundColor Cyan
  Copy-Item (Join-Path $repoRoot '.env.example') $envFile
}

function New-Secret([int]$Bytes = 32) {
  $b = [byte[]]::new($Bytes)
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
}

Write-Host "Generating secrets..." -ForegroundColor Cyan
$secrets = @{
  POSTGRES_PASSWORD = (New-Secret 24)
  S3_SECRET_KEY     = (New-Secret 24)
  JWT_SECRET        = (New-Secret 48)
  HMAC_TENANT_SEED  = (New-Secret 48)
}

$content = Get-Content $envFile -Raw
foreach ($k in $secrets.Keys) {
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, "^$k=.*$", "$k=$($secrets[$k])", 'Multiline')
}
$content = $content -replace 'DATABASE_URL=postgresql://[^@]+@', "DATABASE_URL=postgresql://mendoraci_app:$($secrets.POSTGRES_PASSWORD)@"

Write-Host ""
Write-Host "IBM Bob AI credentials (press Enter to skip => mock Bob stays on):" -ForegroundColor Yellow
$bobSecure = Read-Host "BOB_API_KEY" -AsSecureString
$bobKey = [System.Net.NetworkCredential]::new('', $bobSecure).Password
if ([string]::IsNullOrWhiteSpace($bobKey)) {
  Write-Host "  -> No Bob key. USE_MOCK_BOB stays true." -ForegroundColor DarkGray
} else {
  $bobUrl   = Read-Host "BOB_API_URL"
  $bobModel = Read-Host "BOB_MODEL_ID (default bob-default)"
  if ([string]::IsNullOrWhiteSpace($bobModel)) { $bobModel = 'bob-default' }
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^BOB_API_KEY=.*$', "BOB_API_KEY=$bobKey", 'Multiline')
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^BOB_API_URL=.*$', "BOB_API_URL=$bobUrl", 'Multiline')
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^BOB_MODEL_ID=.*$', "BOB_MODEL_ID=$bobModel", 'Multiline')
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^USE_MOCK_BOB=.*$', 'USE_MOCK_BOB=false', 'Multiline')
  Write-Host "  -> Bob credentials written." -ForegroundColor Green
}

Write-Host ""
Write-Host "Anthropic API key (optional dev substitute, Enter to skip):" -ForegroundColor Yellow
$anthSecure = Read-Host "ANTHROPIC_API_KEY" -AsSecureString
$anthKey = [System.Net.NetworkCredential]::new('', $anthSecure).Password
if (-not [string]::IsNullOrWhiteSpace($anthKey)) {
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^ANTHROPIC_API_KEY=.*$', "ANTHROPIC_API_KEY=$anthKey", 'Multiline')
  Write-Host "  -> Anthropic key written." -ForegroundColor Green
}

Set-Content -Path $envFile -Value $content -NoNewline
Write-Host ""
Write-Host ".env populated. Next: docker compose up --build" -ForegroundColor Cyan
