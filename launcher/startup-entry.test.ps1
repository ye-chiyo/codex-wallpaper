# Exercises the public Startup switches against a temporary launcher copy whose
# only change is the per-user Startup folder lookup. It never launches Codex or
# touches the real Windows Startup folder.
$ErrorActionPreference = 'Stop'
$sourceLauncher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$powerShell = Join-Path $PSHOME 'powershell.exe'
$root = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-startup-' + [guid]::NewGuid().ToString('N'))
$startupFolder = Join-Path $root 'Startup'
$launcher = Join-Path $root 'Start-CodexWallpaper.ps1'
[void][IO.Directory]::CreateDirectory($startupFolder)

$lookup = "[Environment]::GetFolderPath('Startup')"
$source = [IO.File]::ReadAllText($sourceLauncher)
if ([regex]::Matches($source, [regex]::Escape($lookup)).Count -ne 1) {
    throw 'The Startup folder lookup must have exactly one launcher occurrence.'
}
$source = $source.Replace($lookup, '$env:CODEX_WALLPAPER_TEST_STARTUP_FOLDER')
[IO.File]::WriteAllText($launcher, $source, [Text.UTF8Encoding]::new($true))
$env:CODEX_WALLPAPER_TEST_STARTUP_FOLDER = $startupFolder

function Invoke-Launcher([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = (& $powerShell -NoProfile -File $launcher @Arguments 2>&1 | Out-String).Trim()
        [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Get-Status {
    $result = Invoke-Launcher @('-StartupStatus')
    if ($result.ExitCode -ne 0) { throw "Startup status failed: $($result.Output)" }
    $result.Output | ConvertFrom-Json
}

try {
    $unrelated = Join-Path $startupFolder 'Keep Me.lnk'
    [IO.File]::WriteAllText($unrelated, 'fixture')
    $entry = Join-Path $startupFolder 'Codex Wallpaper.lnk'

    $initial = Get-Status
    if ($initial.Status -ne 'disabled' -or $initial.EntryPath -ne $entry) {
        throw 'A missing dedicated entry must report disabled at the expected path.'
    }

    $enabled = Invoke-Launcher @('-EnableStartup')
    if ($enabled.ExitCode -ne 0) { throw "Startup enable failed: $($enabled.Output)" }
    [void](Invoke-Launcher @('-EnableStartup'))
    $status = Get-Status
    $links = @(Get-ChildItem -LiteralPath $startupFolder -Filter '*.lnk' -File)
    if ($links.Count -ne 2 -or $status.Status -ne 'enabled' -or $status.EntryPath -ne $entry) {
        throw 'Expected exactly the dedicated Startup entry plus the unrelated fixture.'
    }
    if ($status.TargetPath -notmatch 'powershell\.exe$' -or
        $status.Arguments -notmatch '-WindowStyle Hidden' -or
        $status.Arguments -notmatch '-Launch -Unattended' -or
        $status.WindowStyle -ne 7) {
        throw 'The Startup entry must invoke the launcher hidden and unattended.'
    }

    $disabled = Invoke-Launcher @('-DisableStartup')
    if ($disabled.ExitCode -ne 0) { throw "Startup disable failed: $($disabled.Output)" }
    $removed = Get-Status
    if ($removed.Status -ne 'disabled' -or -not (Test-Path -LiteralPath $unrelated)) {
        throw 'Disable must remove only the dedicated entry.'
    }

    $shell = New-Object -ComObject WScript.Shell
    $foreignArguments = '-NoProfile -NonInteractive -STA -WindowStyle Hidden -File "{0}" -Launch -Unattended' -f $launcher
    try {
        $foreign = $shell.CreateShortcut($entry)
        $foreign.TargetPath = $powerShell
        $foreign.Arguments = $foreignArguments
        $foreign.WorkingDirectory = $root
        $foreign.WindowStyle = 7
        $foreign.Description = 'Another product'
        $foreign.Save()
    } finally {
        if ($foreign) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($foreign) }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    }
    $foreignBytes = [Convert]::ToBase64String([IO.File]::ReadAllBytes($entry))
    $failedEnable = Invoke-Launcher @('-EnableStartup')
    $afterFailedEnable = [Convert]::ToBase64String([IO.File]::ReadAllBytes($entry))
    $foreignStatus = Get-Status
    if ($failedEnable.ExitCode -eq 0 -or $foreignBytes -ne $afterFailedEnable -or
        $foreignStatus.Status -ne 'stale' -or $foreignStatus.Description -ne 'Another product' -or
        $foreignStatus.Arguments -ne $foreignArguments) {
        throw 'Enable must leave an unowned same-name shortcut and its status unchanged.'
    }

    $conflict = Invoke-Launcher @('-EnableStartup', '-DisableStartup')
    if ($conflict.ExitCode -eq 0 -or $conflict.Output -notmatch 'Choose only one Startup action') {
        throw 'The public Startup switches must remain mutually exclusive.'
    }
    Write-Host 'Passed: public Startup switches safely enable, query, disable, and reject conflicts in a temporary folder.'
} finally {
    Remove-Item Env:\CODEX_WALLPAPER_TEST_STARTUP_FOLDER -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
