using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class CodexWallpaperDesktop
{
    private const string PreviewRequest = "CodexWallpaper:preview:";
    private const string ErrorRequest = "CodexWallpaper:error:";

    [DllImport("user32.dll")]
    private static extern bool SetProcessDpiAwarenessContext(IntPtr value);

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 1 || !Path.IsPathRooted(args[0]) || !File.Exists(args[0]))
            return 2;

        // Keep the wallpaper in physical pixels on high-DPI monitors.
        SetProcessDpiAwarenessContext(new IntPtr(-4)); // Per Monitor V2.
        string launcher = Path.GetFullPath(args[0]);
        string cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            @"CodexWallpaper\P0b\startup-preview.json");
        return Run(launcher, cache, Screen.FromPoint(Cursor.Position).WorkingArea);
    }

    internal static int Run(string launcher, string cache, Rectangle bounds)
    {
        bool showFailureDialog =
            Environment.GetEnvironmentVariable("CODEX_WALLPAPER_SUPPRESS_ERROR_UI") != "1";
        var start = new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"),
            Arguments = "-NoProfile -NonInteractive -STA -File \"" + launcher + "\" -Launch",
            WorkingDirectory = Path.GetDirectoryName(launcher),
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        start.EnvironmentVariables["CODEX_WALLPAPER_DESKTOP_HANDSHAKE"] = "1";
        string playbackClock = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(cache)),
            "startup-clock-" + Guid.NewGuid().ToString("N") + ".txt");
        start.EnvironmentVariables["CODEX_WALLPAPER_PLAYBACK_CLOCK"] = playbackClock;

        var exitCode = 1;
        string failureMessage = null;
        string lastOutput = null;
        string lastError = null;
        StartupScreen screen = null;
        using (var dispatcher = new Control())
        using (var app = new ApplicationContext())
        using (Process process = Process.Start(start))
        {
            var handle = dispatcher.Handle;
            bool requested = false;
            bool scriptExited = false;
            bool fadeStarted = false;
            bool fadeFinished = false;
            Action reveal = () =>
            {
                if (fadeStarted || screen == null || !screen.Visible) return;
                fadeStarted = true;
                screen.RevealInterface(() =>
                {
                    fadeFinished = true;
                    if (scriptExited) app.ExitThread();
                });
            };
            process.OutputDataReceived += (sender, eventArgs) =>
            {
                string message = eventArgs.Data;
                if (message == null) return;
                if (message.StartsWith(PreviewRequest, StringComparison.Ordinal))
                {
                    dispatcher.BeginInvoke((Action)(() =>
                    {
                        if (requested) return;
                        requested = true;
                        Action<bool> acknowledge = shown =>
                        {
                            try { process.StandardInput.WriteLine(shown ? "shown" : "skip"); }
                            catch (IOException) { }
                        };
                        screen = StartupScreen.TryOpen(cache, message.Substring(PreviewRequest.Length), bounds, playbackClock);
                        if (screen == null) acknowledge(false);
                        else screen.ShowUntilHandoff(acknowledge);
                    }));
                }
                else if (message.StartsWith(ErrorRequest, StringComparison.Ordinal))
                {
                    try
                    {
                        failureMessage = Encoding.UTF8.GetString(
                            Convert.FromBase64String(message.Substring(ErrorRequest.Length)));
                    }
                    catch (FormatException)
                    {
                        failureMessage = "Codex \u58C1\u7EB8\u6CA1\u6709\u6210\u529F\u542F\u52A8\uFF0CCodex \u539F\u754C\u9762\u5DF2\u4FDD\u7559\u3002";
                    }
                }
                else if (message == "CodexWallpaper:activated")
                    dispatcher.BeginInvoke((Action)(() => { if (screen != null) screen.ShowLoadingIcon(); }));
                else if (message == "CodexWallpaper:presented")
                    dispatcher.BeginInvoke(reveal);
                else if (!string.IsNullOrWhiteSpace(message))
                    lastOutput = message;
            };
            process.ErrorDataReceived += (sender, eventArgs) =>
            {
                if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                    lastError = eventArgs.Data;
            };
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            Task.Run(() =>
            {
                // The supervisor can inherit stdout and outlive PowerShell. A timed
                // wait returns on process exit without waiting for the pipe to close.
                process.WaitForExit(Int32.MaxValue);
                process.CancelOutputRead();
                process.CancelErrorRead();
                exitCode = process.ExitCode;
                dispatcher.BeginInvoke((Action)(() =>
                {
                    scriptExited = true;
                    if (exitCode == 0) reveal();
                    if (exitCode != 0)
                    {
                        if (screen != null) screen.Hide();
                        if (showFailureDialog)
                            ShowFailureDialog(failureMessage ?? lastOutput ?? lastError);
                        app.ExitThread();
                    }
                    else if (!fadeStarted || fadeFinished)
                        app.ExitThread();
                }));
            });
            Application.Run(app);
            if (screen != null) screen.Dispose();
        }
        try { File.Delete(playbackClock); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return exitCode;
    }

    private static void ShowFailureDialog(string detail)
    {
        if (string.IsNullOrWhiteSpace(detail))
            detail = "Codex \u58C1\u7EB8\u6CA1\u6709\u6210\u529F\u542F\u52A8\u3002";
        string preserved = "Codex \u539F\u754C\u9762\u5DF2\u4FDD\u7559\u3002";
        string message = detail.Trim();
        if (!message.Contains(preserved))
            message += "\r\n\r\n" + preserved;
        MessageBox.Show(
            message,
            "Codex \u58C1\u7EB8\u542F\u52A8\u5931\u8D25",
            MessageBoxButtons.OK,
            MessageBoxIcon.Error);
    }
}

