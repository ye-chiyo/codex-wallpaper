$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('codex-wallpaper-desktop-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)

function Remove-TestDirectory($Path) {
    for ($attempt = 1; $attempt -le 10; $attempt += 1) {
        try {
            [IO.Directory]::Delete($Path, $true)
            return
        } catch [IO.IOException], [UnauthorizedAccessException] {
            if ($attempt -eq 10) { throw }
            Start-Sleep -Milliseconds 200
        }
    }
}

try {
    $compiler = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
    $source = Join-Path $PSScriptRoot 'CodexWallpaperDesktop.cs'
    $entry = Join-Path $root 'CodexWallpaper.exe'
    $references = @('/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Web.Extensions.dll')
    & $compiler /nologo /target:winexe /optimize+ @references "/out:$entry" $source
    if ($LASTEXITCODE -ne 0) { throw 'Desktop launcher compilation failed.' }

    $exe = [IO.File]::ReadAllBytes($entry)
    $peOffset = [BitConverter]::ToInt32($exe, 0x3c)
    if ([BitConverter]::ToUInt16($exe, $peOffset + 24 + 68) -ne 2) {
        throw 'The shortcut target must use the Windows GUI subsystem.'
    }

    $fixtureName = 'Check ' + [char]0x58C1 + [char]0x7EB8 + '.ps1'
    $fixture = Join-Path $root $fixtureName
    $report = Join-Path $root 'invocations.txt'
    @'
param([switch]$Launch)
$ErrorActionPreference = 'Stop'
Add-Type -Namespace CodexWallpaperTest -Name Console -MemberDefinition @"
    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    public static extern System.IntPtr GetConsoleWindow();
"@
if (-not $Launch -or [Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') { exit 2 }
if ([CodexWallpaperTest.Console]::GetConsoleWindow() -ne [IntPtr]::Zero) { exit 3 }
if ([Environment]::CurrentDirectory -ne $PSScriptRoot) { exit 4 }
Add-Content -LiteralPath (Join-Path $PSScriptRoot 'invocations.txt') -Value 'launched'
exit 17
'@ | Set-Content -LiteralPath $fixture -Encoding UTF8

    $process = Start-Process -FilePath $entry -ArgumentList ('"{0}"' -f $fixture) -PassThru
    try {
        if (-not $process.WaitForExit(10000)) { throw 'Desktop launcher timed out.' }
        if ($process.ExitCode -ne 17 -or (@(Get-Content -LiteralPath $report) -join ',') -ne 'launched') {
            throw "Expected one console-free PowerShell invocation and exit code 17. Got exit code $($process.ExitCode)."
        }
    } finally {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
    }
    Write-Host 'Passed: GUI launcher calls its Windows PowerShell script once without a console.'

    @'
param([switch]$Launch)
$psi = [Diagnostics.ProcessStartInfo]::new(
    (Join-Path $PSHOME 'powershell.exe'),
    '-NoProfile -NonInteractive -Command "Start-Sleep -Seconds 7"'
)
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
# The background child keeps an inherited copy of our output pipe.
$psi.RedirectStandardInput = $true
$psi.WorkingDirectory = $env:SystemRoot
$child = [Diagnostics.Process]::Start($psi)
$child.Dispose()
exit 17
'@ | Set-Content -LiteralPath $fixture -Encoding UTF8
    $process = Start-Process -FilePath $entry -ArgumentList ('"{0}"' -f $fixture) -PassThru
    try {
        if (-not $process.WaitForExit(4800) -or $process.ExitCode -ne 17) {
            throw 'Graphics launcher should exit with its script while a background child holds the output pipe.'
        }
    } finally {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
    }
    Write-Host 'Passed: a background child holding stdout cannot postpone desktop handoff.'

    $driverSource = Join-Path $root 'DesktopPreviewTest.cs'
    @'
using System;
using System.Diagnostics;
using System.Drawing;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

internal static class DesktopPreviewTest
{
    [STAThread]
    private static int Main(string[] args)
    {
        var area = Screen.PrimaryScreen.WorkingArea;
        if (args[0] == "--animation") return CheckAnimation(args[1], args[2], area);
        if (args[0] == "--video") return CheckVideo(args[1], args[2], area);
        // Exercise the real paint callback in a 2 × 2 tool window at the edge of the screen.
        return CodexWallpaperDesktop.Run(args[0], args[1], new Rectangle(area.Right - 2, area.Bottom - 2, 2, 2));
    }

    private static int CheckAnimation(string cache, string icon, Rectangle area)
    {
        var bounds = new Rectangle(area.Left - 300, area.Top, 240, 150);
        using (var screen = StartupScreen.TryOpen(cache, icon, bounds))
        using (var before = new Bitmap(bounds.Width, bounds.Height))
        using (var first = new Bitmap(bounds.Width, bounds.Height))
        using (var second = new Bitmap(bounds.Width, bounds.Height))
        {
            if (screen == null) return 20;
            bool shown = false;
            screen.ShowUntilHandoff(value => shown = value);
            Pump(100);
            if (!shown) return 21;
            var rectangle = screen.ClientRectangle;
            screen.DrawToBitmap(before, rectangle);
            // A square, solid fallback is contained in a wide window, even if the fit is cover.
            if (before.GetPixel(0, 75).G >= 50 || before.GetPixel(120, 20).G <= 90) return 22;
            screen.ShowLoadingIcon();
            Pump(260);
            screen.DrawToBitmap(first, rectangle);
            Pump(220);
            screen.DrawToBitmap(second, rectangle);
            int centeredChanges = 0;
            for (int y = 0; y < rectangle.Height; y++)
            for (int x = 0; x < rectangle.Width; x++)
            {
                if (first.GetPixel(x, y) != second.GetPixel(x, y)) return 23;
                if (before.GetPixel(x, y) == first.GetPixel(x, y)) continue;
                if (Math.Abs(x - 120) > 24 || Math.Abs(y - 75) > 24) return 24;
                centeredChanges++;
            }
            if (centeredChanges < 20) return 25;
            bool revealed = false;
            screen.RevealInterface(() => revealed = true);
            Pump(270);
            if (!revealed || screen.Visible) return 26;
            var timer = (System.Windows.Forms.Timer)typeof(StartupScreen)
                .GetField("animation", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(screen);
            return timer.Enabled ? 27 : 0;
        }
    }

    private static int CheckVideo(string cache, string icon, Rectangle area)
    {
        var bounds = new Rectangle(area.Left - 380, area.Top, 320, 180);
        using (var screen = StartupScreen.TryOpen(cache, icon, bounds))
        using (var frame = new Bitmap(bounds.Width, bounds.Height))
        {
            if (screen == null) return 30;
            screen.ShowUntilHandoff(_ => {});
            bool red = false, blue = false;
            var clock = Stopwatch.StartNew();
            while (clock.ElapsedMilliseconds < 3300 && !(red && blue))
            {
                Pump(60);
                screen.DrawToBitmap(frame, screen.ClientRectangle);
                var pixel = frame.GetPixel(30, 30);
                red |= pixel.R > 120 && pixel.B < 60;
                blue |= pixel.B > 120 && pixel.R < 60;
            }
            screen.Hide();
            return red && blue ? 0 : 31;
        }
    }

    private static void Pump(int milliseconds)
    {
        var clock = Stopwatch.StartNew();
        do
        {
            Application.DoEvents();
            Thread.Sleep(10);
        } while (clock.ElapsedMilliseconds < milliseconds);
    }
}
'@ | Set-Content -LiteralPath $driverSource -Encoding UTF8
    $driver = Join-Path $root 'DesktopPreviewTest.exe'
    & $compiler /nologo /target:winexe /main:DesktopPreviewTest @references "/out:$driver" $source $driverSource
    if ($LASTEXITCODE -ne 0) { throw 'Desktop startup preview fixture compilation failed.' }

    Add-Type -AssemblyName System.Drawing
    $icon = Join-Path $root 'icon.png'
    $bitmap = [System.Drawing.Bitmap]::new(32, 32)
    try {
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        try { $graphics.FillEllipse([Drawing.Brushes]::White, 5, 5, 22, 22) } finally { $graphics.Dispose() }
        $bitmap.Save($icon, [Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
    $cache = Join-Path $root 'preview.json'
    $poster = 'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($icon))
    @'
param([switch]$Launch)
if (-not $Launch -or $env:CODEX_WALLPAPER_DESKTOP_HANDSHAKE -ne '1') { exit 2 }
$icon = Join-Path $PSScriptRoot 'icon.png'
[Console]::WriteLine("CodexWallpaper:preview:$icon")
if ([Console]::ReadLine() -ne $env:CODEX_WALLPAPER_EXPECT_PREVIEW) { exit 3 }
if ($env:CODEX_WALLPAPER_EXPECT_PREVIEW -eq 'shown') { [Console]::WriteLine('CodexWallpaper:activated') }
exit 17
'@ | Set-Content -LiteralPath $fixture -Encoding UTF8

    foreach ($case in @(
        @{ Value = @{ enabled = $true; poster = $poster; opacity = 100; dim = 50 }; Expected = 'shown' },
        @{ Value = @{ enabled = $false; poster = $poster; opacity = 100 }; Expected = 'skip' },
        @{ Value = @{ enabled = $true; poster = 'data:image/jpeg;base64,invalid'; opacity = 100 }; Expected = 'skip' }
    )) {
        $case.Value | ConvertTo-Json | Set-Content -LiteralPath $cache -Encoding UTF8
        $env:CODEX_WALLPAPER_EXPECT_PREVIEW = $case.Expected
        $process = Start-Process -FilePath $driver -ArgumentList ('"{0}" "{1}"' -f $fixture, $cache) -PassThru
        try {
            if (-not $process.WaitForExit(10000)) { throw 'Desktop startup preview fixture timed out.' }
            if ($process.ExitCode -ne 17) { throw "Expected preview $($case.Expected), exit code $($process.ExitCode)." }
        } finally {
            if (-not $process.HasExited) { $process.Kill() }
            $process.Dispose()
        }
    }
    Write-Host 'Passed: valid preview acknowledges after paint, disabled and corrupt previews skip the window.'

    Add-Type -TypeDefinition @'
public static class DesktopPreviewVisibility {
    private delegate bool Visit(System.IntPtr window, System.IntPtr unused);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool EnumWindows(Visit visit, System.IntPtr unused);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool IsWindowVisible(System.IntPtr window);
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(System.IntPtr window, out uint pid);
    public static bool IsVisible(uint pid) {
        bool visible = false;
        EnumWindows((window, unused) => {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            visible = owner == pid && IsWindowVisible(window);
            return !visible;
        }, System.IntPtr.Zero);
        return visible;
    }
}
'@
    @{ enabled = $true; poster = $poster; opacity = 100 } |
        ConvertTo-Json | Set-Content -LiteralPath $cache -Encoding UTF8
    @'
param([switch]$Launch)
[Console]::WriteLine("CodexWallpaper:preview:$(Join-Path $PSScriptRoot 'icon.png')")
if ([Console]::ReadLine() -ne 'shown') { exit 3 }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'preview-painted'), '')
$clock = [Diagnostics.Stopwatch]::StartNew()
while (-not [IO.File]::Exists((Join-Path $PSScriptRoot 'present')) -and $clock.ElapsedMilliseconds -lt 4000) {
    Start-Sleep -Milliseconds 20
}
[Console]::WriteLine('CodexWallpaper:presented')
Start-Sleep -Seconds 2
exit 0
'@ | Set-Content -LiteralPath $fixture -Encoding UTF8
    $process = Start-Process -FilePath $driver -ArgumentList ('"{0}" "{1}"' -f $fixture, $cache) -PassThru
    try {
        $clock = [Diagnostics.Stopwatch]::StartNew()
        while (-not [IO.File]::Exists((Join-Path $root 'preview-painted')) -and $clock.ElapsedMilliseconds -lt 3000) {
            Start-Sleep -Milliseconds 20
        }
        if (-not [DesktopPreviewVisibility]::IsVisible($process.Id)) {
            throw 'Startup overlay must stay visible before the presentation signal.'
        }
        $clock.Restart()
        [IO.File]::WriteAllText((Join-Path $root 'present'), '')
        while ([DesktopPreviewVisibility]::IsVisible($process.Id) -and $clock.ElapsedMilliseconds -lt 500) {
            Start-Sleep -Milliseconds 12
        }
        if ([DesktopPreviewVisibility]::IsVisible($process.Id) -or $process.HasExited) {
            throw 'Startup overlay should fade before the script finishes writing its receipt.'
        }
        Write-Host "Passed: presentation signal hid the overlay in $($clock.ElapsedMilliseconds) ms while the launcher script was still running."
        if (-not $process.WaitForExit(3500) -or $process.ExitCode -ne 0) {
            throw 'Desktop launcher should still return the script exit code.'
        }
    } finally {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
    }

    $testPoster = Join-Path $root 'square.png'
    $bitmap = [System.Drawing.Bitmap]::new(32, 32)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try { $graphics.Clear([Drawing.Color]::Teal) } finally { $graphics.Dispose() }
        $bitmap.Save($testPoster, [Drawing.Imaging.ImageFormat]::Png)
    } finally { $bitmap.Dispose() }
    @{
        enabled = $true; opacity = 100; fitMode = 'cover'; source = 'workshop-preview'
        poster = 'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($testPoster))
    } | ConvertTo-Json | Set-Content -LiteralPath $cache -Encoding UTF8
    $process = Start-Process -FilePath $driver -ArgumentList ('--animation "{0}" "{1}"' -f $cache, $icon) -PassThru
    try {
        if (-not $process.WaitForExit(10000)) { throw 'Desktop loading animation fixture timed out.' }
        if ($process.ExitCode -ne 0) { throw "Desktop loading animation fixture failed with exit code $($process.ExitCode)." }
    } finally {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
    }
    Write-Host 'Passed: square fallback keeps its proportions; the mark settles in the center and the overlay fades out.'

    $decoder = Get-Command ffmpeg.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($decoder) {
        $video = Join-Path $root 'fixture.mp4'
        & $decoder.Source -nostdin -v error -f lavfi -i 'color=red:s=320x180:r=24:d=0.5' -f lavfi -i 'color=blue:s=320x180:r=24:d=0.5' -filter_complex '[0:v][1:v]concat=n=2:v=1:a=0' -c:v libx264 -pix_fmt yuv420p $video
        if ($LASTEXITCODE -ne 0) { throw 'Startup video fixture encoding failed.' }
        @{
            enabled = $true; opacity = 100; fitMode = 'cover'; source = 'media'
            poster = 'data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes($testPoster))
            videoPath = $video; motionWidth = 320; motionHeight = 180
        } | ConvertTo-Json | Set-Content -LiteralPath $cache -Encoding UTF8
        $process = Start-Process -FilePath $driver -ArgumentList ('--video "{0}" "{1}"' -f $cache, $icon) -PassThru
        try {
            if (-not $process.WaitForExit(10000)) { throw 'Desktop video fixture timed out.' }
            if ($process.ExitCode -ne 0) { throw "Desktop video fixture failed with exit code $($process.ExitCode)." }
        } finally {
            if (-not $process.HasExited) { $process.Kill() }
            $process.Dispose()
        }
        Write-Host 'Passed: the wallpaper presents both source video frames before any loading mark.'
    } else {
        Write-Host 'Skipped: ffmpeg.exe is unavailable for the native video fixture.'
    }
} finally {
    Remove-Item Env:\CODEX_WALLPAPER_EXPECT_PREVIEW -ErrorAction SilentlyContinue
    Remove-TestDirectory $root
}
