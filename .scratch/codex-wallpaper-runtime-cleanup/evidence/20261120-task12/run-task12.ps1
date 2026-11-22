param(
    [int]$WaitMinutes = 30
)

$ErrorActionPreference = 'Stop'
$outputDirectory = $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $outputDirectory "$runId-run.log"
$summaryPath = Join-Path $outputDirectory "$runId-summary.json"
$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
$launcher = Join-Path $repositoryRoot 'launcher\Start-CodexWallpaper.ps1'
$receiptRoot = Join-Path $env:LOCALAPPDATA 'CodexWallpaper\P0b'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WallpaperWindowSize {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(
        IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@

function Write-Log([string]$Message) {
    $line = '{0:o} {1}' -f [DateTimeOffset]::Now, $Message
    [IO.File]::AppendAllText(
        $logPath,
        $line + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
    )
}

function Get-CodexRoots {
    @(Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction Stop |
        Where-Object { $_.CommandLine -notmatch '(?:^|\s|")--type=' })
}

function Set-CodexWindowSize([int]$MainPid) {
    $process = Get-Process -Id $MainPid -ErrorAction Stop
    if ($process.MainWindowHandle -eq 0) { return $false }
    [void][WallpaperWindowSize]::ShowWindow($process.MainWindowHandle, 9)
    [void][WallpaperWindowSize]::SetWindowPos(
        $process.MainWindowHandle,
        [IntPtr]::Zero,
        0,
        0,
        1706,
        1066,
        0x0040
    )
    return $true
}

function Invoke-NodeStep(
    [string]$Name,
    [string[]]$Arguments,
    [int]$TimeoutSeconds
) {
    $stdoutPath = Join-Path $outputDirectory "$runId-$Name.stdout.log"
    $stderrPath = Join-Path $outputDirectory "$runId-$Name.stderr.log"
    Write-Log "Starting $Name"
    $process = Start-Process -FilePath $node `
        -ArgumentList (@('--no-use-env-proxy') + $Arguments) `
        -WorkingDirectory $repositoryRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru `
        -WindowStyle Hidden
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        try { $process.Kill($true) } catch {}
        $process.WaitForExit(5000) | Out-Null
        Write-Log "$Name timed out after $TimeoutSeconds seconds"
        return [pscustomobject]@{
            Name = $Name
            ExitCode = 124
            StdoutPath = $stdoutPath
            StderrPath = $stderrPath
        }
    }
    Write-Log "$Name exited with $($process.ExitCode)"
    [pscustomobject]@{
        Name = $Name
        ExitCode = $process.ExitCode
        StdoutPath = $stdoutPath
        StderrPath = $stderrPath
    }
}

function Read-JsonFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

$lockPath = Join-Path $outputDirectory 'watchdog.pid'
if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
    $existingPid = [int](Get-Content -Raw -LiteralPath $lockPath)
    if (Get-Process -Id $existingPid -ErrorAction SilentlyContinue) {
        Write-Host "Task 12 watchdog is already running as PID $existingPid."
        exit 0
    }
}
[IO.File]::WriteAllText($lockPath, [string]$PID, [Text.UTF8Encoding]::new($false))

$summary = [ordered]@{
    runId = $runId
    startedAt = [DateTimeOffset]::Now.ToString('o')
    repositoryRoot = $repositoryRoot
    startupReceipt = $null
    startup = $null
    steps = @()
    result = 'running'
}

try {
    Write-Log "Waiting up to $WaitMinutes minutes for the current Codex to exit"
    $deadline = (Get-Date).AddMinutes($WaitMinutes)
    $lastHeartbeat = Get-Date
    while ((Get-Date) -lt $deadline) {
        if (@(Get-CodexRoots).Count -eq 0) {
            Start-Sleep -Seconds 2
            if (@(Get-CodexRoots).Count -eq 0) { break }
        }
        if (((Get-Date) - $lastHeartbeat).TotalSeconds -ge 30) {
            Write-Log 'Still waiting for Codex to exit'
            $lastHeartbeat = Get-Date
        }
        Start-Sleep -Seconds 2
    }
    if (@(Get-CodexRoots).Count -ne 0) {
        $summary.result = 'waiting-for-codex-timeout'
        throw 'Codex did not exit before the watchdog deadline.'
    }

    $launchStartedAt = Get-Date
    $launchStdout = Join-Path $outputDirectory "$runId-launch.stdout.log"
    $launchStderr = Join-Path $outputDirectory "$runId-launch.stderr.log"
    Write-Log 'Starting the real dedicated entry'
    $launch = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList @(
            '-NoProfile',
            '-NonInteractive',
            '-STA',
            '-WindowStyle',
            'Hidden',
            '-File',
            $launcher,
            '-Launch',
            '-Unattended'
        ) `
        -WorkingDirectory $repositoryRoot `
        -RedirectStandardOutput $launchStdout `
        -RedirectStandardError $launchStderr `
        -PassThru `
        -WindowStyle Hidden
    $launch.WaitForExit(45000) | Out-Null
    if (-not $launch.HasExited) {
        try { $launch.Kill($true) } catch {}
        throw 'The dedicated entry did not exit after its startup handoff.'
    }
    Write-Log "Dedicated entry exited with $($launch.ExitCode)"

    $receipt = Get-ChildItem -LiteralPath $receiptRoot -Filter '*.json' |
        Where-Object { $_.Name -ne 'dedicated-session.json' -and $_.LastWriteTime -ge $launchStartedAt.AddSeconds(-5) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $receipt) { throw 'No startup receipt was written.' }
    $receiptCopy = Join-Path $outputDirectory "$runId-startup-receipt.json"
    Copy-Item -LiteralPath $receipt.FullName -Destination $receiptCopy -Force
    $summary.startupReceipt = $receiptCopy
    $startup = Read-JsonFile $receipt.FullName
    $summary.startup = [ordered]@{
        outcome = $startup.Outcome
        mainPid = $startup.MainPid
        mainCreated = $startup.MainCreated
        port = $startup.Port
        targetAcknowledgedMs = $startup.TargetAcknowledgedMs
        targetReverifiedMs = $startup.TargetReverifiedMs
        hostReadyMs = $startup.HostReadyMs
        wallpaperState = $startup.Wallpaper.state
        hostReady = $startup.Wallpaper.hostReady
        runtimeHash = $startup.Wallpaper.identity.runtimeHash
        styleHash = $startup.Wallpaper.identity.styleHash
    }
    Write-Log "Startup outcome: $($startup.Outcome)"
    if ($startup.Outcome -ne 'wallpaper-ready' -or -not $startup.Port) {
        throw "Dedicated startup failed: $($startup.Outcome)"
    }

    $port = [int]$startup.Port
    $listenerDeadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $listenerDeadline) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
            break
        }
        Start-Sleep -Milliseconds 250
    }
    if (-not (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
        throw "No dedicated listener appeared on port $port."
    }

    $shell = New-Object -ComObject WScript.Shell
    try {
        if (-not $shell.AppActivate([int]$startup.MainPid)) {
            Write-Log 'The launched main window could not be activated automatically'
        }
    } finally {
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    }
    Start-Sleep -Seconds 2

    if (-not (Set-CodexWindowSize ([int]$startup.MainPid))) {
        throw 'The launched main window handle is unavailable.'
    }
    Start-Sleep -Seconds 1
    $prepared = Invoke-NodeStep 'prepare-live' @(
        (Join-Path $outputDirectory 'prepare-live.mjs'),
        [string]$port
    ) 30
    $summary.steps += $prepared
    if ($prepared.ExitCode -ne 0) {
        throw 'The launched main page did not become visible and focused.'
    }

    $configBackup = Join-Path $outputDirectory "$runId-config-backup.json"
    $candidateInitial = Invoke-NodeStep 'candidate-initial' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-performance-settings\candidate-check.mjs'),
        [string]$port
    ) 30
    $summary.steps += $candidateInitial
    $candidate = Read-JsonFile $candidateInitial.StdoutPath
    $summary.candidateInitial = $candidate
    if ($candidateInitial.ExitCode -ne 0 -or $candidate.pass -ne $true) {
        throw 'The live instance did not match the worktree candidate.'
    }

    $liveSwitch = Invoke-NodeStep 'live-switch-full' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-media-startup-performance\evidence\20261119-live-switch-probe.mjs'),
        [string]$port,
        (Join-Path $outputDirectory "$runId-live-switch-full.json"),
        $configBackup
    ) 600
    $summary.steps += $liveSwitch
    if (-not (Test-Path -LiteralPath $configBackup -PathType Leaf)) {
        throw 'The lifecycle probe did not create the accepted config backup.'
    }

    $assetDirectory = Join-Path $outputDirectory "$runId-four-assets"
    [void][IO.Directory]::CreateDirectory($assetDirectory)
    $assets = Invoke-NodeStep 'four-assets' @(
        (Join-Path $outputDirectory 'four-assets.mjs'),
        [string]$port,
        $configBackup,
        $assetDirectory
    ) 360
    $summary.steps += $assets

    $functional = Invoke-NodeStep 'real-functional' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-performance-settings\real-functional-acceptance.mjs'),
        [string]$port,
        $configBackup,
        (Join-Path $outputDirectory "$runId-real-functional.json")
    ) 360
    $summary.steps += $functional

    $interaction = Invoke-NodeStep 'real-interaction' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-performance-settings\real-interaction-metrics.mjs'),
        [string]$port,
        $configBackup,
        (Join-Path $outputDirectory "$runId-real-interaction.json"),
        'latency'
    ) 360
    $summary.steps += $interaction

    $reset = Invoke-NodeStep 'reset-restore' @(
        (Join-Path $outputDirectory 'reset-restore.mjs'),
        [string]$port,
        $configBackup,
        (Join-Path $outputDirectory "$runId-reset-restore.json")
    ) 120
    $summary.steps += $reset

    $performance = Invoke-NodeStep 'real-performance-visible' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-performance-settings\real-performance-driver.mjs'),
        [string]$port,
        'visible',
        $configBackup,
        (Join-Path $outputDirectory "$runId-real-performance-visible.json")
    ) 1200
    $summary.steps += $performance

    $candidateFinal = Invoke-NodeStep 'candidate-final' @(
        (Join-Path $repositoryRoot '.scratch\codex-wallpaper-performance-settings\candidate-check.mjs'),
        [string]$port
    ) 30
    $summary.steps += $candidateFinal
    $summary.candidateFinal = Read-JsonFile $candidateFinal.StdoutPath
    $summary.result = if (
        $candidateFinal.ExitCode -eq 0 -and
        $summary.candidateFinal.pass -eq $true
    ) { 'automated-evidence-collected' } else { 'final-identity-failed' }
} catch {
    $summary.error = $_.Exception.Message
    if ($summary.result -eq 'running') { $summary.result = 'failed' }
    Write-Log "Stopped: $($_.Exception.Message)"
} finally {
    $summary.finishedAt = [DateTimeOffset]::Now.ToString('o')
    [IO.File]::WriteAllText(
        $summaryPath,
        ($summary | ConvertTo-Json -Depth 8),
        [Text.UTF8Encoding]::new($false)
    )
    Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    Write-Log "Finished with result $($summary.result)"
}
