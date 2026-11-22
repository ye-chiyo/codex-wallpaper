param(
    [switch]$Launch,
    [switch]$Unattended,
    [switch]$EnableStartup,
    [switch]$DisableStartup,
    [switch]$StartupStatus,
    [string]$ReceiptRoot
)

$ErrorActionPreference = 'Stop'
$supportedExeHashes = @{
    'OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0' = 'CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6'
    'OpenAI.Codex_26.1117.3838.0_x64__2p2nqsd0c76g0' = 'AF4D57201946260D2754172BC660EFF80B5398EA146EF466126886CCD0CF2514'
    'OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0' = '21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82'
}
$appId = 'OpenAI.Codex_2p2nqsd0c76g0!App'
$codexPackageName = 'OpenAI.Codex'
$codexPackageFamilyName = 'OpenAI.Codex_2p2nqsd0c76g0'
$codexPublisherId = '2p2nqsd0c76g0'
$codexSignerSubject = 'CN="OpenAI OpCo, LLC"'
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

function Test-WallpaperStartupOwned($Shortcut) {
    return $Shortcut.Description -eq (Get-WallpaperStartupDescription)
}

function Set-WallpaperStartup($StartupFolder, $LauncherPath, $PowerShellPath) {
    [void][IO.Directory]::CreateDirectory($StartupFolder)
    $entryPath = Get-WallpaperStartupEntryPath $StartupFolder
    $status = Get-WallpaperStartupStatus $StartupFolder $LauncherPath $PowerShellPath
    if ($status.Status -ne 'disabled' -and -not $status.Owned) {
        throw 'A different Startup entry already uses the dedicated name.'
    }
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
    if ($status.Owned) {
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
        $owned = Test-WallpaperStartupOwned $shortcut
        $enabled = $owned -and $shortcut.TargetPath -ieq $PowerShellPath -and $shortcut.Arguments -eq $expectedArguments
        return [pscustomobject]@{
            Status = if ($enabled) { 'enabled' } else { 'stale' }
            Owned = $owned
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

if (-not (Get-Command Get-FileSha256 -CommandType Function -ErrorAction SilentlyContinue)) {
    function Get-FileSha256($Path) {
        $stream = [IO.File]::OpenRead($Path)
        $sha = [Security.Cryptography.SHA256]::Create()
        try {
            return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '')
        } finally {
            $sha.Dispose()
            $stream.Dispose()
        }
    }
}

function Test-TrackedCodexPackage($Package) {
    if ($null -eq $Package -or
        $Package.Name -cne $codexPackageName -or
        $Package.PackageFamilyName -cne $codexPackageFamilyName -or
        $Package.PublisherId -cne $codexPublisherId -or
        $Package.SignatureKind -cne 'Store' -or
        $Package.Status -cne 'Ok' -or
        $Package.Architecture -cne 'X64' -or
        $Package.IsDevelopmentMode -or
        $Package.PackageFullName -cnotmatch '^OpenAI\.Codex_[0-9]+(?:\.[0-9]+){3}_x64__2p2nqsd0c76g0$') {
        return [pscustomobject]@{ Trusted = $false; Reason = 'package-identity' }
    }
    $exe = Join-Path $Package.InstallLocation 'app\ChatGPT.exe'
    try {
        $signature = Get-AuthenticodeSignature -LiteralPath $exe
    } catch {
        return [pscustomobject]@{ Trusted = $false; Reason = 'signature-query' }
    }
    if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate -or
        $signature.SignerCertificate.Subject -notlike "$codexSignerSubject*") {
        return [pscustomobject]@{ Trusted = $false; Reason = 'signer' }
    }
    return [pscustomobject]@{
        Trusted = $true
        Executable = $exe
        ExecutableHash = Get-FileSha256 $exe
    }
}

function Write-DesktopError($Message) {
    if ($env:CODEX_WALLPAPER_DESKTOP_HANDSHAKE -ceq '1') {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Message))
        [Console]::WriteLine("CodexWallpaper:error:$encoded")
    }
}

