param(
    [switch]$Launch,
    [switch]$Unattended,
    [switch]$EnableStartup,
    [switch]$DisableStartup,
    [switch]$StartupStatus,
    [string]$ReceiptRoot
)

$ErrorActionPreference = 'Stop'
$packageName = 'OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0'
$appId = 'OpenAI.Codex_2p2nqsd0c76g0!App'
$expectedExeHash = 'CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6'
$nativeProfile = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Codex\web\Codex'
$stateFolder = if ($ReceiptRoot) { $ReceiptRoot } else {
    Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodexWallpaper\P0b'
}

function Get-WallpaperStartupEntryPath($StartupFolder) {
    return Join-Path $StartupFolder 'Codex Wallpaper.lnk'
}

function Get-WallpaperStartupDescription {
    return 'Start the dedicated Codex wallpaper entry at Windows login.'
}

function Get-WallpaperStartupArguments($LauncherPath) {
    return '-NoProfile -NonInteractive -STA -WindowStyle Hidden -File "{0}" -Launch -Unattended' -f $LauncherPath
}

function Set-WallpaperStartup($StartupFolder, $LauncherPath, $PowerShellPath) {
    [void][IO.Directory]::CreateDirectory($StartupFolder)
    $entryPath = Get-WallpaperStartupEntryPath $StartupFolder
    $shell = New-Object -ComObject WScript.Shell
    try {
        $shortcut = $shell.CreateShortcut($entryPath)
        $shortcut.TargetPath = $PowerShellPath
        $shortcut.Arguments = Get-WallpaperStartupArguments $LauncherPath
        $shortcut.WorkingDirectory = Split-Path -Parent $LauncherPath
        $shortcut.WindowStyle = 7
        $shortcut.Description = Get-WallpaperStartupDescription
        $shortcut.Save()
    } finally {
        if ($shortcut) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut) }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    }
}

function Remove-WallpaperStartup($StartupFolder, $LauncherPath, $PowerShellPath) {
    $status = Get-WallpaperStartupStatus $StartupFolder $LauncherPath $PowerShellPath
    if ($status.Status -ne 'disabled' -and $status.Description -eq (Get-WallpaperStartupDescription)) {
        Remove-Item -LiteralPath $status.EntryPath -Force
    }
}

function Get-WallpaperStartupStatus($StartupFolder, $LauncherPath, $PowerShellPath) {
    $entryPath = Get-WallpaperStartupEntryPath $StartupFolder
    if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
        return [pscustomobject]@{ Status = 'disabled'; EntryPath = $entryPath }
    }
    $shell = New-Object -ComObject WScript.Shell
    try {
        $shortcut = $shell.CreateShortcut($entryPath)
        $expectedArguments = Get-WallpaperStartupArguments $LauncherPath
        $enabled = $shortcut.TargetPath -ieq $PowerShellPath -and $shortcut.Arguments -eq $expectedArguments
        return [pscustomobject]@{
            Status = if ($enabled) { 'enabled' } else { 'stale' }
            EntryPath = $entryPath
            TargetPath = $shortcut.TargetPath
            Arguments = $shortcut.Arguments
            WorkingDirectory = $shortcut.WorkingDirectory
            WindowStyle = $shortcut.WindowStyle
            Description = $shortcut.Description
        }
    } finally {
        if ($shortcut) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut) }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    }
}

$startupActions = @($EnableStartup.IsPresent, $DisableStartup.IsPresent, $StartupStatus.IsPresent) |
    Where-Object { $_ }
