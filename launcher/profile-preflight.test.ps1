# Exercises the real cold-start preflight; the Add-Type stub stops before any COM or port work.
$ErrorActionPreference = 'Stop'
Import-Module Microsoft.PowerShell.Utility
$family = 'OpenAI.Codex_2p2nqsd0c76g0'
$package = 'OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0'
$hash = 'CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6'
$appId = "$family!App"
$sourceLauncher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$logical = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Codex\web\Codex'
$cache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "Packages\$family\LocalCache\Roaming\Codex\web\Codex"
$exe = Join-Path $env:TEMP 'app\ChatGPT.exe'
$port = 63954
$created = Get-Date
$root = [pscustomobject]@{
    ProcessId = 41000; ParentProcessId = 1; CreationDate = $created; ExecutablePath = $exe
    CommandLine = "ChatGPT.exe --remote-debugging-port=$port"
}
$crashpad = [pscustomobject]@{
    ProcessId = 41001; ParentProcessId = 41000; CreationDate = $created.AddSeconds(1); ExecutablePath = $exe
    CommandLine = "ChatGPT.exe --type=crashpad-handler --user-data-dir=$cache"
}
$ordinaryRoot = [pscustomobject]@{
    ProcessId = 42000; ParentProcessId = 1; CreationDate = $created; ExecutablePath = $exe
    CommandLine = 'ChatGPT.exe'
}
$dedicatedMarker = [pscustomobject]@{
    MainPid = $root.ProcessId; MainCreated = $root.CreationDate.ToString('o'); Port = $port
}

function Get-AppxPackage {
    if ($mockPackageThrows) { throw 'Offline package query failure.' }
    if ($mockPackage) {
        [pscustomobject]@{
            Name = 'OpenAI.Codex'; PackageFullName = $mockPackage
            PackageFamilyName = $mockPackageFamilyName; PublisherId = $mockPublisherId
            SignatureKind = $mockSignatureKind; Status = 'Ok'; Architecture = 'X64'
            IsDevelopmentMode = $false; InstallLocation = $env:TEMP
        }
    }
}
function Get-AuthenticodeSignature { [pscustomobject]@{ Status = $mockSignatureStatus; SignerCertificate = [pscustomobject]@{ Subject = $mockSignerSubject } } }
function Get-CimInstance {
    if ($processSnapshots.Count) { return $processSnapshots.Dequeue() }
    return $mockProcesses
}
function Get-NetTCPConnection { return $mockListeners }
function Get-FileSha256 { $mockHash }
function Get-StartApps {
    if ($mockStartApp) { [pscustomobject]@{ AppID = $mockStartApp } }
}
function Test-Path($LiteralPath, $PathType) {
    if ($PathType -eq 'Leaf' -and [IO.File]::Exists($LiteralPath)) { return $true }
    return $LiteralPath -in $availableDirectories
}
function Add-Type {
    [void]$hits.Add('stopped-before-activation')
    throw 'Offline test: activation declaration intentionally blocked.'
}

