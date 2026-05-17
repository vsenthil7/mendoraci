$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$envBob = Get-Content "C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci\.env.bob"
$apiKey = $null
foreach ($line in $envBob) {
  $clean = $line -replace "^\xEF\xBB\xBF", ""
  if ($clean -match '^BOB_API_KEY=(.+)$') { $apiKey = $Matches[1]; break }
}

Write-Host "Key length: $($apiKey.Length)"
Write-Host "Key prefix: $($apiKey.Substring(0, [Math]::Min(20, $apiKey.Length)))"
Write-Host ""

# Try IAM exchange
$body = @{ grant_type = "urn:ibm:params:oauth:grant-type:apikey"; apikey = $apiKey }
try {
  $r = Invoke-RestMethod -Method Post -Uri "https://iam.cloud.ibm.com/identity/token" `
    -Headers @{ "Accept" = "application/json" } `
    -ContentType "application/x-www-form-urlencoded" -Body $body
  Write-Host "IAM SUCCESS - token length $($r.access_token.Length)" -ForegroundColor Green
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Host "IAM FAIL HTTP $($resp.StatusCode.value__)" -ForegroundColor Red
    try {
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $bodyText = $sr.ReadToEnd()
      Write-Host "Body: $bodyText" -ForegroundColor Red
    } catch {}
  } else {
    Write-Host "Network error: $($_.Exception.Message)" -ForegroundColor Red
  }
}