if (@($startupActions).Count -gt 1) { throw 'Choose only one Startup action.' }
if ($EnableStartup -or $DisableStartup -or $StartupStatus) {
    $startupFolder = [Environment]::GetFolderPath('Startup')
    if ([string]::IsNullOrWhiteSpace($startupFolder)) { throw 'The per-user Windows Startup folder was not found.' }
    $startupLauncher = (Resolve-Path -LiteralPath $PSCommandPath).Path
    $startupPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    if ($EnableStartup) { Set-WallpaperStartup $startupFolder $startupLauncher $startupPowerShell }
    if ($DisableStartup) { Remove-WallpaperStartup $startupFolder $startupLauncher $startupPowerShell }
    Get-WallpaperStartupStatus $startupFolder $startupLauncher $startupPowerShell | ConvertTo-Json -Depth 3
    exit 0
}
if ($Unattended -and -not $Launch) { throw 'Unattended can be used only with Launch.' }

function Get-CodexProcesses {
    # Include uninspectable ChatGPT.exe roots in the guard rather than assuming they are safe.
    Get-CimInstance Win32_Process -Filter "Name = 'ChatGPT.exe'" -ErrorAction Stop
}

function Get-CodexRoots($Processes) {
    $Processes | Where-Object { $_.CommandLine -notmatch '(?:^|\s|")--type=' }
}

function Get-StartupRootState($Processes, $Observation, [long]$ElapsedMs) {
    $roots = @(Get-CodexRoots $Processes | Sort-Object ProcessId)
    if ($roots.Count -gt 1) {
        if ($null -eq $Observation.AmbiguousSinceMs) { $Observation.AmbiguousSinceMs = $ElapsedMs }
        $outcome = if ($ElapsedMs - $Observation.AmbiguousSinceMs -ge 3000) { 'multiple-main-processes' } else { 'ambiguous' }
    } else {
        $Observation.AmbiguousSinceMs = $null
        $outcome = if ($roots.Count -eq 0) { 'waiting' } else { 'single' }
    }

    # Keep candidate metadata, not raw command lines, so another failure can be reconstructed.
    $candidates = @($roots | ForEach-Object {
        [pscustomobject]@{
            Pid = $_.ProcessId; ParentPid = $_.ParentProcessId
            Created = if ($_.CreationDate) { $_.CreationDate.ToString('o') } else { $null }
            ExpectedExecutable = $_.ExecutablePath -ieq $Observation.ExpectedExecutable
            CommandLineReadable = -not [string]::IsNullOrWhiteSpace($_.CommandLine)
        }
    })
    $key = $outcome + ':' + (($candidates | ForEach-Object {
        '{0}:{1}:{2}:{3}:{4}' -f $_.Pid, $_.ParentPid, $_.Created, $_.ExpectedExecutable, $_.CommandLineReadable
    }) -join '|')
    if ($key -ne $Observation.LastKey) {
        $Observation.LastKey = $key
        if ($Observation.Timeline.Count -lt 32) {
            [void]$Observation.Timeline.Add([pscustomobject]@{
                ElapsedMs = $ElapsedMs; State = $outcome; Candidates = $candidates
            })
        } else { $Observation.TimelineTruncated = $true }
    }
    [pscustomobject]@{ Roots = $roots; Outcome = $outcome }
}

function Test-DailyProfile($Root, $Processes) {
    # The observed Owl build passes this path to its direct crashpad children.
    # No files under the daily profile are opened by this check.
    $paths = @(
        foreach ($p in $Processes) {
            if ($p.ParentProcessId -ne $Root.ProcessId -or $p.CreationDate -lt $Root.CreationDate -or
                $p.CommandLine -notmatch '--type=crashpad-handler') { continue }
            foreach ($m in [regex]::Matches($p.CommandLine, '(?:^|\s)(?:"--user-data-dir=([^"]+)"|--user-data-dir="([^"]+)"|--user-data-dir=([^\s"]+))')) {
                ($m.Groups[1..3] | Where-Object Success | Select-Object -First 1).Value
            }
        }
    )
    if ($paths.Count -eq 0) { return 'unobserved' }
    $expectedProfiles = @($nativeProfile)
    if ($packageProfile) { $expectedProfiles += $packageProfile }
    if (@($paths | Where-Object { $path = $_; -not @($expectedProfiles | Where-Object { $path -ieq $_ }).Count }).Count -gt 0) {
        return 'different'
    }
    return 'matches-daily-path'
}

