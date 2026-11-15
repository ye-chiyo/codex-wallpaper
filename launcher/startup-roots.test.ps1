# Load only the process classification functions from the actual launcher, never its entry point.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$tokens = $null
$errorsFound = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$errorsFound)
if ($errorsFound) { throw ($errorsFound | Out-String) }
foreach ($name in @('Get-CodexRoots', 'Get-StartupRootState', 'Test-DailyProfile', 'Test-LoopbackOwner', 'Get-DedicatedRootState')) {
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
$dedicated = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker
Assert-Outcome $dedicated.State 'dedicated'
Assert-Outcome $dedicated.Port $port
Assert-Outcome $dedicated.Root.ProcessId 26324

$listenerOwner = 40000
$ordinary = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $marker
Assert-Outcome $ordinary.State 'unknown'
$unrecorded = Get-DedicatedRootState @($main) @($main, $crashpad) $exe $null
Assert-Outcome $unrecorded.State 'unknown'
Write-Host 'Passed: reuse requires a matching successful-session marker and loopback ownership.'
