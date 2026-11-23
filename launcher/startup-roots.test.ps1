# Load only the process classification functions from the actual launcher, never its entry point.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$tokens = $null
$errorsFound = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$errorsFound)
if ($errorsFound) { throw ($errorsFound | Out-String) }
foreach ($name in @('Get-CodexRoots', 'Get-StartupRootState', 'Test-DailyProfile', 'Test-LoopbackOwner', 'Test-WallpaperHost', 'Get-DedicatedRootState', 'Get-RecoverableRootState')) {
    $definition = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
    if (-not $definition) { throw "Missing launcher function: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}

$exe = 'C:\Program Files\WindowsApps\fixture\app\ChatGPT.exe'
$port = 63954
$created = [datetime]'2026-11-12T17:56:31.5212590'
function New-ProcessFixture($ProcessId, $Parent, $Arguments) {
    [pscustomobject]@{ ProcessId = $ProcessId; ParentProcessId = $Parent; CreationDate = $created; ExecutablePath = $exe; CommandLine = $Arguments }
}
$main = New-ProcessFixture 26324 2000 "ChatGPT.exe --remote-debugging-port=$port"
$other = New-ProcessFixture 40000 2000 'ChatGPT.exe'
$renderer = New-ProcessFixture 40001 26324 'ChatGPT.exe --type=renderer'
$unreadable = New-ProcessFixture 40002 26324 $null

function Assert-Outcome($Actual, $Expected) {
    if ($Actual -ne $Expected) { throw "Expected $Expected; observed $Actual" }
}

$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
$hostLockScript = Join-Path $PSScriptRoot 'host-lock.mjs'
function Write-HostLockRecord($File, $OwnerPid, $CreatedAt, $LockPort) {
    $record = [ordered]@{ version = 1; pid = [int]$OwnerPid; createdAt = [string]$CreatedAt; port = [int]$LockPort }
    [IO.File]::WriteAllText($File, ($record | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
}
function Get-HostLockCheck($Port, $Folder) {
    $raw = & $node --no-use-env-proxy $hostLockScript check --port ([string]$Port) --lock-folder $Folder 2>&1
    if ($LASTEXITCODE -ne 0) { throw "host-lock check failed: $raw" }
    return (($raw | Out-String).Trim() | ConvertFrom-Json)
}
function Assert-HostLockAgreement($Port, $Folder, $ExpectedValid, $ExpectedState) {
    $check = Get-HostLockCheck $Port $Folder
    $powershellValid = Test-WallpaperHost $Port $Folder
    if ($powershellValid -ne $ExpectedValid) {
        throw "PowerShell lock result $powershellValid did not match $ExpectedValid. CLI: $($check | ConvertTo-Json -Compress)"
    }
    Assert-Outcome $check.valid $ExpectedValid
    Assert-Outcome $check.state $ExpectedState
}

$state = @{ Timeline = [Collections.Generic.List[object]]::new() }
Assert-Outcome (Get-StartupRootState @($main, $renderer) $state 0).Outcome 'single'
Assert-Outcome (Get-StartupRootState @($main, $other, $renderer) $state 300).Outcome 'ambiguous'
Assert-Outcome (Get-StartupRootState @($main, $renderer) $state 600).Outcome 'single'
Assert-Outcome $state.Timeline[1].Candidates[1].Pid 40000
Assert-Outcome $state.Timeline[1].Candidates[1].ParentPid 2000
Assert-Outcome (Get-StartupRootState @($main, $unreadable) $state 3100).Outcome 'ambiguous'
Assert-Outcome $state.Timeline[3].Candidates[1].CommandLineReadable $false
Write-Host 'Passed: a transient second candidate does not abort startup.'

$state = @{ Timeline = [Collections.Generic.List[object]]::new() }
Assert-Outcome (Get-StartupRootState @($main, $other) $state 0).Outcome 'ambiguous'
Assert-Outcome (Get-StartupRootState @($main, $other) $state 2900).Outcome 'ambiguous'
Assert-Outcome (Get-StartupRootState @($main, $other) $state 3000).Outcome 'multiple-main-processes'
Write-Host 'Passed: sustained ambiguity still blocks the probe.'

$profile = 'C:\fixture\daily-profile'
$nativeProfile = $profile
$crashpad = New-ProcessFixture 26325 26324 "ChatGPT.exe --type=crashpad-handler --user-data-dir=$profile"
$listenerOwner = 26324
function Get-NetTCPConnection { [pscustomobject]@{ LocalAddress = '127.0.0.1'; OwningProcess = $listenerOwner } }
$marker = [pscustomobject]@{ MainPid = 26324; MainCreated = $created.ToString('o'); Port = $port }
$hostFolder = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-roots-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($hostFolder)
$hostLock = Join-Path $hostFolder ('codex-wallpaper-host-{0}.lock' -f $port)
$currentCreatedAt = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o')
try {
    Write-HostLockRecord $hostLock $PID $currentCreatedAt $port
    Assert-HostLockAgreement $port $hostFolder $true 'held'

    $dedicated = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker $hostFolder
    Assert-Outcome $dedicated.State 'dedicated'
    Assert-Outcome $dedicated.Port $port
    Assert-Outcome $dedicated.Root.ProcessId 26324

    Write-HostLockRecord $hostLock $PID '2000-01-01T00:00:00.0000000Z' $port
    Assert-HostLockAgreement $port $hostFolder $false 'stale'

    Remove-Item -LiteralPath $hostLock
    Assert-HostLockAgreement $port $hostFolder $false 'missing'
    $missingHost = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker $hostFolder
    Assert-Outcome $missingHost.State 'unknown'

    $exited = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList '/c','exit','0' -PassThru -WindowStyle Hidden
    $exitedPid = $exited.Id
    $exited.WaitForExit()
    $exited.Dispose()
    Write-HostLockRecord $hostLock $exitedPid '2000-01-01T00:00:00.0000000Z' $port
    Assert-HostLockAgreement $port $hostFolder $false 'stale'
    $staleHost = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker $hostFolder
    Assert-Outcome $staleHost.State 'unknown'

    [IO.File]::WriteAllText($hostLock, '{not-json', [Text.UTF8Encoding]::new($false))
    Assert-HostLockAgreement $port $hostFolder $false 'corrupt'
} finally {
    Remove-Item -LiteralPath $hostFolder -Recurse -Force -ErrorAction SilentlyContinue
}

$listenerOwner = 40000
$ordinary = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker
Assert-Outcome $ordinary.State 'unknown'
$unrecorded = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $null
Assert-Outcome $unrecorded.State 'unknown'
Write-Host 'Passed: reuse requires a matching successful-session marker and loopback ownership.'

$receiptFolder = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-recovery-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($receiptFolder)
$listenerOwner = 26324
try {
    $failedReceipt = Join-Path $receiptFolder '20261120-115130-recovery.json'
    [ordered]@{
        Outcome = 'wallpaper-injection-failed'
        TargetVerified = $true
        MainPid = 26324
        MainCreated = $created.ToString('o')
        Port = $port
    } | ConvertTo-Json | Set-Content -LiteralPath $failedReceipt -Encoding utf8
    $recoverable = Get-RecoverableRootState @($main) @($main, $crashpad) $exe $receiptFolder $hostFolder
    Assert-Outcome $recoverable.State 'recoverable'
    Assert-Outcome $recoverable.Port $port
    Assert-Outcome $recoverable.Root.ProcessId 26324

    [ordered]@{
        Outcome = 'wallpaper-injection-failed'
        TargetVerified = $true
        MainPid = 26324
        MainCreated = $created.AddSeconds(-1).ToString('o')
        Port = $port
    } | ConvertTo-Json | Set-Content -LiteralPath $failedReceipt -Encoding utf8
    $mismatched = Get-RecoverableRootState @($main) @($main, $crashpad) $exe $receiptFolder $hostFolder
    Assert-Outcome $mismatched.State 'unknown'

    $failedReceipt = Join-Path $receiptFolder '20261120-115131-ready.json'
    [ordered]@{
        Outcome = 'wallpaper-ready'
        TargetVerified = $true
        MainPid = 26324
        MainCreated = $created.ToString('o')
        Port = $port
    } | ConvertTo-Json | Set-Content -LiteralPath $failedReceipt -Encoding utf8
    $readyOnly = Get-RecoverableRootState @($main) @($main, $crashpad) $exe $receiptFolder $hostFolder
    Assert-Outcome $readyOnly.State 'recoverable'

    $failedReceipt = Join-Path $receiptFolder '20261120-115132-failed.json'
    [ordered]@{
        Outcome = 'wallpaper-injection-failed'
        TargetVerified = $true
        MainPid = 26324
        MainCreated = $created.ToString('o')
        Port = $port
    } | ConvertTo-Json | Set-Content -LiteralPath $failedReceipt -Encoding utf8
    $liveHostLock = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-host-{0}.lock' -f $port)
    try {
        Write-HostLockRecord $liveHostLock $PID $currentCreatedAt $port
        $liveHost = Get-RecoverableRootState @($main) @($main, $crashpad) $exe $receiptFolder
        Assert-Outcome $liveHost.State 'unknown'
        $held = [IO.File]::Open($liveHostLock, 'Open', 'ReadWrite', 'None')
        try {
            Assert-Outcome (Test-WallpaperHost $port) $true
        } finally {
            $held.Dispose()
        }
    } finally {
        Remove-Item -LiteralPath $liveHostLock -Force -ErrorAction SilentlyContinue
    }
} finally {
    Remove-Item -LiteralPath $receiptFolder -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host 'Passed: recovery requires an exact launch receipt and no live host.'