function Test-LoopbackOwner($Port, $OwnerPid) {
    $owners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    return ('127.0.0.1' -in $owners.LocalAddress -and @($owners | Where-Object {
        $_.OwningProcess -ne $OwnerPid -or $_.LocalAddress -notin @('127.0.0.1', '::1')
    }).Count -eq 0)
}

function Get-DedicatedRootState($Roots, $Processes, $ExpectedExecutable, $SessionMarker) {
    if ($null -eq $SessionMarker) { return [pscustomobject]@{ State = 'unknown'; Root = @($Roots | Select-Object -First 1) } }
    foreach ($root in $Roots) {
        if ($root.ProcessId -ne $SessionMarker.MainPid -or
            $root.CreationDate.ToString('o') -ne $SessionMarker.MainCreated -or
            $root.ExecutablePath -ine $ExpectedExecutable -or
            (Test-DailyProfile $root $Processes) -ne 'matches-daily-path') {
            continue
        }
        $match = [regex]::Match([string]$root.CommandLine, '(?:^|\s|\")--remote-debugging-port=(\d+)(?:\s|\"|$)')
        if (-not $match.Success) { continue }
        $port = [int]$match.Groups[1].Value
        if ($port -ne [int]$SessionMarker.Port) { continue }
        if (Test-LoopbackOwner $port $root.ProcessId) {
            return [pscustomobject]@{ State = 'dedicated'; Root = $root; Port = $port }
        }
    }
    return [pscustomobject]@{ State = 'unknown'; Root = @($Roots | Select-Object -First 1) }
}