function ConvertFrom-Utf8Base64($Value) {
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}

function Get-LaunchFailureMessage($Outcome) {
    switch ($Outcome) {
        'package-query-failed' { return ConvertFrom-Utf8Base64 '5peg5rOV6K+75Y+WIENvZGV4IOWuieijheS/oeaBr+OAguivt+ehruiupCBDb2RleCDlt7LmraPnoa7lronoo4XlkI7ph43or5XjgII=' }
        'unsupported-package' { return ConvertFrom-Utf8Base64 '5b2T5YmNIENvZGV4IOWuieijheWMheaXoOazlemAmui/h+WPr+S/oei6q+S7veagoemqjO+8jOWjgee6uOacquWKoOi9ve+8jOWOn+eVjOmdouW3suS/neeVmeOAgg==' }
        'executable-or-app-registration-mismatch' { return ConvertFrom-Utf8Base64 'Q29kZXgg5Li756iL5bqP5oiW5bqU55So55m76K6w5LiO5a6J6KOF5YyF5LiN5LiA6Ie077yM5aOB57q45pyq5Yqg6L2977yM5Y6f55WM6Z2i5bey5L+d55WZ44CC' }
        'daily-profile-missing' { return ConvertFrom-Utf8Base64 '5pyq5om+5YiwIENvZGV4IOaXpeW4uOaVsOaNruebruW9le+8jOWjgee6uOacquWKoOi9ve+8jOWOn+eVjOmdouW3suS/neeVmeOAgg==' }
        'launcher-in-progress' { return ConvertFrom-Utf8Base64 '5Y+m5LiA5Liq5aOB57q45ZCv5Yqo5qOA5p+l5q2j5Zyo6L+b6KGM77yM6K+356iN562J5Yeg56eS5ZCO6YeN6K+V44CC' }
        'multiple-main-processes' { return ConvertFrom-Utf8Base64 '5qOA5rWL5Yiw5aSa5LiqIENvZGV4IOS4u+i/m+eoi+OAguivt+WujOWFqOmAgOWHuuaJgOaciSBDb2RleCDnqpflj6PlkI7ph43or5XjgII=' }
        'ordinary-instance-running' { return ConvertFrom-Utf8Base64 'Q29kZXgg5q2j5Zyo6L+Q6KGM44CC5aOB57q45YWl5Y+j5LiN5Lya6ZmE5Yqg5Yiw5bey5omT5byA55qE5pmu6YCa5a6e5L6L77yM6K+35a6M5YWo6YCA5Ye6IENvZGV4IOWQjumHjeaWsOaJk+W8gOOAgg==' }
        'unverified-running-instance' { return ConvertFrom-Utf8Base64 'Q29kZXgg5q2j5Zyo6L+Q6KGM77yM5L2G5rKh5pyJ5om+5Yiw5Yy56YWN55qE5aOB57q45ZCv5Yqo6K6w5b2V44CC6K+35a6M5YWo6YCA5Ye6IENvZGV4IOWQjumHjeaWsOaJk+W8gOOAgg==' }
        'main-process-appeared-during-preparation' { return ConvertFrom-Utf8Base64 '5YeG5aSH5ZCv5Yqo5pe2IENvZGV4IOW3suiiq+WFtuS7luWFpeWPo+aJk+W8gOOAguivt+WujOWFqOmAgOWHuiBDb2RleCDlkI7ph43or5XjgII=' }
        'compatibility-probe-failed' { return ConvertFrom-Utf8Base64 '5paw54mI5pysIENvZGV4IOacqumAmui/h+eVjOmdouWFvOWuueaOoua1i++8jOWjgee6uOacquWKoOi9ve+8jOWOn+eVjOmdouW3suS/neeVmeOAguivt+etieW+heWjgee6uOmAgumFjeabtOaWsOOAgg==' }
        'wallpaper-injection-failed' { return ConvertFrom-Utf8Base64 '5aOB57q46L+Q6KGM5bGC5pyq6IO95oiQ5Yqf5o6l5YWl5b2T5YmNIENvZGV4IOeVjOmdou+8jOWOn+eVjOmdouW3suS/neeVmeOAguivt+eojeWQjumHjeivleOAgg==' }
        'supervisor-startup-timeout' { return ConvertFrom-Utf8Base64 '5aOB57q45ZCv5Yqo5qOA5p+l6LaF5pe277yMQ29kZXgg5Y6f55WM6Z2i5bey5L+d55WZ44CC6K+36YeN6K+V5oiW5p+l55yL5pys5Zyw5Zue5omn44CC' }
        'launch-or-check-error' { return ConvertFrom-Utf8Base64 '5aOB57q45ZCv5Yqo5qOA5p+l5Y+R55Sf6ZSZ6K+v77yMQ29kZXgg5Y6f55WM6Z2i5bey5L+d55WZ44CC6K+35p+l55yL5pys5Zyw5Zue5omn5Lit55qE6ZSZ6K+v5L+h5oGv44CC' }
        default {
            if ([string]::IsNullOrWhiteSpace($Outcome)) {
                return ConvertFrom-Utf8Base64 'Q29kZXgg5aOB57q45rKh5pyJ5oiQ5Yqf5ZCv5Yqo77yMQ29kZXgg5Y6f55WM6Z2i5bey5L+d55WZ44CC'
            }
            return (ConvertFrom-Utf8Base64 'Q29kZXgg5aOB57q45rKh5pyJ5oiQ5Yqf5ZCv5Yqo77yI') + $Outcome +
                (ConvertFrom-Utf8Base64 '77yJ77yMQ29kZXgg5Y6f55WM6Z2i5bey5L+d55WZ44CC')
        }
    }
}

