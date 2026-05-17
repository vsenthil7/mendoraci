$report = 'C:\Users\v_sen\Documents\Projects\0008_AT_Hack0020_MendoraCI_IBM_Bob\mendoraci\playwright-report\index.html'
$h = Get-Content $report -Raw
# Look for both possible payload locations
$summaryMatch = $h -match 'stats.*?duration'
Write-Host "File size: $($h.Length)"

# Try to extract counts directly from the JSON embedded summary
$patterns = @(
  'expected"\s*:\s*(\d+)',
  'unexpected"\s*:\s*(\d+)',
  'flaky"\s*:\s*(\d+)',
  'skipped"\s*:\s*(\d+)',
  'duration"\s*:\s*(\d+)'
)
foreach ($p in $patterns) {
  $found = [regex]::Matches($h, $p)
  if ($found.Count -gt 0) {
    $label = ($p -split '"')[0]
    Write-Host "$label : $($found[0].Groups[1].Value)"
  }
}

# Also try to find failure titles
$failTitles = [regex]::Matches($h, '"title":"([^"]+)","status":"failed"')
if ($failTitles.Count -gt 0) {
  Write-Host ""
  Write-Host "Failed tests (first 20):"
  $failTitles | Select-Object -First 20 | ForEach-Object { Write-Host "  - $($_.Groups[1].Value)" }
}

# And passing ones
$passTitles = [regex]::Matches($h, '"title":"([^"]+)","status":"passed"')
Write-Host ""
Write-Host "Passed tests count: $($passTitles.Count)"