$cases = @(
    @{
        Name = 'package query failure is recorded before any activation'
        PackageThrows = $true; ReachesBoundary = $false
        Expected = 'Codex package query failed'; ExpectedReceipt = 'package-query-failed'
    },
    @{
        Name = 'current package and daily profile reach activation boundary'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'updated Codex package and its executable reach activation boundary'
        Package = 'OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0'
        Hash = '21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82'
        StartApp = $appId; Directories = @($cache); ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'trusted known package no longer requires the older executable hash'
        Package = 'OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0'
        Hash = $hash; StartApp = $appId; Directories = @($cache)
        ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'trusted unlisted Codex package reaches activation boundary'
        Package = 'OpenAI.Codex_26.1118.4957.0_x64__2p2nqsd0c76g0'
        Hash = ('1' * 64); StartApp = $appId; Directories = @($cache); ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'unlisted Codex package with an untrusted signature stays on the original interface'
        Package = 'OpenAI.Codex_26.1118.4957.0_x64__2p2nqsd0c76g0'
        Hash = ('1' * 64); SignatureStatus = 'NotSigned'
        StartApp = $appId; Directories = @($cache); ReachesBoundary = $false
        Expected = 'Unsupported or untrusted Codex package'
        ExpectedReceipt = 'unsupported-package'
    },
    @{
        Name = 'current package accepts the logical daily profile path'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($logical); ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'untrusted package identity remains on the original interface'
        Package = 'OpenAI.Codex_26.1111.2229.0_x64__2p2nqsd0c76g0'; Hash = $hash
        PackageFamilyName = 'OpenAI.Codex_other'; StartApp = $appId
        Directories = @($cache); ReachesBoundary = $false; Expected = 'Unsupported or untrusted Codex package'
        ExpectedReceipt = 'unsupported-package'
    },
    @{
        Name = 'trusted executable hash drift enters compatibility probe'
        Package = $package; Hash = ('0' * 64); StartApp = $appId; Directories = @($cache)
        ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'
    },
    @{
        Name = 'missing app registration remains on the original interface'
        Package = $package; Hash = $hash; StartApp = $null; Directories = @($cache)
        ReachesBoundary = $false; Expected = 'Original executable or app registration did not match'
        ExpectedReceipt = 'executable-or-app-registration-mismatch'
    },
    @{
        Name = 'missing daily profile remains on the original interface'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @()
        ReachesBoundary = $false; Expected = 'Expected daily profile directory is missing'
        ExpectedReceipt = 'daily-profile-missing'
    },
    @{
        Name = 'multiple main processes remain on the original interface'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @(); ReachesBoundary = $false
        Expected = 'Multiple Codex main processes'
        ExpectedReceipt = 'multiple-main-processes'
        Processes = @(
            [pscustomobject]@{ ProcessId = 11; ParentProcessId = 1; CreationDate = Get-Date; CommandLine = ''; ExecutablePath = 'one.exe' },
            [pscustomobject]@{ ProcessId = 12; ParentProcessId = 1; CreationDate = Get-Date; CommandLine = ''; ExecutablePath = 'two.exe' }
        )
    },
    @{
        Name = 'ordinary running instance is rejected with a local receipt'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $false
        Expected = 'Codex is already running'; ExpectedReceipt = 'ordinary-instance-running'
        Processes = @($ordinaryRoot)
    },
    @{
        Name = 'unrecorded debug instance is reported as a conflict'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $false
        Expected = 'no matching dedicated-launch receipt'; ExpectedReceipt = 'unverified-running-instance'
        Processes = @($root, $crashpad); Listeners = @([pscustomobject]@{ LocalAddress = '127.0.0.1'; OwningProcess = 41000 })
    },
    @{
        Name = 'recorded dedicated instance without a live host is not reused'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $false
        Expected = 'no matching dedicated-launch receipt'; ExpectedReceipt = 'unverified-running-instance'
        Processes = @($root, $crashpad); Listeners = @([pscustomobject]@{ LocalAddress = '127.0.0.1'; OwningProcess = 41000 })
        Marker = $dedicatedMarker
    },
    @{
        Name = 'recorded dedicated running instance is reused without injection'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $false
        Expected = 'Dedicated Codex wallpaper instance is already running'; ExpectedReceipt = 'dedicated-instance-reused'
        Processes = @($root, $crashpad); Listeners = @([pscustomobject]@{ LocalAddress = '127.0.0.1'; OwningProcess = 41000 })
        Marker = $dedicatedMarker; HostReady = $true
    },
    @{
        Name = 'one launch reaches the activation boundary after the dedicated instance exits'
        Package = $package; Hash = $hash; StartApp = $appId; Directories = @($cache); ReachesBoundary = $true
        ExpectedReceipt = 'launch-or-check-error'; Exiting = $true
        Listeners = @([pscustomobject]@{ LocalAddress = '127.0.0.1'; OwningProcess = 41000 })
        Marker = $dedicatedMarker; HostReady = $true
    }
)

