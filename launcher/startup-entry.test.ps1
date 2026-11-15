# Exercises only a temporary per-user Startup folder. It never launches Codex or
# invokes the real Windows Startup folder.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-CodexWallpaper.ps1'
$tokens = $null
$errorsFound = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$errorsFound)
if ($errorsFound) { throw ($errorsFound | Out-String) }
foreach ($name in @('Get-WallpaperStartupEntryPath', 'Get-WallpaperStartupDescription', 'Get-WallpaperStartupArguments', 'Set-WallpaperStartup', 'Remove-WallpaperStartup', 'Get-WallpaperStartupStatus')) {
    $definition = $ast.Find({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $true)
    if (-not $definition) { throw "Missing launcher function: $name" }
    . ([scriptblock]::Create($definition.Extent.Text))
}

$folder = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-startup-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($folder)
$unrelated = Join-Path $folder 'Keep Me.lnk'
[IO.File]::WriteAllText($unrelated, 'fixture')
$entry = Get-WallpaperStartupEntryPath $folder
$powerShell = Join-Path $PSHOME 'powershell.exe'

try {
    Set-WallpaperStartup $folder $launcher $powerShell
    Set-WallpaperStartup $folder $launcher $powerShell
    $status = Get-WallpaperStartupStatus $folder $launcher $powerShell
    $links = @(Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File)
    if ($links.Count -ne 2 -or $status.Status -ne 'enabled' -or $status.EntryPath -ne $entry) {
        throw 'Expected exactly the dedicated Startup entry plus the unrelated fixture.'
    }
    if ($status.TargetPath -notmatch 'powershell\.exe$' -or
        $status.Arguments -notmatch '-WindowStyle Hidden' -or
        $status.Arguments -notmatch '-Launch -Unattended' -or
        $status.WindowStyle -ne 7) {
        throw 'The Startup entry must invoke the launcher hidden and unattended.'
    }

    Remove-WallpaperStartup $folder $launcher $powerShell
    $removed = Get-WallpaperStartupStatus $folder $launcher $powerShell
    if ($removed.Status -ne 'disabled' -or -not (Test-Path -LiteralPath $unrelated)) {
        throw 'Disable must remove only the dedicated entry.'
    }

    $shell = New-Object -ComObject WScript.Shell
    try {
        $foreign = $shell.CreateShortcut($entry)
        $foreign.TargetPath = $powerShell
        $foreign.Arguments = '-NoProfile'
        $foreign.Description = 'Another product'
        $foreign.Save()
    } finally {
        if ($foreign) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($foreign) }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)
    }
    Remove-WallpaperStartup $folder $launcher $powerShell
    if (-not (Test-Path -LiteralPath $entry)) { throw 'Disable must not remove a shortcut it does not own.' }
    Write-Host 'Passed: one hidden per-user Startup entry can be enabled, queried, and removed safely.'
} finally {
    if (Test-Path -LiteralPath $folder) { Remove-Item -LiteralPath $folder -Recurse -Force }
}
