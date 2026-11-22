[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$localRoot = [IO.Path]::GetFullPath([Environment]::GetFolderPath('LocalApplicationData'))
$target = [IO.Path]::GetFullPath((Join-Path $localRoot 'CodexWallpaper'))
if (-not $target.StartsWith($localRoot + [IO.Path]::DirectorySeparatorChar,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing to remove a path outside LocalApplicationData.'
}

if (Test-Path -LiteralPath $target) {
    if ($PSCmdlet.ShouldProcess($target, 'Remove CodexWallpaper receipts and local files')) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}

Write-Host 'Codex, its package, profile, login state, and chats were not changed.'
Write-Host 'If Codex is running, use the in-app stop button first to clear its page storage and imported media.'
