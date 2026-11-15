# Exercises the real cold-start preflight; the Add-Type stub stops before any COM or port work.
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
$family = 'OpenAI.Codex_2p2nqsd0c76g0'
$package = 'OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0'
$hash = 'CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6'
$appId = "$family!App"
$launcher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$logical = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Codex\web\Codex'
$cache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "Packages\$family\LocalCache\Roaming\Codex\web\Codex"

function Get-AppxPackage {
    if ($mockPackage) {
        [pscustomobject]@{ PackageFullName = $mockPackage; PackageFamilyName = $family; InstallLocation = $env:TEMP }
    }
}
function Get-CimInstance { return $mockProcesses }
function Get-FileHash { @{ Hash = $mockHash } }
function Get-StartApps {
    if ($mockStartApp) { [pscustomobject]@{ AppID = $mockStartApp } }
}
function Test-Path($LiteralPath, $PathType) { return $LiteralPath -in $availableDirectories }
function Add-Type {
    [void]$hits.Add('stopped-before-activation')
    throw 'Offline test: activation declaration intentionally blocked.'
}

$cases = @(
    @{
        Name = 'current package and daily profile reach activation boundary'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $true
    },
    @{
        Name = 'current package accepts the logical daily profile path'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($logical); ReachesBoundary = $true
    },
    @{
        Name = 'unknown package remains on the original interface'
        Package = 'OpenAI.Codex_26.1111.2229.0_x64__2p2nqsd0c76g0'; Hash = $hash; StartApp = $appId
        Directories = @($cache); ReachesBoundary = $false; Expected = 'Unsupported or ambiguous Codex package'
    },
    @{
        Name = 'executable hash drift remains on the original interface'
        Package = $package; Hash = ('0' * 64); StartApp = $appId; Directories = @($cache)
        ReachesBoundary = $false; Expected = 'Original executable or app registration did not match'
    },
    @{
        Name = 'missing app registration remains on the original interface'
        Package = $package; Hash = $hash; StartApp = $null; Directories = @($cache)
        ReachesBoundary = $false; Expected = 'Original executable or app registration did not match'
    },
    @{
        Name = 'missing daily profile remains on the original interface'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @()
        ReachesBoundary = $false; Expected = 'Expected daily profile directory is missing'
    },
    @{
        Name = 'multiple main processes remain on the original interface'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @(); ReachesBoundary = $false
        Expected = 'Multiple Codex main processes'
        Processes = @(
            [pscustomobject]@{ ProcessId = 11; ParentProcessId = 1; CreationDate = Get-Date; CommandLine = ''; ExecutablePath = 'one.exe' },
            [pscustomobject]@{ ProcessId = 12; ParentProcessId = 1; CreationDate = Get-Date; CommandLine = ''; ExecutablePath = 'two.exe' }
        )
    }
)

foreach ($case in $cases) {
    $hits = [Collections.Generic.List[string]]::new()
    $mockPackage = $case.Package
    $mockHash = $case.Hash
    $mockStartApp = $case.StartApp
    $mockProcesses = @($case.Processes | Where-Object { $null -ne $_ })
    $availableDirectories = $case.Directories
    $output = (& $launcher -Launch 6>&1 | Out-String).Trim()
    if (($hits.Count -eq 1) -ne $case.ReachesBoundary -or
        (-not $case.ReachesBoundary -and $output -notmatch [regex]::Escape($case.Expected))) {
        throw "Failed: $($case.Name). Output: $output $($Error[0].InvocationInfo.PositionMessage)"
    }
    Write-Host "Passed: $($case.Name)"
}