function Save-Receipt($Receipt, $Folder) {
    [void][IO.Directory]::CreateDirectory($folder)
    $name = '{0}-{1}.json' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [guid]::NewGuid().ToString('N')
    $file = Join-Path $folder $name
    [IO.File]::WriteAllText($file, ($Receipt | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    Write-Host "Receipt: $file"
}

function Get-DedicatedSession($Folder) {
    $file = Join-Path $Folder 'dedicated-session.json'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
    try { return Get-Content -Raw -LiteralPath $file | ConvertFrom-Json } catch { return $null }
}

function Save-DedicatedSession($Session, $Folder) {
    [void][IO.Directory]::CreateDirectory($Folder)
    $file = Join-Path $Folder 'dedicated-session.json'
    [IO.File]::WriteAllText($file, ($Session | ConvertTo-Json -Depth 3), [Text.UTF8Encoding]::new($false))
}

$receipt = $null
if ($Unattended) {
    $receipt = [ordered]@{
        Started = [DateTimeOffset]::Now.ToString('o'); Package = $packageName
        Mode = 'unattended-startup'; Outcome = 'startup-launch-started'
    }
}
try {
    $pkg = @(Get-AppxPackage -Name OpenAI.Codex -ErrorAction Stop)
} catch {
    if ($receipt) {
        $receipt.Outcome = 'package-query-failed'
        Save-Receipt $receipt $stateFolder
    }
    Write-Host 'Codex package query failed. Use the original entry. No activation attempted.'
    exit 2
}
if ($pkg.Count -ne 1 -or $pkg[0].PackageFullName -ne $packageName) {
    if ($receipt) {
        $receipt.Outcome = 'unsupported-package'
        Save-Receipt $receipt $stateFolder
    }
    Write-Host 'Unsupported or ambiguous Codex package. Use the original entry. No activation attempted.'
    exit 2
}
$exe = Join-Path $pkg[0].InstallLocation 'app\ChatGPT.exe'
$packageProfile = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) `
    ('Packages\{0}\LocalCache\Roaming\Codex\web\Codex' -f $pkg[0].PackageFamilyName)

if (-not $Launch) {
    $processes = @(Get-CodexProcesses)
    $roots = @(Get-CodexRoots $processes)
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
    [pscustomobject]@{
        Mode = 'status-only'
        Package = $packageName
        Running = @($roots | ForEach-Object {
            [pscustomobject]@{
                Pid = $_.ProcessId
                CreationTime = $_.CreationDate
                ExpectedExecutable = $_.ExecutablePath -ieq $exe
                DebugFlag = $_.CommandLine -match '(?:^|\s|")--remote-debugging-(?:port|pipe)(?:=|\s|"|$)'
                NativeProfile = Test-DailyProfile $_ $processes
                ListeningPorts = @($listeners | Where-Object OwningProcess -eq $_.ProcessId | Select-Object -ExpandProperty LocalPort -Unique)
            }
        })
    } | ConvertTo-Json -Depth 5
    exit 0
}

# A session-local mutex serializes this launcher; it cannot serialize the original entry.
$mutex = [Threading.Mutex]::new($false, 'Local\CodexWallpaper.P0b')
$locked = $false
$exitCode = 1
$observation = $null
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) {
        if ($receipt) { $receipt.Outcome = 'launcher-in-progress' }
        Write-Host 'Another probe is in progress. No activation attempted.'
        exit 2
    }
    $existingRoots = @(Get-CodexRoots @(Get-CodexProcesses))
    if ($existingRoots.Count -gt 1) {
        if ($receipt) { $receipt.Outcome = 'multiple-main-processes' }
        Write-Host 'Multiple Codex main processes were observed. No activation attempted.'
        exit 2
    }
    if ($existingRoots.Count -eq 1) {
        $processes = @(Get-CodexProcesses)
        $dedicatedRoot = Get-DedicatedRootState $existingRoots $processes $exe (Get-DedicatedSession $stateFolder)
        if ($dedicatedRoot.State -eq 'dedicated') {
            if ($receipt) {
                $receipt.Outcome = 'dedicated-instance-reused'
                $receipt.MainPid = $dedicatedRoot.Root.ProcessId
                $receipt.MainCreated = $dedicatedRoot.Root.CreationDate.ToString('o')
                $receipt.Port = $dedicatedRoot.Port
            }
            $exitCode = 0
            Write-Host 'Dedicated Codex wallpaper instance is already running. Reused without connecting or re-injecting.'
            exit 0
        }
        $hasDebugFlag = $existingRoots[0].CommandLine -match '(?:^|\s|\")--remote-debugging-(?:port|pipe)(?:=|\s|\"|$)'
        if ($receipt) {
            $receipt.Outcome = if ($hasDebugFlag) { 'unverified-running-instance' } else { 'ordinary-instance-running' }
        }
        if ($hasDebugFlag) {
            Write-Host 'Codex is already running, but no matching dedicated-launch receipt was found. Nothing was started, connected, or changed.'
        } else {
            Write-Host 'Codex is already running. Nothing was started or changed. Try only after manually quitting it.'
        }
        exit 2
    }
    if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ine $expectedExeHash -or
        -not @(Get-StartApps | Where-Object AppID -eq $appId).Count) {
        if ($receipt) { $receipt.Outcome = 'executable-or-app-registration-mismatch' }
        Write-Host 'Original executable or app registration did not match. No activation attempted.'
        exit 2
    }
    # The path reported by Owl can be backed by the registered package's LocalCache.
    # Check only existing directories; neither path is passed as a launch override.
    if (-not (Test-Path -LiteralPath $nativeProfile -PathType Container) -and
        -not (Test-Path -LiteralPath $packageProfile -PathType Container)) {
        if ($receipt) { $receipt.Outcome = 'daily-profile-missing' }
        Write-Host 'Expected daily profile directory is missing. No activation attempted.'
        exit 2
    }
    $node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    if ((& $node --no-use-env-proxy --version) -notmatch '^v(2[4-9]|[3-9][0-9])\.') {
        throw 'Node.js with built-in WebSocket and --no-use-env-proxy support is required.'
    }

    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace CodexWallpaperP0b {
    [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    public class ActivationManager {}

    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivationManager {
        [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId,
            [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint pid);
    }

    public static class Native {
        public static uint Activate(string appId, string arguments) {
            var manager = (IActivationManager)new ActivationManager();
            try {
                uint pid;
                Marshal.ThrowExceptionForHR(manager.ActivateApplication(appId, arguments, 0, out pid));
                return pid;
            } finally { Marshal.ReleaseComObject(manager); }
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint pid);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
        static extern int GetPackageFullName(IntPtr process, ref uint length, StringBuilder name);
        [DllImport("kernel32.dll")]
        static extern bool CloseHandle(IntPtr handle);

        public static string PackageName(uint pid) {
            var handle = OpenProcess(0x1000, false, pid);
            if (handle == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                uint length = 0;
                int result = GetPackageFullName(handle, ref length, null);
                if (result != 122 || length == 0) throw new Win32Exception(result);
                var name = new StringBuilder((int)length);
                result = GetPackageFullName(handle, ref length, name);
                if (result != 0) throw new Win32Exception(result);
                return name.ToString();
            } finally { CloseHandle(handle); }
        }
    }
}
'@

    $candidate = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $candidate.Start()
    try { $port = $candidate.LocalEndpoint.Port } finally { $candidate.Stop() }
    if (@(Get-CodexRoots @(Get-CodexProcesses)).Count -ne 0) {
        if ($receipt) { $receipt.Outcome = 'main-process-appeared-during-preparation' }
        Write-Host 'Codex appeared during preparation. No activation attempted.'
        exit 2
    }
    $receipt = [ordered]@{
        Started = [DateTimeOffset]::Now.ToString('o'); Package = $packageName; Port = $port
        Outcome = 'activation-attempted'; LoginAndChat = 'user-verification-required'
    }
    $beforeLaunch = Get-Date
    $receipt.ActivationPid = [CodexWallpaperP0b.Native]::Activate($appId,
        "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port")

    $clock = [Diagnostics.Stopwatch]::StartNew()
    $rootIdentity = $null
    $observation = @{ ExpectedExecutable = $exe; Timeline = [Collections.Generic.List[object]]::new() }
    $receipt.Outcome = 'no-verified-cdp-before-timeout'
    while ($clock.Elapsed.TotalSeconds -lt 25) {
        $processes = @(Get-CodexProcesses)
        $sample = Get-StartupRootState $processes $observation $clock.ElapsedMilliseconds
        $roots = $sample.Roots
        if ($sample.Outcome -eq 'multiple-main-processes') { $receipt.Outcome = $sample.Outcome; break }
        if ($sample.Outcome -eq 'ambiguous') { Start-Sleep -Milliseconds 300; continue }
        if ($roots.Count -eq 0) {
            if ($rootIdentity) { $receipt.Outcome = 'main-process-exited'; break }
            Start-Sleep -Milliseconds 300; continue
        }
        $root = $roots[0]
        $identity = '{0}:{1:o}' -f $root.ProcessId, $root.CreationDate
        if ($root.ExecutablePath -ine $exe -or $root.CreationDate -lt $beforeLaunch -or
            ($rootIdentity -and $rootIdentity -ne $identity) -or
            [CodexWallpaperP0b.Native]::PackageName($root.ProcessId) -ne $packageName) {
            $receipt.Outcome = 'unexpected-main-process'; break
        }
        $rootIdentity = $identity
        $receipt.MainPid = $root.ProcessId
        $receipt.MainCreated = $root.CreationDate.ToString('o')
        $receipt.PortFlagObserved = $root.CommandLine -match ('(?:^|\s|")--remote-debugging-port={0}(?:\s|"|$)' -f $port)
        $receipt.NativeProfile = Test-DailyProfile $root $processes
        if ($receipt.NativeProfile -eq 'different') { $receipt.Outcome = 'different-profile'; break }
        $listeners = @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() |
            Where-Object Port -eq $port)
        if ($listeners.Count -eq 0) { Start-Sleep -Milliseconds 300; continue }
        if (-not (Test-LoopbackOwner $port $root.ProcessId)) {
            $receipt.Outcome = 'unexpected-listener'; break
        }
        if (-not $receipt.PortFlagObserved -or $receipt.NativeProfile -ne 'matches-daily-path') {
            Start-Sleep -Milliseconds 300; continue
        }
        $reply = & $node --no-use-env-proxy (Join-Path $PSScriptRoot 'read-only-probe.mjs') $port
        $probeExit = $LASTEXITCODE
        if ($probeExit -eq 2) { Start-Sleep -Milliseconds 300; continue }
        if ($probeExit -ne 0) { $receipt.Outcome = 'probe-rejected'; break }
        $afterSample = Get-StartupRootState @(Get-CodexProcesses) $observation $clock.ElapsedMilliseconds
        if ($afterSample.Outcome -eq 'multiple-main-processes') { $receipt.Outcome = $afterSample.Outcome; break }
        if ($afterSample.Outcome -eq 'ambiguous') { Start-Sleep -Milliseconds 300; continue }
        $after = $afterSample.Roots
        if ($after.Count -ne 1 -or ('{0}:{1:o}' -f $after[0].ProcessId, $after[0].CreationDate) -ne $rootIdentity) {
            $receipt.Outcome = 'main-process-changed'; break
        }
        if (-not (Test-LoopbackOwner $port $root.ProcessId)) {
            $receipt.Outcome = 'listener-changed'; break
        }
        $receipt.Probe = $reply | ConvertFrom-Json
        $receipt.Outcome = 'read-only-probe-passed'
        $wallpaperReply = & $node --no-use-env-proxy (Join-Path $PSScriptRoot 'static-background.mjs') $port
        try {
            $receipt.Wallpaper = $wallpaperReply | ConvertFrom-Json
        } catch {
            $receipt.Wallpaper = [pscustomobject]@{ state = 'failed'; error = 'invalid-wallpaper-response' }
        }
        if ($LASTEXITCODE -ne 0) {
            $receipt.Outcome = 'wallpaper-injection-failed'
            break
        }
        $dedicatedSession = [ordered]@{
            Version = 1
            MainPid = $root.ProcessId
            MainCreated = $root.CreationDate.ToString('o')
            Port = $port
            Passed = [DateTimeOffset]::Now.ToString('o')
        }
        # Commit the reusable-session identity while the launcher mutex is held.
        Save-DedicatedSession $dedicatedSession $stateFolder
        $exitCode = 0
        break
    }
    if ($receipt.Outcome -eq 'no-verified-cdp-before-timeout' -and $null -ne $observation.AmbiguousSinceMs) {
        $receipt.Outcome = 'root-ambiguity-at-timeout'
    }
    Write-Host "Outcome: $($receipt.Outcome)"
    if ($receipt.Wallpaper) { Write-Host "Wallpaper: $($receipt.Wallpaper.state)" }
    Write-Host 'Verify the account and an existing chat yourself. If you see a login screen, do not sign in for this test.'
    Write-Host 'To remove the debug listener, quit this Codex normally, then use the original entry.'
} catch {
    if ($receipt) { $receipt.Outcome = 'launch-or-check-error' }
    Write-Host "Stopped: $($_.Exception.GetType().Name). No retry or restart."
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    if ($receipt) {
        if ($observation) {
            $receipt.RootObservations = $observation.Timeline.ToArray()
            $receipt.RootObservationsTruncated = [bool]$observation.TimelineTruncated
        }
        Save-Receipt $receipt $stateFolder
    }
}
exit $exitCode