$receiptBase = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-receipts-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($receiptBase)
# Keep an already-running launcher from holding the mutex used by this offline fixture.
$launcher = Join-Path $receiptBase 'Start-CodexWallpaper.ps1'
$fixtureMutex = 'Local\' + (Split-Path -Leaf $receiptBase)
$source = [IO.File]::ReadAllText($sourceLauncher).Replace('Local\CodexWallpaper.P0b', $fixtureMutex)
[IO.File]::WriteAllText($launcher, $source, [Text.UTF8Encoding]::new($true))
foreach ($case in $cases) {
    $hits = [Collections.Generic.List[string]]::new()
    $mockPackage = $case.Package
    $mockPackageThrows = [bool]$case.PackageThrows
    $mockHash = $case.Hash
    $mockStartApp = $case.StartApp
    $mockPackageFamilyName = if ($case.PackageFamilyName) { $case.PackageFamilyName } else { $family }
    $mockPublisherId = '2p2nqsd0c76g0'
    $mockSignatureKind = 'Store'
    $mockSignatureStatus = if ($case.SignatureStatus) { $case.SignatureStatus } else { 'Valid' }
    $mockSignerSubject = 'CN="OpenAI OpCo, LLC", O="OpenAI OpCo, LLC"'
    $mockProcesses = @($case.Processes | Where-Object { $null -ne $_ })
    $processSnapshots = [Collections.Generic.Queue[object]]::new()
    if ($case.Exiting) {
        $processSnapshots.Enqueue(@($root, $crashpad))
        $processSnapshots.Enqueue(@($root, $crashpad))
    }
    $mockListeners = @($case.Listeners | Where-Object { $null -ne $_ })
    $availableDirectories = $case.Directories
    $caseReceipt = Join-Path $receiptBase ([guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($caseReceipt)
    if ($case.Marker) {
        [IO.File]::WriteAllText(
            (Join-Path $caseReceipt 'dedicated-session.json'),
            ($case.Marker | ConvertTo-Json -Depth 3),
            [Text.UTF8Encoding]::new($false)
        )
    }
    $hostLock = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-host-{0}.lock' -f $port)
    Remove-Item -LiteralPath $hostLock -Force -ErrorAction SilentlyContinue
    try {
        if ($case.HostReady) {
            [IO.File]::WriteAllText($hostLock, [string]$PID, [Text.UTF8Encoding]::new($false))
        }
        $output = (& $launcher -Launch -Unattended -ReceiptRoot $caseReceipt 6>&1 | Out-String).Trim()
    } finally {
        Remove-Item -LiteralPath $hostLock -Force -ErrorAction SilentlyContinue
    }
    if (($hits.Count -eq 1) -ne $case.ReachesBoundary -or
        (-not $case.ReachesBoundary -and $output -notmatch [regex]::Escape($case.Expected))) {
        throw "Failed: $($case.Name). Output: $output $($Error[0].InvocationInfo.PositionMessage)"
    }
    $files = @(Get-ChildItem -LiteralPath $caseReceipt -Filter '*.json' -File |
        Where-Object Name -match '^\d{8}-\d{6}-[0-9a-f]+\.json$')
    if ($files.Count -ne 1) { throw "Failed: $($case.Name) did not write exactly one receipt." }
    $receipt = Get-Content -Raw -LiteralPath $files[0].FullName | ConvertFrom-Json
    if ($receipt.Outcome -ne $case.ExpectedReceipt) {
        throw "Failed: $($case.Name) receipt outcome was $($receipt.Outcome)."
    }
    if ($receipt.Mode -ne 'unattended-startup') {
        throw "Failed: $($case.Name) lost unattended mode in the receipt."
    }
    Write-Host "Passed: $($case.Name)"
}
$resolvedReceiptBase = (Resolve-Path -LiteralPath $receiptBase).Path
if ($resolvedReceiptBase -eq [IO.Path]::GetFullPath($receiptBase)) {
    Remove-Item -LiteralPath $resolvedReceiptBase -Recurse -Force
}
