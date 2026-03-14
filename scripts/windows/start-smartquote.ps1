$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$runtimeDir = Join-Path $scriptDir 'runtime'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$frontendPidFile = Join-Path $runtimeDir 'frontend.pid'
$frontendPortFile = Join-Path $runtimeDir 'frontend.port'

$backendPort = 5001
$frontendBasePort = 5174
$frontendPortMax = 5194

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Test-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url
  )

  try {
    Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2 | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Wait-Url {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 60
  )

  for ($index = 0; $index -lt $TimeoutSeconds; $index++) {
    if (Test-Url -Url $Url) {
      return $true
    }
    Start-Sleep -Seconds 1
  }

  return $false
}

function Get-StoredPid {
  param(
    [Parameter(Mandatory = $true)][string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    return $null
  }

  $pidText = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pidText) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  try {
    $pidValue = [int]$pidText
  }
  catch {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if (-not $process) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  return $pidValue
}

function Start-ManagedPowerShell {
  param(
    [Parameter(Mandatory = $true)][string]$WindowTitle,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$PidFile
  )

  $existingPid = Get-StoredPid -PidFile $PidFile
  if ($existingPid) {
    return $existingPid
  }

  $escapedRoot = $rootDir.Replace("'", "''")
  $escapedTitle = $WindowTitle.Replace("'", "''")
  $commandText = "Set-Location -LiteralPath '$escapedRoot'; `$Host.UI.RawUI.WindowTitle = '$escapedTitle'; $Command"

  $process = Start-Process -FilePath 'powershell.exe' -WorkingDirectory $rootDir -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $commandText) -PassThru
  Set-Content -Path $PidFile -Value $process.Id -Encoding ascii
  return $process.Id
}

function Get-FirstFreePort {
  param(
    [int]$StartPort,
    [int]$EndPort
  )

  for ($port = $StartPort; $port -le $EndPort; $port++) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $listener) {
      return $port
    }
  }

  throw "No free frontend port found in range $StartPort-$EndPort."
}

function Get-ChromePath {
  $candidates = New-Object System.Collections.Generic.List[string]

  if ($env:SMARTQUOTE_CHROME_PATH -and (Test-Path $env:SMARTQUOTE_CHROME_PATH)) {
    $candidates.Add($env:SMARTQUOTE_CHROME_PATH)
  }

  foreach ($registryPath in @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe'
  )) {
    try {
      $registryValue = (Get-ItemProperty -Path $registryPath -ErrorAction Stop).'(default)'
      if ($registryValue -and (Test-Path $registryValue)) {
        $candidates.Add($registryValue)
      }
    }
    catch {
    }
  }

  foreach ($commandName in @('chrome.exe', 'chrome')) {
    try {
      $command = Get-Command $commandName -ErrorAction Stop
      if ($command.Path -and (Test-Path $command.Path)) {
        $candidates.Add($command.Path)
      }
    }
    catch {
    }
  }

  foreach ($path in @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LocalAppData 'Google\Chrome\Application\chrome.exe')
  )) {
    if ($path -and (Test-Path $path)) {
      $candidates.Add($path)
    }
  }

  $uniqueCandidates = @($candidates | Select-Object -Unique)
  if ($uniqueCandidates.Count -gt 0) {
    return ($uniqueCandidates | Select-Object -First 1)
  }

  return $null
}

$viteBin = Join-Path $rootDir 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteBin)) {
  throw 'Missing node_modules\vite\bin\vite.js. Run npm install in the project root first.'
}

$backendHealthUrl = "http://127.0.0.1:$backendPort/api/health"
if (Test-Url -Url $backendHealthUrl) {
  Write-Host "Backend already running on port $backendPort. Reusing it." -ForegroundColor Yellow
}
else {
  $backendOccupied = Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue
  if ($backendOccupied) {
    throw "Port $backendPort is occupied by another process and the SmartQuote health check failed."
  }

  $backendPid = Start-ManagedPowerShell -WindowTitle 'SmartQuote Backend' -Command 'node server.js' -PidFile $backendPidFile
  Write-Host "Backend started. PID: $backendPid" -ForegroundColor Green

  if (-not (Wait-Url -Url $backendHealthUrl -TimeoutSeconds 60)) {
    throw 'Backend startup timed out. Check the SmartQuote Backend window.'
  }
}

$frontendUrl = $null
$storedFrontendPid = Get-StoredPid -PidFile $frontendPidFile
if ($storedFrontendPid -and (Test-Path $frontendPortFile)) {
  $storedPort = Get-Content $frontendPortFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($storedPort) {
    $candidateUrl = "http://127.0.0.1:$storedPort/"
    if (Test-Url -Url $candidateUrl) {
      $frontendUrl = $candidateUrl
      Write-Host "Frontend already running on port $storedPort. Reusing it." -ForegroundColor Yellow
    }
  }
}

if (-not $frontendUrl) {
  $frontendPort = Get-FirstFreePort -StartPort $frontendBasePort -EndPort $frontendPortMax
  $frontendCommand = "node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port $frontendPort --strictPort"
  $frontendPid = Start-ManagedPowerShell -WindowTitle 'SmartQuote Frontend' -Command $frontendCommand -PidFile $frontendPidFile
  Set-Content -Path $frontendPortFile -Value $frontendPort -Encoding ascii
  Write-Host "Frontend started. PID: $frontendPid. Port: $frontendPort" -ForegroundColor Green

  $frontendUrl = "http://127.0.0.1:$frontendPort/"
  if (-not (Wait-Url -Url $frontendUrl -TimeoutSeconds 60)) {
    throw 'Frontend startup timed out. Check the SmartQuote Frontend window.'
  }
}

$chromePath = Get-ChromePath
if ($chromePath) {
  $resolvedChromePath = (Resolve-Path $chromePath).Path
  Start-Process -FilePath $resolvedChromePath -ArgumentList @('--new-window', $frontendUrl) | Out-Null
  Write-Host "Opened in Chrome: $frontendUrl" -ForegroundColor Green
}
else {
  try {
    Start-Process -FilePath 'chrome.exe' -ArgumentList @('--new-window', $frontendUrl) -ErrorAction Stop | Out-Null
    Write-Host "Opened in Chrome via PATH: $frontendUrl" -ForegroundColor Green
  }
  catch {
    Start-Process $frontendUrl | Out-Null
    Write-Host "Chrome not found. Opened with the default browser: $frontendUrl" -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host 'SmartQuote is ready.' -ForegroundColor Cyan
Write-Host "Frontend: $frontendUrl"
Write-Host "Backend: http://127.0.0.1:$backendPort"