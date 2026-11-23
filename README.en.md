# Codex Wallpaper: Local Wallpapers and UI Adaptation for Codex on Windows

[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

> **Project status: Windows development candidate.** Automated fixtures cover launch checks, media import, disable, and cleanup. An earlier release snapshot on x64 Codex `26.1117.3838.0` reached a dedicated cold start, restored settings, and returned to the official entry after cleanup. This update still needs desktop retesting. Login startup and long-running stability remain pending. The current candidate supports only one verified Codex main window. [Candidate acceptance record](docs/planning/codex-wallpaper-candidate.md)
>
> **Unofficial tool:** This is not an official OpenAI feature and does not imply OpenAI endorsement of compatibility or safety. A dedicated launcher verifies the local Codex installation, then adds local wallpaper and UI adaptation to the main window.
>
> Reference material: [Architecture](docs/architecture.md) · [Windows development candidate release notes](docs/releases/codex-wallpaper-windows-candidate.md)

## Overview

Codex Wallpaper is for the Windows Codex desktop app. It displays local images, videos, locally installed Wallpaper Engine content, and static web backgrounds behind the Codex main interface. It also adds readable surfaces and visual hierarchy to chat, tool cards, sidebars, settings, and the composer.

The project does not modify the Codex package or replace account and chat data. The baseline entry point is `launcher/Codex-Wallpaper.cmd`; testers may optionally build the C# desktop wrapper described in [launcher/README.md](launcher/README.md). The original Codex entry cannot currently attach the wallpaper layer automatically, and this project does not replace or modify existing Codex, desktop, or taskbar shortcuts. The candidate checks the exact Codex package version, app registration, and original executable hash, and leaves the original UI in place when they do not match.

Project source is public for reading. See [Upstream Sources and Licensing](#upstream-sources-and-licensing).

## Features and Status

The table describes the implementation, the recorded evidence, and the checks still needed in the Codex desktop app.

| Capability                         | Implementation                                                                                                                                          | Evidence and limits                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Built-in background                | Displays the built-in gradient without imported media                                                                                                   | Automated fixtures cover startup and restore                                                                                           |
| Local image and video imports      | Select files in the wallpaper library and display them after saving to IndexedDB. Video loops muted by default                                          | Fixtures cover imports, switching, preservation on failure, and cleanup. Import and reopen in the real Codex app remain pending        |
| Wallpaper Engine images and videos | Scans locally downloaded projects and reads the selected asset on demand through a hidden host                                                          | Video main assets up to 1 GiB. Other assets and transfer fallbacks up to 512 MiB. A front-`moov` video has live switching measurements |
| Wallpaper Engine scenes            | Renders through WebWallGL and tries the author preview if rendering fails or the input is unsupported                                                   | Fixture coverage is available. Workshop compatibility and long-running stability remain pending                                        |
| Wallpaper Engine offline Web       | Displays local HTML in a `srcdoc` sandbox. External resources are blocked, so pages that depend on them may display incompletely                        | Tries the author preview for unreadable HTML, HTML larger than 512 KiB, or HTML with `<script>`. Online Web is unsupported             |
| Interface and settings             | Adapts chat, tool cards, code/diffs, sidebars, settings, composer, and overlays. Includes Library, Playback and Performance, and Appearance and Presets | Desktop evidence covers persistence, disable, and restore. Full interaction, theme, and DPI coverage is pending                        |
| Same-origin settings sync          | Synchronizes settings events between injected same-origin pages. Each page checks visibility independently                                              | Browser fixture passed; a hidden iframe verifies only storage events. The current candidate attaches only one verified main window     |
| Shortcuts                          | `Alt+Shift+S` opens or closes settings and `Alt+Shift+W` disables or restores the wallpaper                                                             | Browser fixtures and earlier desktop checks cover restore. Shortcuts require window focus                                              |
| Windows login startup (optional)   | Can create, inspect, and remove one per-user Startup shortcut                                                                                           | A temporary-directory fixture passed. Real sign-in, sign-out, restart, and repeated triggers remain pending                            |

## Requirements

| Item       | Requirement                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| System     | Windows with one of the x64 MSIX packages below. The minimum Windows version is still unverified                             |
| PowerShell | Windows PowerShell 5.1, available as `powershell.exe`                                                                        |
| Tools      | Git and Node.js 24 or newer for Windows x64. The setup script uses pinned pnpm 11.25.0.                                      |
| Optional   | Steam and Wallpaper Engine for the local Wallpaper Engine library. Built-in backgrounds and manual imports work without them |

### Codex compatibility

| `PackageFullName`                                | Original EXE SHA-256                                               | Testing in the Codex desktop app                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0` | `21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82` | Local read-only status reports `CompatibilityMode: known`; desktop E2E is pending       |
| `OpenAI.Codex_26.1117.3838.0_x64__2p2nqsd0c76g0` | `AF4D57201946260D2754172BC660EFF80B5398EA146EF466126886CCD0CF2514` | A previous release snapshot reached `wallpaper-ready`. This update is pending retesting |
| `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` | `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` | An earlier candidate reached `wallpaper-ready`. This candidate has preflight coverage   |

The launcher checks the full package name, app registration `OpenAI.Codex_2p2nqsd0c76g0!App`, SHA-256 of the original EXE, daily profile, single main process, and main interface. A registered package with the exact hash uses the fast path. A trusted but unlisted version enters a main-interface compatibility probe. Unknown or untrusted packages, hash drift for a registered package, and multiple main processes fail closed before attachment and leave the original UI in place. See the [candidate acceptance record](docs/planning/codex-wallpaper-candidate.md) for desktop and fixture results.

## Quick Start

Follow these steps in PowerShell.

1. **Get the source.** Clone the repository on GitHub’s default branch and enter the repository root.

   ```powershell
   git clone https://github.com/ye-chiyo/codex-wallpaper.git
   Set-Location .\codex-wallpaper
   ```

   You can also select **Code → Download ZIP** on GitHub, extract the archive, and open the extracted folder.

2. **Check your installed Codex package.** Install the dependencies only if the command returns exactly one row whose `PackageFullName` matches a row in the compatibility table. If there are zero or multiple rows, or the package name differs, use the official Codex entry in the Windows Start menu until the wallpaper project supports your package.

   ```powershell
   Get-AppxPackage -Name OpenAI.Codex | Select-Object PackageFullName, Version
   ```

3. **Install the wallpaper runtime dependencies.** Install the Windows x64 MSI from the [official Node.js archive](https://nodejs.org/en/download/archive/v24.16.0), then open a new PowerShell window. Back in the source directory, double-click [Setup-CodexWallpaper.cmd](launcher/Setup-CodexWallpaper.cmd) or run the command below. First-time setup needs an internet connection and installs the locked runtime dependencies without a global pnpm install.

   ```powershell
   .\launcher\Setup-CodexWallpaper.cmd
   ```

4. **Initialize Codex from its official entry first.** Open Codex from the Windows Start menu and sign in if prompted. Wait for the main interface and confirm you can access your account and an existing chat. For a new account, confirm you can open a new chat. Then quit Codex normally and wait for the main process to exit. Codex may keep running in the background after closing or minimizing its window.

5. **Start the wallpaper in the main interface.** Run the dedicated CMD from the repository root.

   ```powershell
   .\launcher\Codex-Wallpaper.cmd
   ```

   ```text
   Outcome: wallpaper-ready
   Wallpaper: enabled
   ```

   `Outcome: wallpaper-ready` means the launcher verified the main interface and the wallpaper host is ready. With `Wallpaper: enabled`, the wallpaper should be visible in the main interface. If a previous session saved a disabled state, you may see `Wallpaper: disabled` and the original interface. Press `Alt+Shift+W` in the Codex window to enable the wallpaper again. Confirm that you can open a chat and use the composer. If the dedicated session shows a sign-in screen, quit it and complete setup from the official entry. If the launcher stops early, use the console message to find the relevant step in [Troubleshooting](#troubleshooting).

To check whether Codex has fully exited, run this read-only command from the repository root:

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

For a compatible package, `"Running": []` means the launcher found no Codex main process. An ordinary instance launched from the official entry is expected to show `DebugFlag: false` and `ListeningPorts: []`.

For development, run `pnpm.cmd install --frozen-lockfile` to install the development dependencies before running `pnpm.cmd test:full`, which covers all Node suites plus the four PowerShell launcher suites. Running `pnpm.cmd test` alone only covers the Node suites. The [candidate acceptance record](docs/planning/codex-wallpaper-candidate.md) lists automated fixture and desktop results separately.

## Everyday Use

When the wallpaper is running, press `Alt+Shift+S` to open or close settings. The current UI text is Simplified Chinese only; this document keeps the actual Chinese labels and provides translations.

| Chinese UI label        | English                               | 日本語                                       |
| ----------------------- | ------------------------------------- | -------------------------------------------- |
| `壁纸设置`              | Wallpaper settings                    | 壁紙設定                                     |
| `壁纸库`                | Wallpaper library                     | 壁紙ライブラリ                               |
| `播放与性能`            | Playback and performance              | 再生とパフォーマンス                         |
| `外观与预设`            | Appearance and presets                | 外観とプリセット                             |
| `导入素材`              | Import assets                         | 素材をインポート                             |
| `使用`                  | Use                                   | 使用                                         |
| `收藏`                  | Favorite                              | お気に入り                                   |
| `加入轮播` / `移除轮播` | Add to / remove from rotation         | ローテーションに追加 / から削除              |
| `保存当前设置`          | Save current settings                 | 現在の設定を保存                             |
| `导出设置` / `导入设置` | Export / import settings              | 設定をエクスポート / インポート              |
| `移除全部导入素材`      | Remove all imported assets            | インポート素材をすべて削除                   |
| `停用并清除本项目数据`  | Disable and clear this project’s data | 壁紙を無効化して本プロジェクトのデータを消去 |
| `再次点击确认清除`      | Click again to confirm deletion       | もう一度クリックして消去を確定               |

Basic workflow:

1. Press `Alt+Shift+S`, open `壁纸设置`, then choose the built-in background, imported media, or a locally installed Wallpaper Engine project in `壁纸库`.
2. Click `使用` to switch to the selected wallpaper. If an asset is missing or unreadable, the page skips it or keeps the current image.
3. Use the star button for favorites and `加入轮播` / `移除轮播` for the rotation playlist. Rotation needs at least two items and is disabled at 0 minutes.
4. Use `播放与性能` for performance profile, Scene cap, mute, volume, and rotation. Use `外观与预设` for wallpaper visuals, interface readability, section overrides, presets, and settings import/export. Injected same-origin pages synchronize settings. The current candidate does not attach a second real Codex main window.
5. Press `Alt+Shift+W` to remove the background and settings panel; press it again to restore the last enabled wallpaper and settings.

Appearance settings:

| Setting           | Range and default                                              | Description                                                       |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Dim               | 0–70%, default 18%                                             | Darkens the background to improve text readability                |
| Blur              | 0–24 px, default 0                                             | Blurs the media layer                                             |
| Opacity           | 20–100%, default 100%                                          | Controls media-layer transparency                                 |
| Frame rate        | Performance 15 FPS, Balanced 30 FPS (default), Custom 1–30 FPS | Scene rendering cap. Video plays at its source cadence            |
| Volume            | 0–100%, default 0                                              | 0 is muted; audible video and asset audio still need live testing |
| Rotation          | 0–120 minutes, default 0                                       | Requires at least two items and a value greater than 0            |
| Interface surface | 20–100%, default 72%                                           | Adjusts the opacity of readable Codex surfaces                    |
| Interface blur    | 0–24 px, default 0                                             | Blurs the readable interface layer                                |

Video and Scene pause by default when their own page reports that it is hidden, then resume when visible. The contents of an offline Web sandbox control its own frame rate and pause behavior.

## Launcher Options and Diagnostics

The Chinese [launcher guide](launcher/README.md) links to the exact executable hashes and covers the optional GUI build, [login startup](launcher/README.md#windows-登录启动), and [detailed diagnostics](launcher/README.md#诊断与回执). The [candidate acceptance record](docs/planning/codex-wallpaper-candidate.md) lists automated results, the snapshots tested in the desktop app, and remaining checks.

## Disable and Uninstall

### Upgrade the wallpaper tool

Quit the old dedicated Codex instance completely before updating the source. Recheck the Codex package, reinstall the locked dependencies, and run the updated CMD by following [Quick Start](#quick-start). A repeat launch reuses a verified dedicated instance. If an ordinary Codex instance is running, the launcher refuses to attach. If you see `Outcome: runtime-version-mismatch`, quit Codex completely and reopen it with the updated dedicated CMD. The launcher preserves the wallpaper runtime already mounted.

### Disable temporarily

Press `Alt+Shift+W` in the focused Codex window. Press it again to restore the previous wallpaper and settings. Disabling removes the wallpaper layer and player. The dedicated debug listener closes when Codex exits completely.

### Clear data and return to the official entry

1. **Clear page data first.** In the dedicated instance, press `Alt+Shift+S` and open `外观与预设` (Appearance and Presets). Click `停用并清除本项目数据`, then `再次点击确认清除`. This disables the wallpaper and clears the project’s page settings and IndexedDB imports. If you disabled the wallpaper temporarily, enable it again to open settings.
2. **Remove login startup if enabled.** Run `-DisableStartup`, then use `-StartupStatus` to confirm `Status` is `disabled`. [Login startup commands](launcher/README.md#windows-登录启动)
3. **Quit the dedicated Codex instance completely.** If needed, use the read-only command in Quick Start and wait for `"Running": []`.
4. **Clear local receipts and caches.** After Codex exits, run `launcher\Reset-CodexWallpaper.cmd` to clean `%LOCALAPPDATA%\CodexWallpaper`.
5. **Open Codex from the official entry.** Use the Windows Start menu and confirm that you can access your account and an existing chat. To remove the tool, you can delete the local checkout and any wallpaper shortcuts you created.

Keep the Codex daily profile, account data, and chats. Page cleanup and local reset only target this project’s data.

## Troubleshooting

### No wallpaper appears after launch

Confirm that Codex was completely quit, then run `launcher\Codex-Wallpaper.cmd` again. The launcher can reuse a verified dedicated instance. An ordinary running instance keeps its original interface. Check for a registered package, `26.1117.4957.0`, `26.1117.3838.0`, or `26.1111.2228.0`, and read `Outcome` in the console. A trusted unlisted version may enter the compatibility probe. The status command is read-only and does not inject anything.

### `Alt+Shift+S` or `Alt+Shift+W` does nothing

The shortcuts are installed inside the page that runs the wallpaper and are not system-wide hotkeys. Click the dedicated Codex window to give the page keyboard focus, then try again. A disabled page has no settings panel; press `Alt+Shift+W` first. If they still fail, inspect `Outcome` and `Wallpaper.state` from the launcher.

### The launcher reports a missing daily profile

If the console says `Expected daily profile directory is missing`, use the official Codex entry in the Windows Start menu to complete step 4 of [Quick Start](#quick-start), then retry the dedicated CMD. If the same error persists, keep using the official entry. In unattended mode, the receipt records this failure as `daily-profile-missing`.

### The launcher reports a version or executable mismatch

- `Unsupported or ambiguous Codex package` (unattended receipt `unsupported-package`). Repeat step 2 of [Quick Start](#quick-start) and verify that exactly one x64 MSIX matches. If Codex updated to a version outside the table, keep using the official entry until the wallpaper project adds support for the new package.
- `Original executable or app registration did not match` (unattended receipt `executable-or-app-registration-mismatch`). Even with a matching package name, the EXE’s SHA-256 or Windows app registration may differ. Check that Codex opens from the official entry. If it does and the dedicated entry still reports a mismatch, keep the message for troubleshooting.

Both mismatches stop the launcher before it attaches the wallpaper. At this stage the dedicated CMD displays the message in the console. Keep the package, registration, and hash checks in place and use the official entry to open the original interface.

### A Wallpaper Engine asset will not play

The candidate handles locally downloaded projects. Video main assets are supported up to 1 GiB through the local File route. Other assets and transfer fallbacks are limited to 512 MiB. Offline Web tries the author preview for unreadable HTML, HTML above 512 KiB, or HTML containing `<script>`. External resources are blocked, so the page may show only local content.

### Switching causes a black frame, stall, or stale image

Large scenes and videos are read on demand. Let the current switch finish before choosing another item; if needed, press `Alt+Shift+W` to disable the wallpaper, then press it again to restore. If the problem repeats, keep the time, asset type, and `Outcome` from the receipt. Do not attach chat text, account data, or an unreviewed full receipt.

### A login screen appears or account state looks wrong

Do not sign in inside the verification instance. Quit it completely and check the original Codex entry, including the original account and an existing chat. If the original entry is normal, use `Outcome` and `NativeProfile` from the receipt as diagnostics; do not copy or upload the profile.

## Project Layout

```text
launcher/
  Setup-CodexWallpaper.cmd     # Install locked runtime dependencies
  Codex-Wallpaper.cmd          # Dedicated launch entry
  Start-CodexWallpaper.ps1     # Version/entry checks, CDP launch, Startup management
  CodexWallpaperDesktop.cs     # Optional C# desktop launcher
  startup-supervisor.mjs       # Main-page discovery, reconnect, and host supervision
  startup-preview.mjs          # Startup-screen cache
  mp4-layout.mjs               # Large-video File playback layout
  static-background.mjs        # Injects the wallpaper runtime
  client-runtime.mjs           # Library, settings, shortcut, and page adaptation
  wallpaper-library.mjs        # Steam/WE discovery, scanning, on-demand preparation
  wallpaper-host.mjs           # Hidden local helper process
  Reset-CodexWallpaper.cmd     # Cleanup of owned local receipts/files
  Reset-CodexWallpaper.ps1
  vendor/                      # Pinned upstream scanner code and notices
docs/planning/
  codex-wallpaper-candidate.md # Chinese candidate capabilities and manual gates
package.json
pnpm-lock.yaml
```

The Chinese [launcher guide](launcher/README.md) documents launcher options and diagnostics. The [candidate acceptance record](docs/planning/codex-wallpaper-candidate.md) gives the evidence and pending checks.

## Known Limitations

- This is a development candidate, not a release that has completed all acceptance gates.
- It supports Windows only; there is no macOS, Linux, or mobile implementation.
- Exact fast-path identities are Codex `26.1117.4957.0`, `26.1117.3838.0`, and `26.1111.2228.0`; a trusted unlisted version may attach only after the main-interface probe. Hash drift for a registered package, unknown identities, and multiple main processes fail closed. Package, registration, hash, and main-interface checks must not be bypassed.
- The current candidate supports only one verified Codex main window. Two exact main pages fail closed. Same-origin `storage` synchronizes settings only among injected pages and does not promise wallpaper in a second real window.
- The original Codex entry cannot attach the wallpaper automatically. The dedicated launcher must be used.
- The UI text is Simplified Chinese only. Translated READMEs do not constitute a multilingual UI.
- Online Web wallpapers are unsupported. Offline Web cannot execute scripts or load external resources.
- Not every Wallpaper Engine asset is guaranteed to play. Video is limited to 1 GiB, while other assets and compatible fallback routes are limited to 512 MiB. Scene coverage, cross-DPI behavior, theme combinations, and failure recovery still need item-by-item testing. Automatic wallpaper in a second real main window is outside this release.
- Real login/restart Startup acceptance, the complete live host interaction matrix, the 30–60 minute resource comparison, the 8-hour baseline, and the 7-day observation have not been completed.
- Automated and headless fixtures prove only the rules they cover, not every window, panel, and edge case in the real Codex app.

## Upstream Sources and Licensing

- Steam installation discovery and Wallpaper Engine project scanning reuse `steam-discovery.js` and `wallpaper-scan.js` from [`elysia395/dsh-wallpaper-engine`](https://github.com/elysia395/dsh-wallpaper-engine) at pinned revision `fd3e01fd11cd5ad83f46940ab4d61d971cfbcf91`. The two files are kept as unmodified copies under `launcher/vendor/dsh-wallpaper-engine/`, with the upstream MIT `LICENSE`. The DSH/Cordis host integration was not reused.
- Scene rendering depends on [`webwallgl@3.0.0`](https://github.com/oneincase/webwallgl), licensed under MIT. After dependency installation, see `node_modules/webwallgl/LICENSE` for the full text. See also the [third-party notices](launcher/vendor/THIRD_PARTY_NOTICES.md) and [pinned scanner revision](launcher/vendor/dsh-wallpaper-engine/UPSTREAM.md).
- The project’s own source is public for reading and reference. The repository grants no general reuse license for that source. Contact the maintainers for permission to copy, adapt, or redistribute it. Upstream code follows its own licenses, and wallpapers, characters, fonts, and preview assets follow the terms set by their sources.
