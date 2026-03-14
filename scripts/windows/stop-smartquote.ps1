$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $scriptDir 'runtime'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$frontendPidFile = Join-Path $runtimeDir 'frontend.pid'
$frontendPortFile = Join-Path $runtimeDir 'frontend.port'

function Stop-ManagedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$PidFile,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host "$Label PID file not found. Skipping." -ForegroundColor Yellow
    return
  }

  $pidText = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue

  if (-not $pidText) {
    Write-Host "$Label PID file was empty. Cleaned up." -ForegroundColor Yellow
    return
  }

  try {
    $pidValue = [int]$pidText
  }
  catch {
    Write-Host "$Label PID value was invalid. Cleaned up." -ForegroundColor Yellow
    return
  }

  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if (-not $process) {
    Write-Host "$Label process already exited." -ForegroundColor Yellow
    return
  }

  cmd /c "taskkill /PID $pidValue /T /F" | Out-Null
  Write-Host "$Label stopped. PID: $pidValue" -ForegroundColor Green
}

Stop-ManagedProcess -PidFile $backendPidFile -Label 'Backend'
Stop-ManagedProcess -PidFile $frontendPidFile -Label 'Frontend'

Remove-Item $frontendPortFile -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Managed SmartQuote processes have been handled.' -ForegroundColor Cyan