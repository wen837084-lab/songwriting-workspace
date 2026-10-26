param(
  [Parameter(Mandatory = $true)]
  [string]$BaselineInstaller,

  [Parameter(Mandatory = $true)]
  [string]$UpgradeInstaller,

  [Parameter(Mandatory = $true)]
  [version]$BaselineVersion,

  [Parameter(Mandatory = $true)]
  [version]$UpgradeVersion,

  [string]$ReportPath = "C:\Users\Public\SongwritingWorkspacePackagingVerification.json"
)

$ErrorActionPreference = "Stop"
$productName = "Songwriting Workspace"
$identifier = "com.songwritingworkspace.desktop"
$processName = "songwriting-workspace"
$baselinePath = (Resolve-Path -LiteralPath $BaselineInstaller).Path
$upgradePath = (Resolve-Path -LiteralPath $UpgradeInstaller).Path
$localAppDataPath = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA)
$dataPath = [System.IO.Path]::GetFullPath((Join-Path $localAppDataPath $identifier))
$markerPath = Join-Path $dataPath "packaging-verification.marker"
$markerValue = "Songwriting Workspace packaging verification $([guid]::NewGuid())"
$markerCreated = $false
$installedByThisScript = $false
$checks = [ordered]@{}

if ($env:OS -ne "Windows_NT") {
  throw "Windows installer verification can only run on Windows."
}

if ($BaselineVersion -ge $UpgradeVersion) {
  throw "BaselineVersion must be lower than UpgradeVersion."
}

if (-not $dataPath.StartsWith($localAppDataPath + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use an application data path outside LOCALAPPDATA."
}

function Get-ProductEntry {
  $registryPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
  )

  return Get-ItemProperty -Path $registryPaths -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq $productName } |
    Select-Object -First 1
}

function Invoke-Installer([string]$Path) {
  $process = Start-Process -FilePath $Path -ArgumentList "/S" -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Installer failed with exit code $($process.ExitCode): $Path"
  }
}

function Get-InstalledExecutable($Entry) {
  if ($Entry.InstallLocation) {
    $installLocation = ([string]$Entry.InstallLocation).Trim().Trim('"')
    $candidate = Join-Path $installLocation "$processName.exe"
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  if ($Entry.DisplayIcon) {
    $candidate = $Entry.DisplayIcon.Trim('"').Split(",")[0]
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "The installed application executable could not be located."
}

function Assert-InstalledVersion([version]$ExpectedVersion) {
  $entry = Get-ProductEntry
  if (-not $entry) {
    throw "$productName is not registered as installed."
  }

  if ([version]$entry.DisplayVersion -ne $ExpectedVersion) {
    throw "Expected installed version $ExpectedVersion but found $($entry.DisplayVersion)."
  }

  $executable = Get-InstalledExecutable $entry
  return [pscustomobject]@{ Entry = $entry; Executable = $executable }
}

function Invoke-AppSmokeTest([string]$Executable) {
  $process = Start-Process -FilePath $Executable -PassThru
  try {
    $null = $process.WaitForInputIdle(15000)
    Start-Sleep -Seconds 2
    $process.Refresh()
    if ($process.HasExited) {
      throw "Installed application exited during its smoke test."
    }
    if (-not $process.Responding) {
      throw "Installed application did not become responsive."
    }
  }
  finally {
    if (-not $process.HasExited) {
      $null = $process.CloseMainWindow()
      if (-not $process.WaitForExit(10000)) {
        throw "Installed application did not close normally after its smoke test."
      }
    }
  }
}

function Invoke-Uninstall {
  $entry = Get-ProductEntry
  if (-not $entry) {
    return
  }

  $uninstaller = if ($entry.InstallLocation) {
    $installLocation = ([string]$entry.InstallLocation).Trim().Trim('"')
    Join-Path $installLocation "uninstall.exe"
  }

  if (-not $uninstaller -or -not (Test-Path -LiteralPath $uninstaller)) {
    $match = [regex]::Match([string]$entry.UninstallString, '^"(?<path>[^"]+)"')
    if ($match.Success) {
      $uninstaller = $match.Groups["path"].Value
    }
  }

  if (-not $uninstaller -or -not (Test-Path -LiteralPath $uninstaller)) {
    throw "The NSIS uninstaller could not be located."
  }

  $process = Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Uninstaller failed with exit code $($process.ExitCode)."
  }

  Start-Sleep -Seconds 2
}

try {
  if (Get-ProductEntry) {
    throw "$productName is already installed. Uninstall it before running the clean-install verification."
  }

  $checks.cleanStart = $true
  Invoke-Installer $baselinePath
  $installedByThisScript = $true
  $baseline = Assert-InstalledVersion $BaselineVersion
  Invoke-AppSmokeTest $baseline.Executable
  $checks.cleanInstall = $true

  New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
  Set-Content -LiteralPath $markerPath -Value $markerValue -NoNewline
  $markerCreated = $true

  Invoke-Installer $upgradePath
  $upgrade = Assert-InstalledVersion $UpgradeVersion
  if ((Get-Content -Raw -LiteralPath $markerPath) -ne $markerValue) {
    throw "Application data marker changed during upgrade."
  }
  Invoke-AppSmokeTest $upgrade.Executable
  $checks.upgrade = $true
  $checks.dataRetainedAfterUpgrade = $true

  Invoke-Uninstall
  $installedByThisScript = $false
  if (Get-ProductEntry) {
    throw "$productName remains registered after uninstall."
  }
  if (Test-Path -LiteralPath $upgrade.Executable) {
    throw "Installed executable remains after uninstall: $($upgrade.Executable)"
  }
  if ((Get-Content -Raw -LiteralPath $markerPath) -ne $markerValue) {
    throw "Application data marker was removed or changed during uninstall."
  }
  $checks.uninstall = $true
  $checks.dataRetainedAfterUninstall = $true

  $report = [ordered]@{
    product = $productName
    baselineVersion = $BaselineVersion.ToString()
    upgradeVersion = $UpgradeVersion.ToString()
    baselineInstaller = $baselinePath
    upgradeInstaller = $upgradePath
    dataPath = $dataPath
    verifiedAt = (Get-Date).ToString("o")
    checks = $checks
  }
  $report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ReportPath -Encoding utf8
  Write-Output "Windows installation lifecycle verification passed."
  Write-Output "Report: $ReportPath"
}
finally {
  if ($installedByThisScript) {
    Invoke-Uninstall
  }
  if ($markerCreated -and (Test-Path -LiteralPath $markerPath)) {
    Remove-Item -LiteralPath $markerPath -Force
  }
}
