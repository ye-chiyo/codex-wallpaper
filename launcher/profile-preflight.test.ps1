# Exercises the real cold-start preflight; the Add-Type stub stops before any COM or port work.
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
$family = 'OpenAI.Codex_2p2nqsd0c76g0'
$launcher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$logical = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Codex\web\Codex'
$cache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "Packages\$family\LocalCache\Roaming\Codex\web\Codex"

function Get-AppxPackage {
    [pscustomobject]@{ PackageFullName = 'OpenAI.Codex_26.1106.6628.0_x64__2p2nqsd0c76g0'; PackageFamilyName = $family; InstallLocation = $env:TEMP }
}
function Get-CimInstance {}
function Get-FileHash { @{ Hash = 'd2c25e7739221d80f0bd0a64f2f2cb0671630073bc9e9a6ab47868103635a83c' } }
function Get-StartApps { [pscustomobject]@{ AppID = "$family!App" } }
function Test-Path($LiteralPath, $PathType) { return $LiteralPath -in $availableDirectories }
function Add-Type {
    [void]$hits.Add('stopped-before-activation')
    throw 'Offline test: activation declaration intentionally blocked.'
}

foreach ($case in @(
    @{ Name = 'existing per-package LocalCache only'; Directories = @($cache); ReachesBoundary = $true },
    @{ Name = 'existing logical directory only'; Directories = @($logical); ReachesBoundary = $true },
    @{ Name = 'both missing'; Directories = @(); ReachesBoundary = $false }
)) {
    $hits = [Collections.Generic.List[string]]::new()
    $availableDirectories = $case.Directories
    $output = (& $launcher -Launch 6>&1 | Out-String).Trim()
    if (($hits.Count -eq 1) -ne $case.ReachesBoundary -or
        (-not $case.ReachesBoundary -and $output -notmatch 'Expected daily profile directory is missing')) {
        throw "Failed: $($case.Name). Output: $output $($Error[0].InvocationInfo.PositionMessage)"
    }
    Write-Host "Passed: $($case.Name)"
}