function Test-WallpaperHost($Port, $LockFolder = [IO.Path]::GetTempPath()) {
    $process = $null
    $file = Join-Path $LockFolder ('codex-wallpaper-host-{0}.lock' -f $Port)
    try {
        $owner = [int]([IO.File]::ReadAllText($file).Trim())
        $process = [Diagnostics.Process]::GetProcessById($owner)
        return -not $process.HasExited
    } catch [IO.IOException] {
        return Test-Path -LiteralPath $file -PathType Leaf
    } catch {
        return $false
    } finally {
        if ($process) { $process.Dispose() }
    }
}

function Get-DedicatedRootState($Roots, $Processes, $ExpectedExecutable, $SessionMarker, $HostLockFolder = [IO.Path]::GetTempPath()) {
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
        if ((Test-LoopbackOwner $port $root.ProcessId) -and (Test-WallpaperHost $port $HostLockFolder)) {
            return [pscustomobject]@{ State = 'dedicated'; Root = $root; Port = $port }
        }
    }
    return [pscustomobject]@{ State = 'unknown'; Root = @($Roots | Select-Object -First 1) }
}

function Get-RecoverableRootState($Roots, $Processes, $ExpectedExecutable, $ReceiptFolder, $HostLockFolder = [IO.Path]::GetTempPath()) {
    if (-not (Test-Path -LiteralPath $ReceiptFolder -PathType Container)) {
        return [pscustomobject]@{ State = 'unknown'; Root = @($Roots | Select-Object -First 1) }
    }
    $receipts = @(Get-ChildItem -LiteralPath $ReceiptFolder -Filter '*.json' -File |
        Where-Object { $_.Name -ne 'dedicated-session.json' } |
        Sort-Object LastWriteTime -Descending)
    foreach ($root in $Roots) {
        if ($root.ExecutablePath -ine $ExpectedExecutable -or
            (Test-DailyProfile $root $Processes) -ne 'matches-daily-path') {
            continue
        }
        $match = [regex]::Match([string]$root.CommandLine, '(?:^|\s|\")--remote-debugging-port=(\d+)(?:\s|\"|$)')
        if (-not $match.Success) { continue }
        $port = [int]$match.Groups[1].Value
        if (-not (Test-LoopbackOwner $port $root.ProcessId) -or
            (Test-WallpaperHost $port $HostLockFolder)) {
            continue
        }
        foreach ($file in $receipts) {
            try {
                $candidate = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json
            } catch {
                continue
            }
            if ($candidate.Outcome -notin @('wallpaper-injection-failed', 'wallpaper-ready') -or
                $candidate.TargetVerified -ne $true -or
                [int]$candidate.MainPid -ne $root.ProcessId -or
                [string]$candidate.MainCreated -cne $root.CreationDate.ToString('o') -or
                [int]$candidate.Port -ne $port) {
                continue
            }
            return [pscustomobject]@{
                State = 'recoverable'
                Root = $root
                Port = $port
                Receipt = $file.FullName
            }
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

function Start-WallpaperSupervisor($Node, $LauncherFolder, $Port, $Clock, $Receipt, [scriptblock]$Recheck, [bool]$ShowStartupPreview = $false) {
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Node
    $info.Arguments = '--no-use-env-proxy "{0}" {1}' -f (Join-Path $LauncherFolder 'startup-supervisor.mjs'), $Port
    if ($stateFolder) {
        $info.EnvironmentVariables['CODEX_WALLPAPER_STARTUP_CACHE'] = Join-Path $stateFolder 'startup-preview.json'
    }
    if ($ShowStartupPreview) { $info.Arguments += ' --desktop-preview' }
    if ($Receipt.CompatibilityMode -eq 'probe') { $info.Arguments += ' --compatibility-probe' }
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($info)
    $keep = $false
    $receipt.Outcome = 'supervisor-verification-failed'
    $receipt.TargetVerificationCount = 0
    try {
        while ($true) {
            $read = $process.StandardOutput.ReadLineAsync()
            $remaining = [int][Math]::Max(0, 25000 - $Clock.ElapsedMilliseconds)
            if (-not $read.Wait($remaining)) {
                $Receipt.Outcome = 'supervisor-startup-timeout'
                return
            }
            if (-not $read.Result) { return }
            $message = $read.Result | ConvertFrom-Json
            if ($message.state -eq 'failed') {
                $Receipt.SupervisorError = $message.error
                if ($message.error -eq 'compatibility-probe-failed') {
                    $Receipt.Outcome = 'compatibility-probe-failed'
                } elseif ($Receipt.TargetVerified) {
                    $Receipt.Outcome = 'wallpaper-injection-failed'
                }
                return
            }
            if ($message.state -eq 'verified') {
                if ($message.page -cne 'app://-/index.html' -or $message.origin -cne 'app://-') { return }
                $verification = [int]$Receipt.TargetVerificationCount + 1
                if ($message.verification -ne $verification) { return }
                $Receipt.Probe = $message
                $Receipt.TargetVerified = $true
                $Receipt.TargetVerificationCount = $verification
                if ($null -eq $Receipt.TargetAcknowledgedMs) {
                    $Receipt.TargetAcknowledgedMs = $Clock.ElapsedMilliseconds
                } else {
                    $Receipt.TargetReverifiedMs = $Clock.ElapsedMilliseconds
                }
                $rejection = & $Recheck
                if ($rejection) {
                    $Receipt.Outcome = $rejection
                    return
                }
                $Receipt.Outcome = 'wallpaper-injection-failed'
                $process.StandardInput.WriteLine("attach $verification")
                $process.StandardInput.Flush()
                continue
            }
            if ($message.state -ne 'ready') { return }
            $wallpaper = $message.wallpaper
            if ($wallpaper.state -notin @('enabled', 'disabled') -or $wallpaper.hostReady -ne $true -or
                $wallpaper.hostPid -ne $process.Id -or $wallpaper.identity.runtimeHash -cnotmatch '^[0-9a-f]{64}$' -or
                $wallpaper.identity.styleHash -cnotmatch '^[0-9a-f]{64}$') { return }
            # Pass the verified process identity and the same listener check to the
            # supervisor so it can recheck ownership after this launcher exits.
            $verifyOwner = @'
$ErrorActionPreference = 'Stop'
function Test-LoopbackOwner {{ {0} }}
$owner = Get-CimInstance Win32_Process -Filter 'ProcessId = {1}'
if (-not $owner -or $owner.CreationDate.ToString('o') -cne '{2}' -or
    -not (Test-LoopbackOwner {3} {1})) {{ exit 1 }}
'@
            $verifyOwner = $verifyOwner -f ${function:Test-LoopbackOwner}, [int]$Receipt.MainPid, $Receipt.MainCreated, [int]$Port
            $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($verifyOwner))
            $process.StandardInput.WriteLine("keep $encoded")
            $process.StandardInput.Flush()
            $read = $process.StandardOutput.ReadLineAsync()
            $remaining = [int][Math]::Max(0, 25000 - $Clock.ElapsedMilliseconds)
            if (-not $read.Wait($remaining)) {
                $Receipt.Outcome = 'supervisor-startup-timeout'
                return
            }
            if ($read.Result) {
                $ack = $read.Result | ConvertFrom-Json
            }
            if ($ack.state -ne 'kept' -or $ack.hostPid -ne $process.Id) {
                $Receipt.SupervisorError = 'handoff-not-acknowledged'
                return
            }
            $keep = $true
            $Receipt.Wallpaper = $wallpaper
            $Receipt.HostReadyMs = $Clock.ElapsedMilliseconds
            $Receipt.HostReady = $true
            $Receipt.Outcome = 'wallpaper-ready'
            if ($ShowStartupPreview) {
                $Receipt.StartupPreview = 'timeout'
                $read = $process.StandardOutput.ReadLineAsync()
                $remaining = [int][Math]::Max(0, 25000 - $Clock.ElapsedMilliseconds)
                if ($read.Wait($remaining) -and $read.Result) {
                    $presentation = $read.Result | ConvertFrom-Json
                    if ($presentation.state -eq 'presentation' -and $presentation.hostPid -eq $process.Id -and
                        $presentation.status -in @('visible', 'disabled', 'timeout')) {
                        $Receipt.StartupPreview = $presentation.status
                        $Receipt.StartupPreviewInterfaceAt = $presentation.interfaceAt
                        $Receipt.StartupPreviewFirstFrameAt = $presentation.frameAt
                        $Receipt.StartupPreviewHandoffMs = $Clock.ElapsedMilliseconds
                        if ($presentation.status -ne 'timeout' -and
                            $env:CODEX_WALLPAPER_DESKTOP_HANDSHAKE -ceq '1') {
                            $Receipt.StartupPreviewSignalAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                            [Console]::WriteLine('CodexWallpaper:presented')
                        }
                    }
                }
            }
            return
        }
    } finally {
        try {
            $process.StandardInput.Close()
            if (-not $keep -and -not $process.WaitForExit(2000)) {
                try { $process.Kill() } catch [InvalidOperationException] {
                    if (-not $process.HasExited) { throw }
                }
            }
        } finally {
            $process.StandardOutput.Dispose()
            $process.StandardError.Dispose()
            $process.Dispose()
        }
    }
}

$receipt = $null
if ($Unattended) {
    $receipt = [ordered]@{
        Started = [DateTimeOffset]::Now.ToString('o'); Package = $null
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
    Write-DesktopError (Get-LaunchFailureMessage 'package-query-failed')
    Write-Host 'Codex package query failed. Use the original entry. No activation attempted.'
    exit 2
}
$package = if ($pkg.Count -eq 1) { $pkg[0] }
$packageName = $package.PackageFullName
if ($receipt) { $receipt.Package = $packageName }
if (-not $packageName -or $null -eq $package) {
    if ($receipt) {
        $receipt.Outcome = 'unsupported-package'
        Save-Receipt $receipt $stateFolder
    }
    Write-DesktopError (Get-LaunchFailureMessage 'unsupported-package')
    Write-Host 'Unsupported or ambiguous Codex package. Use the original entry. No activation attempted.'
    exit 2
}
$exe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
$compatibilityMode = 'known'
$knownHash = $supportedExeHashes[$packageName]
if (-not $knownHash -or (Get-FileSha256 $exe) -ine $knownHash) {
    $packageTrust = Test-TrackedCodexPackage $package
    if (-not $packageTrust.Trusted) {
        if ($receipt) {
            $receipt.Outcome = 'unsupported-package'
            $receipt.PackageTrustFailure = $packageTrust.Reason
            Save-Receipt $receipt $stateFolder
        }
        Write-DesktopError (Get-LaunchFailureMessage 'unsupported-package')
        Write-Host 'Unsupported or untrusted Codex package. Use the original entry. No activation attempted.'
        exit 2
    }
    $compatibilityMode = 'probe'
}
if ($receipt) { $receipt.CompatibilityMode = $compatibilityMode }
$packageProfile = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) `
    ('Packages\{0}\LocalCache\Roaming\Codex\web\Codex' -f $package.PackageFamilyName)

if (-not $Launch) {
    $processes = @(Get-CodexProcesses)
    $roots = @(Get-CodexRoots $processes)
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
    [pscustomobject]@{
        Mode = 'status-only'
        Package = $packageName
        CompatibilityMode = $compatibilityMode
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
$recoverableRoot = $null
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) {
        if ($receipt) { $receipt.Outcome = 'launcher-in-progress' }
        Write-DesktopError (Get-LaunchFailureMessage 'launcher-in-progress')
        Write-Host 'Another probe is in progress. No activation attempted.'
        exit 2
    }
    # Give a previous instance time to finish a user-initiated quit while this launch owns the mutex.
    $exitWait = [Diagnostics.Stopwatch]::StartNew()
    while ($true) {
        $processes = @(Get-CodexProcesses)
        $existingRoots = @(Get-CodexRoots $processes)
        if ($existingRoots.Count -eq 0 -or $exitWait.Elapsed.TotalSeconds -ge 4) { break }
        Start-Sleep -Milliseconds 300
    }
    if ($existingRoots.Count -gt 1) {
        if ($receipt) { $receipt.Outcome = 'multiple-main-processes' }
        Write-DesktopError (Get-LaunchFailureMessage 'multiple-main-processes')
        Write-Host 'Multiple Codex main processes were observed. No activation attempted.'
        exit 2
    }
    if ($existingRoots.Count -eq 1) {
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
        $recoverableRoot = Get-RecoverableRootState $existingRoots $processes $exe $stateFolder
        $hasDebugFlag = $existingRoots[0].CommandLine -match '(?:^|\s|\")--remote-debugging-(?:port|pipe)(?:=|\s|\"|$)'
        if ($recoverableRoot.State -ne 'recoverable') {
            $runningOutcome = if ($hasDebugFlag) { 'unverified-running-instance' } else { 'ordinary-instance-running' }
            if ($receipt) {
                $receipt.Outcome = $runningOutcome
            }
            Write-DesktopError (Get-LaunchFailureMessage $runningOutcome)
            if ($hasDebugFlag) {
                Write-Host 'Codex is already running, but no matching dedicated-launch receipt was found. Nothing was started, connected, or changed.'
            } else {
                Write-Host 'Codex is already running. Nothing was started or changed. Try only after manually quitting it.'
            }
            exit 2
        }
    }
    if (($compatibilityMode -eq 'known' -and (Get-FileSha256 $exe) -ine $supportedExeHashes[$packageName]) -or
        -not @(Get-StartApps | Where-Object AppID -eq $appId).Count) {
        if ($receipt) { $receipt.Outcome = 'executable-or-app-registration-mismatch' }
        Write-DesktopError (Get-LaunchFailureMessage 'executable-or-app-registration-mismatch')
        Write-Host 'Original executable or app registration did not match. No activation attempted.'
        exit 2
    }
    # The path reported by Owl can be backed by the registered package's LocalCache.
    # Check only existing directories; neither path is passed as a launch override.
    if (-not (Test-Path -LiteralPath $nativeProfile -PathType Container) -and
        -not (Test-Path -LiteralPath $packageProfile -PathType Container)) {
        if ($receipt) { $receipt.Outcome = 'daily-profile-missing' }
        Write-DesktopError (Get-LaunchFailureMessage 'daily-profile-missing')
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

    if ($recoverableRoot) {
        $root = $recoverableRoot.Root
        $port = [int]$recoverableRoot.Port
        $rootIdentity = '{0}:{1:o}' -f $root.ProcessId, $root.CreationDate
        $clock = [Diagnostics.Stopwatch]::StartNew()
        $observation = @{ ExpectedExecutable = $exe; Timeline = [Collections.Generic.List[object]]::new() }
        $receipt = [ordered]@{
            Started = [DateTimeOffset]::Now.ToString('o')
            Package = $packageName
            Port = $port
            Outcome = 'recovery-attach-started'
            Mode = 'failed-launch-recovery'
            CompatibilityMode = $compatibilityMode
            LoginAndChat = 'user-verification-required'
            ActivationPid = $root.ProcessId
            MainPid = $root.ProcessId
            MainCreated = $root.CreationDate.ToString('o')
            NativeProfile = Test-DailyProfile $root @(Get-CodexProcesses)
            RecoveryReceipt = $recoverableRoot.Receipt
        }
        Start-WallpaperSupervisor $node $PSScriptRoot $port $clock $receipt {
            $afterProcesses = @(Get-CodexProcesses)
            $after = @(Get-CodexRoots $afterProcesses)
            if ($after.Count -ne 1 -or
                ('{0}:{1:o}' -f $after[0].ProcessId, $after[0].CreationDate) -ne $rootIdentity -or
                $after[0].ExecutablePath -ine $exe -or
                [CodexWallpaperP0b.Native]::PackageName($after[0].ProcessId) -ne $packageName) {
                return 'main-process-changed'
            }
            if ((Test-DailyProfile $after[0] $afterProcesses) -ne 'matches-daily-path') { return 'profile-changed' }
            if (-not (Test-LoopbackOwner $port $root.ProcessId)) { return 'listener-changed' }
        }
        if ($receipt.Outcome -eq 'wallpaper-ready') {
            Save-DedicatedSession ([ordered]@{
                MainPid = $root.ProcessId
                MainCreated = $root.CreationDate.ToString('o')
                Port = $port
                Passed = [DateTimeOffset]::Now.ToString('o')
            }) $stateFolder
            $exitCode = 0
            Write-Host 'Recovered the matching failed dedicated launch and attached the wallpaper host.'
        } else {
            $exitCode = 2
            Write-DesktopError (Get-LaunchFailureMessage $receipt.Outcome)
            Write-Host "Outcome: $($receipt.Outcome)"
        }
        exit $exitCode
    }

    $candidate = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $candidate.Start()
    try { $port = $candidate.LocalEndpoint.Port } finally { $candidate.Stop() }
    $showStartupPreview = $false
    if ($env:CODEX_WALLPAPER_DESKTOP_HANDSHAKE -ceq '1') {
        # The desktop process acknowledges the first painted wallpaper frame before native activation.
        $loadingIcon = Join-Path $package.InstallLocation 'assets\Square44x44Logo.targetsize-80_altform-unplated.png'
        [Console]::WriteLine("CodexWallpaper:preview:$loadingIcon")
        $showStartupPreview = [Console]::ReadLine() -ceq 'shown'
    }
    if (@(Get-CodexRoots @(Get-CodexProcesses)).Count -ne 0) {
        if ($receipt) { $receipt.Outcome = 'main-process-appeared-during-preparation' }
        Write-DesktopError (Get-LaunchFailureMessage 'main-process-appeared-during-preparation')
        Write-Host 'Codex appeared during preparation. No activation attempted.'
        exit 2
    }
    $receiptMode = if ($receipt) { $receipt.Mode } else { $null }
    $receipt = [ordered]@{
        Started = [DateTimeOffset]::Now.ToString('o'); Package = $packageName; Port = $port
        Outcome = 'activation-attempted'; LoginAndChat = 'user-verification-required'
        CompatibilityMode = $compatibilityMode
    }
    if ($receiptMode) { $receipt.Mode = $receiptMode }
    $beforeLaunch = Get-Date
    $receipt.ActivationPid = [CodexWallpaperP0b.Native]::Activate($appId,
        "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$port")
    if ($showStartupPreview) {
        $receipt.StartupPreview = 'shown'
        [Console]::WriteLine('CodexWallpaper:activated')
    }

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
        Start-WallpaperSupervisor $node $PSScriptRoot $port $clock $receipt {
            do {
                $afterProcesses = @(Get-CodexProcesses)
                $afterSample = Get-StartupRootState $afterProcesses $observation $clock.ElapsedMilliseconds
                if ($afterSample.Outcome -eq 'multiple-main-processes') { return $afterSample.Outcome }
                if ($afterSample.Outcome -eq 'ambiguous') { Start-Sleep -Milliseconds 300 }
            } while ($afterSample.Outcome -eq 'ambiguous' -and $clock.Elapsed.TotalSeconds -lt 25)
            if ($clock.Elapsed.TotalSeconds -ge 25) { return 'supervisor-startup-timeout' }
            $after = $afterSample.Roots
            if ($after.Count -ne 1 -or ('{0}:{1:o}' -f $after[0].ProcessId, $after[0].CreationDate) -ne $rootIdentity -or
                $after[0].ExecutablePath -ine $exe -or [CodexWallpaperP0b.Native]::PackageName($root.ProcessId) -ne $packageName) {
                return 'main-process-changed'
            }
            if ((Test-DailyProfile $after[0] $afterProcesses) -ne 'matches-daily-path') { return 'profile-changed' }
            if (-not (Test-LoopbackOwner $port $root.ProcessId)) { return 'listener-changed' }
        } $showStartupPreview
        if ($receipt.Outcome -ne 'wallpaper-ready') { break }
        $dedicatedSession = [ordered]@{
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
    if ($receipt.Outcome -ne 'wallpaper-ready') {
        $exitCode = 2
        Write-DesktopError (Get-LaunchFailureMessage $receipt.Outcome)
    }
    Write-Host "Outcome: $($receipt.Outcome)"
    if ($receipt.Wallpaper) { Write-Host "Wallpaper: $($receipt.Wallpaper.state)" }
    Write-Host 'Verify the account and an existing chat yourself. If you see a login screen, do not sign in for this test.'
    Write-Host 'To remove the debug listener, quit this Codex normally, then use the original entry.'
} catch {
    if ($receipt) {
        $receipt.Outcome = 'launch-or-check-error'
        $receipt.ErrorType = $_.Exception.GetType().FullName
        $receipt.ErrorMessage = $_.Exception.Message
        if ($_.Exception.PSObject.Properties.Name -contains 'CommandName') {
            $receipt.ErrorCommand = $_.Exception.CommandName
        }
        if ($_.InvocationInfo) {
            $receipt.ErrorLine = $_.InvocationInfo.ScriptLineNumber
            $receipt.ErrorStatement = $_.InvocationInfo.Line.Trim()
        }
    }
    $exitCode = 2
    Write-DesktopError (Get-LaunchFailureMessage 'launch-or-check-error')
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