internal sealed class StartupScreen : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmFlush();

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr window);

    internal sealed class Preferences
    {
        public bool enabled { get; set; }
        public string poster { get; set; }
        public float opacity { get; set; }
        public float dim { get; set; }
        public string fitMode { get; set; }
        public string source { get; set; }
        public string kind { get; set; }
        public string id { get; set; }
        public string videoPath { get; set; }
        public string motionFile { get; set; }
        public int motionWidth { get; set; }
        public int motionHeight { get; set; }
    }

    private readonly Bitmap poster;
    private readonly Bitmap icon;
    private readonly Preferences preferences;
    private readonly Timer firstPaint = new Timer { Interval = 2000 };
    private readonly Timer handoff = new Timer { Interval = 30000 };
    private readonly Timer animation = new Timer { Interval = 16 };
    private readonly Stopwatch loadingClock = new Stopwatch();
    private readonly Stopwatch revealClock = new Stopwatch();
    private readonly StartupVideo video;
    private readonly string playbackClock;
    private bool startedVideo;
    private Action<bool> acknowledge;
    private Action completeReveal;
    private Bitmap background;

    private StartupScreen(Bitmap poster, Bitmap icon, Preferences preferences, Rectangle bounds, StartupVideo video,
        string playbackClock)
    {
        this.poster = poster;
        this.icon = icon;
        this.preferences = preferences;
        this.video = video;
        this.playbackClock = playbackClock;
        StartPosition = FormStartPosition.Manual;
        FormBorderStyle = FormBorderStyle.None;
        Bounds = bounds;
        TopMost = true;
        ShowInTaskbar = false;
        DoubleBuffered = true;
        // A layered window keeps the covered Chromium surface eligible to paint.
        Opacity = 0.99;
        firstPaint.Tick += (sender, args) => CompleteFirstPaint(false);
        handoff.Tick += (sender, args) => { handoff.Stop(); Hide(); };
        animation.Tick += (sender, args) => Animate();
    }

    protected override bool ShowWithoutActivation { get { return true; } }

    protected override CreateParams CreateParams
    {
        get
        {
            var parameters = base.CreateParams;
            parameters.ExStyle |= 0x08000000 | 0x00000080 | 0x00000020; // No activate, tool window, mouse pass-through.
            return parameters;
        }
    }

    internal static StartupScreen TryOpen(string cache, string iconPath, Rectangle bounds, string playbackClock = null)
    {
        Bitmap poster = null;
        Bitmap icon = null;
        try
        {
            Preferences preferences;
            using (var input = new FileStream(cache, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (var reader = new StreamReader(input))
            {
                if (input.Length > 6000000) return null;
                preferences = new JavaScriptSerializer { MaxJsonLength = 6000000 }
                    .Deserialize<Preferences>(reader.ReadToEnd());
            }
            if (preferences == null || !preferences.enabled || preferences.opacity <= 0)
                return null;
            if (preferences.poster != null && preferences.poster.StartsWith("data:image/", StringComparison.Ordinal))
            {
                int separator = preferences.poster.IndexOf(',');
                if (separator < 0) return null;
                using (var stream = new MemoryStream(Convert.FromBase64String(preferences.poster.Substring(separator + 1))))
                using (var image = Image.FromStream(stream, false, true))
                {
                    if (image.Width > 8192 || image.Height > 8192) return null;
                    poster = new Bitmap(image);
                }
            }
            if (poster == null) return null;
            using (var image = Image.FromFile(iconPath)) icon = new Bitmap(image);
            var video = StartupVideo.TryOpen(cache, preferences, bounds.Size);
            return new StartupScreen(poster, icon, preferences, bounds, video, playbackClock);
        }
        catch (Exception error)
        {
            if (poster != null) poster.Dispose();
            if (icon != null) icon.Dispose();
            if (!(error is IOException || error is ArgumentException || error is FormatException ||
                error is InvalidOperationException || error is ExternalException ||
                error is UnauthorizedAccessException || error is OutOfMemoryException)) throw;
            return null;
        }
    }

    internal void ShowUntilHandoff(Action<bool> onFirstPaint)
    {
        acknowledge = onFirstPaint;
        firstPaint.Start();
        Show();
        if (video != null)
        {
            video.Start();
            animation.Start();
        }
    }

    internal void ShowLoadingIcon()
    {
        if (!Visible || loadingClock.IsRunning) return;
        loadingClock.Start();
        animation.Start();
        Invalidate(LoadingBounds);
    }

    internal void RevealInterface(Action completed)
    {
        completeReveal = completed;
        revealClock.Start();
        animation.Start();
    }

    private void Animate()
    {
        if (revealClock.IsRunning)
        {
            double remaining = 1 - revealClock.Elapsed.TotalMilliseconds / 160;
            if (remaining <= 0)
            {
                Hide();
                completeReveal();
                return;
            }
            Opacity = Math.Min(0.99, remaining);
        }
        if (video != null && video.HasFrame) Invalidate();
        if (loadingClock.IsRunning && loadingClock.ElapsedMilliseconds < 190) Invalidate(LoadingBounds);
        else if (video == null && !revealClock.IsRunning) animation.Stop();
    }

    protected override void OnVisibleChanged(EventArgs args)
    {
        base.OnVisibleChanged(args);
        if (Visible) return;
        animation.Stop();
        loadingClock.Reset();
        revealClock.Reset();
        if (video != null) video.Dispose();
    }

    private void CompleteFirstPaint(bool shown)
    {
        if (acknowledge == null) return;
        var callback = acknowledge;
        acknowledge = null;
        firstPaint.Stop();
        if (shown)
        {
            DwmFlush();
            handoff.Start();
        }
        else Hide();
        callback(shown);
    }

    protected override void OnPaint(PaintEventArgs args)
    {
        if (ClientSize.Width <= 0 || ClientSize.Height <= 0) return;
        var frame = video != null ? video.TakeFrame(background) : null;
        if (frame != null)
        {
            background = frame;
            if (!startedVideo && playbackClock != null && preferences.videoPath != null &&
                preferences.kind == "workshop" &&
                System.Text.RegularExpressions.Regex.IsMatch(preferences.id ?? "", @"\A[0-9]{1,20}\z"))
            {
                startedVideo = true;
                try
                {
                    long started = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    File.WriteAllText(playbackClock, preferences.id + ":" + started.ToString(System.Globalization.CultureInfo.InvariantCulture));
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
        }
        var clip = args.ClipRectangle;
        PaintWallpaper(args.Graphics, background ?? poster);
        if (loadingClock.IsRunning && clip.IntersectsWith(LoadingBounds))
            PaintLoadingIcon(args.Graphics);
        if (acknowledge != null) BeginInvoke((Action)(() => CompleteFirstPaint(true)));
    }

    private void PaintWallpaper(Graphics graphics, Bitmap image)
    {
        graphics.Clear(Color.FromArgb(22, 22, 27));
        graphics.InterpolationMode = InterpolationMode.HighQualityBilinear;
        float horizontal = (float)ClientSize.Width / image.Width;
        float vertical = (float)ClientSize.Height / image.Height;
        // Scene captures already include the renderer's fit. Older caches have no source
        // marker and can contain square author thumbnails, so they also keep their edges.
        bool cover = preferences.source == "media" && preferences.fitMode == "cover";
        float scale = cover ? Math.Max(horizontal, vertical) : Math.Min(horizontal, vertical);
        int width = (int)Math.Round(image.Width * scale);
        int height = (int)Math.Round(image.Height * scale);
        var destination = new Rectangle((ClientSize.Width - width) / 2, (ClientSize.Height - height) / 2, width, height);
        if (preferences.opacity >= 100)
            graphics.DrawImage(image, destination);
        else using (var attributes = new ImageAttributes())
        {
            var color = new ColorMatrix { Matrix33 = Math.Max(0, Math.Min(100, preferences.opacity)) / 100 };
            attributes.SetColorMatrix(color);
            graphics.DrawImage(image, destination, 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
        }
        using (var dim = new SolidBrush(Color.FromArgb((int)(2.55 * Math.Max(0, Math.Min(100, preferences.dim))), 4, 6, 15)))
            graphics.FillRectangle(dim, ClientRectangle);
    }

    private Rectangle LoadingBounds
    {
        get
        {
            int dpi = IsHandleCreated ? (int)GetDpiForWindow(Handle) : 96;
            int size = Math.Min(48 * dpi / 96, Math.Min(ClientSize.Width, ClientSize.Height));
            return new Rectangle((ClientSize.Width - size) / 2, (ClientSize.Height - size) / 2, size, size);
        }
    }

    private void PaintLoadingIcon(Graphics graphics)
    {
        var bounds = LoadingBounds;
        if (bounds.Width < 16) return;
        graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
        float progress = (float)Math.Min(1, loadingClock.Elapsed.TotalMilliseconds / 170);
        using (var attributes = new ImageAttributes())
        {
            attributes.SetColorMatrix(new ColorMatrix { Matrix33 = 0.92f * progress });
            graphics.DrawImage(icon, bounds, 0, 0, icon.Width, icon.Height, GraphicsUnit.Pixel, attributes);
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            Hide();
            animation.Dispose();
            firstPaint.Dispose();
            handoff.Dispose();
            if (background != null) background.Dispose();
            if (video != null) video.Dispose();
            poster.Dispose();
            icon.Dispose();
        }
        base.Dispose(disposing);
    }
}

internal sealed class StartupVideo : IDisposable
{
    private readonly ProcessStartInfo start;
    private readonly int width;
    private readonly int height;
    private readonly object gate = new object();
    private bool closed;
    private Process child;
    private Bitmap nextFrame;
    private Bitmap spareFrame;

    private StartupVideo(string decoder, string path, string format, int width, int height)
    {
        this.width = width;
        this.height = height;
        start = new ProcessStartInfo
        {
            FileName = decoder,
            Arguments = "-nostdin -loglevel quiet -threads 2 -filter_threads 1 -stream_loop -1 -re " +
                "-protocol_whitelist file,pipe -f " + format + " -i \"" + path + "\" -map 0:v:0 -an -sn -dn " +
                "-vf \"fps=24,scale=" + width + ":" + height + ":flags=bilinear\" -pix_fmt bgr0 -f rawvideo pipe:1",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true
        };
    }

    internal static StartupVideo TryOpen(string cache, StartupScreen.Preferences preferences, Size bounds)
    {
        string path = null;
        if (preferences.motionFile != null &&
            System.Text.RegularExpressions.Regex.IsMatch(preferences.motionFile, @"\Astartup-motion-[0-9a-f-]{36}\.webm\z"))
            path = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(cache)), preferences.motionFile);
        else if (preferences.videoPath != null && Path.IsPathRooted(preferences.videoPath) &&
            !preferences.videoPath.StartsWith(@"\\", StringComparison.Ordinal))
            path = preferences.videoPath;
        if (!File.Exists(path)) return null;
        string extension = Path.GetExtension(path).ToLowerInvariant();
        string format = extension == ".mp4" ? "mov" : extension == ".webm" ? "matroska" : null;
        if (format == null || preferences.motionWidth < 16 || preferences.motionWidth > 8192 ||
            preferences.motionHeight < 16 || preferences.motionHeight > 8192) return null;

        string decoder = null;
        foreach (string item in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            var directory = item.Trim().Trim('"');
            if (!Path.IsPathRooted(directory) || directory.StartsWith(@"\\", StringComparison.Ordinal))
                continue;
            var candidate = Path.Combine(directory, "ffmpeg.exe");
            if (!File.Exists(candidate)) continue;
            decoder = candidate;
            break;
        }
        if (decoder == null) return null;

        int width = preferences.motionWidth, height = preferences.motionHeight;
        bool cover = preferences.source == "media" && preferences.fitMode == "cover";
        double horizontal = (double)bounds.Width / width, vertical = (double)bounds.Height / height;
        double ratio = Math.Min(1, Math.Min(2560.0 / Math.Max(width, height),
            cover ? Math.Max(horizontal, vertical) : Math.Min(horizontal, vertical)));
        return new StartupVideo(decoder, path, format, Math.Max(2, (int)Math.Round(width * ratio)),
            Math.Max(2, (int)Math.Round(height * ratio)));
    }

    internal void Start() { Task.Run((Action)Decode); }

    internal bool HasFrame
    {
        get { lock (gate) return nextFrame != null; }
    }

    internal Bitmap TakeFrame(Bitmap previous)
    {
        lock (gate)
        {
            if (nextFrame == null) return null;
            if (spareFrame != null) spareFrame.Dispose();
            spareFrame = previous;
            var frame = nextFrame;
            nextFrame = null;
            return frame;
        }
    }

    private void Decode()
    {
        Process process = null;
        try
        {
            lock (gate)
            {
                if (closed) return;
                child = process = Process.Start(start);
            }
            byte[] data = new byte[width * height * 4];
            var stream = process.StandardOutput.BaseStream;
            while (true)
            {
                int offset = 0;
                while (offset < data.Length)
                {
                    int count = stream.Read(data, offset, data.Length - offset);
                    if (count == 0) return;
                    offset += count;
                }
                lock (gate)
                {
                    if (closed) return;
                    if (nextFrame == null)
                    {
                        nextFrame = spareFrame ?? new Bitmap(width, height, PixelFormat.Format32bppRgb);
                        spareFrame = null;
                    }
                    var bits = nextFrame.LockBits(new Rectangle(0, 0, width, height),
                        ImageLockMode.WriteOnly, PixelFormat.Format32bppRgb);
                    try { Marshal.Copy(data, 0, bits.Scan0, data.Length); }
                    finally { nextFrame.UnlockBits(bits); }
                }
            }
        }
        catch (IOException) { }
        catch (System.ComponentModel.Win32Exception) { }
        catch (InvalidOperationException) { }
        finally
        {
            lock (gate)
            {
                child = null;
                if (process != null) process.Dispose();
            }
        }
    }

    public void Dispose()
    {
        lock (gate)
        {
            if (closed) return;
            closed = true;
            if (child != null)
            {
                try { if (!child.HasExited) child.Kill(); }
                catch (InvalidOperationException) { }
                catch (System.ComponentModel.Win32Exception) { }
            }
            if (nextFrame != null) nextFrame.Dispose();
            if (spareFrame != null) spareFrame.Dispose();
            nextFrame = null;
            spareFrame = null;
        }
    }
}
