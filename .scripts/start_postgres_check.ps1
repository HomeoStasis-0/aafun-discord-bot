# Check for Postgres services and start any that are stopped
$found = Get-Service | Where-Object { $_.Name -like '*postgres*' -or $_.DisplayName -like '*postgres*' }
if (-not $found) {
  Write-Output "NO_SERVICE_FOUND"
  exit 0
}

# Show found services
foreach ($svc in $found) {
  $svc | Format-List Name,DisplayName,Status
}

# Start any that are not running
foreach ($svc in $found) {
  if ($svc.Status -ne 'Running') {
    try {
      Start-Service -Name $svc.Name -ErrorAction Stop
      Start-Sleep -Seconds 1
      Get-Service -Name $svc.Name | Format-List Name,DisplayName,Status
    } catch {
      Write-Output "FAILED_TO_START:$($svc.Name):$($_.Exception.Message)"
    }
  }
}
