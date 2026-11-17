# Codex Wallpaper: Local Wallpapers and UI Adaptation for Codex on Windows

[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

> **Project status: development candidate.** This published snapshot contains a runnable candidate implementation and some offline verification, but it has not completed full acceptance against the real Codex UI, login/restart behavior, or long-term stability.
>
> **Unofficial tool:** This is not an official OpenAI feature and does not imply OpenAI endorsement of compatibility or safety. A dedicated launcher verifies the local Codex installation, then adds local wallpaper and UI adaptation to the main window.

## Overview

Codex Wallpaper is for the Windows Codex desktop app. It displays local images, videos, locally installed Wallpaper Engine content, and static web backgrounds behind the Codex main interface. It also adds readable surfaces and visual hierarchy to chat, tool cards, sidebars, settings, and the composer.

The project does not modify the Codex package or replace account and chat data. The supported entry point is `launcher/Codex-Wallpaper.cmd`; the original Codex entry cannot currently attach the wallpaper layer automatically. The candidate checks the exact Codex package version, app registration, and original executable hash, and leaves the original UI in place when they do not match.

## Features and Status

Status definitions:

- **Implemented candidate**: the path exists in the published source, but this is not proof of complete acceptance in the real host.
- **Direct playback / native rendering**: the media is displayed by browser media elements or WebWallGL rather than replaced by a static thumbnail.
- **Preview fallback**: when direct playback is unavailable, the author-provided Wallpaper Engine preview is shown.
- **Not supported**: the current candidate has no implementation for this capability.
- **Not verified**: code may have a related path, but there is not enough live evidence to promise that it works.

| Capability                                  | Candidate behavior                                                                                                     | Status                               | Known boundary                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Built-in background                         | Displays a gradient without requiring external media                                                                   | Implemented candidate                | Default background and failure fallback only                                                            |
| Imported local images                       | Imports through the page file picker, stores in browser IndexedDB, and displays directly                               | Direct playback                      | Full live interaction and large-image performance not yet accepted                                      |
| Imported local videos                       | Muted loop playback, adjustable volume, 15/30 FPS draw cap, and pause while the page is hidden                         | Direct playback                      | Audio playback, sleep/resume, and extended playback are unverified                                      |
| Wallpaper Engine images/videos              | Scans locally downloaded projects and reads the selected asset on demand through a hidden helper process               | Implemented candidate                | Each asset’s codec and compatibility must be verified separately                                        |
| Wallpaper Engine scenes                     | Renders through WebWallGL within the size/transfer limits; uses the author preview on failure or unsupported input     | Native render or preview fallback    | Real Workshop sample coverage and long-running behavior unverified                                      |
| Wallpaper Engine offline Web                | Reads local HTML with no scripts or external resources and displays it in a strict `srcdoc` sandbox                    | Offline sandbox or preview fallback  | Falls back when HTML exceeds 512 KiB or contains `<script>`; scripts and external links are unavailable |
| Online Web wallpapers                       | Does not load remote pages                                                                                             | Not supported                        | No proven isolation channel for networked content                                                       |
| UI adaptation                               | Adds translucent/readability surfaces to chat, tool cards, code/diff views, sidebars, settings, composer, and overlays | Implemented candidate                | Complete live UI matrix and cross-DPI acceptance are pending                                            |
| Library and appearance                      | Import, switch, favorites, playlist, timed rotation, dimming, blur, opacity, frame rate, and volume                    | Implemented candidate                | All live interactions and cross-window behavior are not yet accepted                                    |
| Multiple windows                            | Synchronizes wallpaper/settings between same-origin windows; each window decides visibility and pause independently    | Implemented candidate                | 30–60 minute resource comparison and all window types unverified                                        |
| Keyboard shortcut                           | `Alt+Shift+W` enables or disables the wallpaper in the running Codex page                                              | Implemented candidate                | A page shortcut, not a system-wide global hotkey                                                        |
| Windows login startup                       | Can create, inspect, and remove one per-user Startup shortcut                                                          | Code implemented, acceptance pending | Real login, sign-out, and restart acceptance is incomplete                                              |
| Automatic use from the original Codex entry | The original entry remains unchanged                                                                                   | Not supported                        | The dedicated launcher must be used                                                                     |

## Requirements

| Item              | Requirement                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating system  | Windows; the current package is x64 MSIX. The repository does not record a confirmed minimum Windows version, so support for every edition/build should not be claimed                         |
| Codex             | Exact package `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`, AUMID `OpenAI.Codex_2p2nqsd0c76g0!App`, and executable hash `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` |
| PowerShell        | Windows PowerShell 5.1; the launcher is run with `powershell.exe -NoProfile -STA`                                                                                                              |
| Node.js           | Node.js 24 or newer with built-in WebSocket and `--no-use-env-proxy` support                                                                                                                   |
| Package manager   | pnpm `11.25.0`, as recorded in the `packageManager` field of `package.json`                                                                                                                    |
| Optional          | A local Steam and Wallpaper Engine installation. Without them, the built-in background and imported media still work, but the WE library is unavailable                                        |
| Repository access | The repository is private; users need appropriate GitHub access                                                                                                                                |

The runtime dependency is `webwallgl@3.0.0`. Development dependencies are `husky`, `lint-staged`, and `prettier`. There is no business-code build step: install dependencies and run the launcher.

## Quick Start

Run these commands from the repository root. The examples use relative or generic paths rather than a personal absolute path.

1. Clone the private repository and install dependencies:

```powershell
git clone https://github.com/ye-chiyo/codex-wallpaper.git
Set-Location .\codex-wallpaper
pnpm install --frozen-lockfile
```

2. Inspect the installed Codex package version:

```powershell
Get-AppxPackage -Name OpenAI.Codex | Select-Object PackageFullName, Version
```

The launcher accepts only the exact `26.1111.2228.0` package listed above. After upgrading Codex, use the original entry first. If the package, app registration, or executable hash does not match, the dedicated launcher stops before attaching and leaves the original UI unchanged.

3. **Quit Codex completely.** Closing the window or minimizing it is not enough. After confirming that no Codex main process remains, run the dedicated entry:

```powershell
.\launcher\Codex-Wallpaper.cmd
```

4. A successful first launch normally prints:

```text
Outcome: read-only-probe-passed
Wallpaper: enabled
```

If the wallpaper was previously disabled in the page, `Wallpaper` may be `disabled`. `Outcome: read-only-probe-passed` confirms the launch, verification, and injection chain only; it does not replace manual checks of account, chat, UI, and media.

5. Confirm that the original account and an existing chat are available, and that chat, tool cards, code/diff, composer, and both sidebars remain readable and interactive. If a login screen appears, do not sign in inside this verification instance; quit it and check the original entry.

6. To inspect the current instance without starting, attaching, or injecting, run:

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

An ordinary instance started from the original entry is expected to show `DebugFlag: false` and `ListeningPorts: []`. This command does not modify the running instance.

For development, `pnpm test` runs the Node tests. Automated tests and headless fixtures are not a substitute for acceptance in the real Codex app.

## Everyday Use

When the wallpaper is running, a toolbar appears near the lower-right corner of the main UI. The current UI text is Simplified Chinese only; this document keeps the Chinese button names and provides translations.

| Chinese UI label        | English                               | 日本語                                       |
| ----------------------- | ------------------------------------- | -------------------------------------------- |
| `壁纸设置`              | Wallpaper settings                    | 壁紙設定                                     |
| `导入图片或视频`        | Import image or video                 | 画像または動画をインポート                   |
| `壁纸库`                | Wallpaper library                     | 壁紙ライブラリ                               |
| `使用`                  | Use                                   | 使用                                         |
| `加入轮播` / `移除轮播` | Add to / remove from rotation         | ローテーションに追加 / から削除              |
| `停用壁纸`              | Disable wallpaper                     | 壁紙を無効化                                 |
| `停用并清除本项目数据`  | Disable and clear this project’s data | 壁紙を無効化して本プロジェクトのデータを消去 |
| `再次点击确认清除`      | Click again to confirm deletion       | もう一度クリックして消去を確定               |

Basic workflow:

1. Open `壁纸设置`, then choose the built-in background, imported media, or a locally installed Wallpaper Engine project in `壁纸库`.
2. Click `使用` to switch to the selected wallpaper. If an asset is missing or unreadable, the page skips it or keeps the current image.
3. Use the star button for favorites and `加入轮播` / `移除轮播` for the rotation playlist. Rotation needs at least two items and is disabled at 0 minutes.
4. Adjust the appearance settings. They are stored in the current Codex page configuration and synchronized between windows on the same origin.
5. Click `停用壁纸` to remove the background and controls immediately. Press `Alt+Shift+W` again to restore the last enabled wallpaper and settings.

Appearance settings:

| Setting    | Range and default        | Description                                                       |
| ---------- | ------------------------ | ----------------------------------------------------------------- |
| Dim        | 0–70%, default 18%       | Darkens the background to improve text readability                |
| Blur       | 0–24 px, default 0       | Blurs the media layer                                             |
| Opacity    | 20–100%, default 100%    | Controls media-layer transparency                                 |
| Frame rate | 15 or 30 FPS, default 30 | Upper frame rate for video drawing and scenes                     |
| Volume     | 0–100%, default 0        | 0 is muted; audible video and asset audio still need live testing |
| Rotation   | 0–120 minutes, default 0 | Requires at least two items and a value greater than 0            |

When the window is minimized, moved behind another window, or otherwise hidden, the candidate pauses video/scene drawing and resumes when visible again. Visibility is evaluated per window, while same-origin settings are shared.

## Windows Login Startup (Optional, Pending Acceptance)

The published snapshot does contain login-startup commands. They operate only on `Codex Wallpaper.lnk` in the current user’s Startup folder. They do not register a Windows service, scheduled task, or system-wide startup item, and the shortcut starts the dedicated launcher with a hidden window.

> **Acceptance status:** The release record says real login, sign-out, restart, and repeated-trigger acceptance has not been completed. Do not describe the feature as proven stable over time.

```powershell
# Enable or idempotently update the current-user login entry
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -EnableStartup

# Inspect status; Status in the JSON output is enabled, stale, or disabled
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -StartupStatus

# Remove login startup
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -DisableStartup
```

The login entry invokes the existing dedicated launcher with `-Launch -Unattended`. If a verifiable dedicated instance is already running, the launcher reuses it. A normal Codex instance, multiple main processes, or a missing matching receipt is not treated as a reusable dedicated instance. Unattended receipts are stored under `%LOCALAPPDATA%\CodexWallpaper\P0b`.

## Disable and Uninstall

Choose the level you need. Do not delete Codex’s daily profile, login data, or chats in order to remove the wallpaper tool.

1. **Disable the wallpaper temporarily:** click `停用壁纸`, or press `Alt+Shift+W` while the dedicated Codex page has keyboard focus. Press the shortcut again to restore it. Disabling the page does not close the debug listener created by the dedicated launcher; that listener ends when the Codex instance exits normally.
2. **Remove login startup:** run `-DisableStartup` and confirm that the reported status is `disabled`.
3. **Clear this project’s page data:** click `停用并清除本项目数据`, then `再次点击确认清除`. This deletes the page’s global configuration and imported media in IndexedDB and restores the built-in gradient. It does not delete the Codex daily profile, account, or chats.
4. **Remove receipts and owned local files:** double-click `launcher\Reset-CodexWallpaper.cmd`. It removes only `%LOCALAPPDATA%\CodexWallpaper` and does not clear imported media in page IndexedDB, so complete step 3 first.
5. **Return to the original entry:** fully quit the dedicated Codex instance and start Codex from its original entry. Neither the installer nor this project replaced that entry.
6. **Remove the tool itself:** after the steps above, delete the local checkout of this repository. There is no system-level installer or separate automatic uninstaller to invoke.

Do not delete `%APPDATA%\Codex\web\Codex`, `%LOCALAPPDATA%\Packages\OpenAI.Codex_2p2nqsd0c76g0`, or other Codex data directories to “uninstall” the wallpaper. They do not belong to this project.

## Troubleshooting

### No wallpaper appears after launch

Confirm that Codex was completely quit, then run `launcher\Codex-Wallpaper.cmd` again. If Codex is already running, the launcher refuses to start or reuse it; it will not turn an ordinary instance into a dedicated one automatically. Check that the package is `26.1111.2228.0` and read `Outcome` in the console. The status command is read-only and does not inject anything.

### `Alt+Shift+W` does nothing

The shortcut is installed inside the page that runs the wallpaper; it is not a system-wide global hotkey. Click the dedicated Codex window to give the page keyboard focus, then try again. If panel buttons also fail, check whether the page is disabled or inspect `Wallpaper.state` from the launcher.

### The launcher reports a version or executable mismatch

The launcher verifies the exact package, AppID, install path, executable SHA-256, and daily profile. If `Unsupported or ambiguous Codex package`, `Original executable or app registration did not match`, or `daily-profile-missing` appears after a Codex update, do not bypass the check. Use the original entry and wait for a release that targets the new version.

### A Wallpaper Engine asset will not play

The candidate handles locally downloaded projects; it does not guarantee compatibility with the entire Wallpaper Engine Workshop. If the scene renderer is unavailable, an asset cannot be read, or the main asset exceeds 512 MiB, the candidate may show the author preview. Offline Web falls back when HTML contains scripts, exceeds 512 KiB, or relies on external resources; online Web is not supported. Try a local imported image/video to distinguish a tool problem from one asset problem.

### Switching causes a black frame, stall, or stale image

Large scenes and videos are read on demand. Let the current switch finish before choosing another item; if needed, press `Alt+Shift+W` once to disable and restore. If the problem repeats, keep the time, asset type, and `Outcome` from the receipt. Do not attach chat text, account data, or an unreviewed full receipt.

### A login screen appears or account state looks wrong

Do not sign in inside the verification instance. Quit it completely and check the original Codex entry, including the original account and an existing chat. If the original entry is normal, use `Outcome` and `NativeProfile` from the receipt as diagnostics; do not copy or upload the profile.

### Login startup does not work

Run `-StartupStatus`. `stale` means the same-named shortcut points to an old path or arguments; run `-DisableStartup`, then `-EnableStartup`. Real sign-out/restart acceptance is still incomplete, so this result should not be used to claim that Codex login state or asset isolation has passed.

### Required diagnostics

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
Get-ChildItem "$env:LOCALAPPDATA\CodexWallpaper\P0b" -Filter *.json |
  Select-Object Name, LastWriteTime
```

Receipts may contain metadata such as PIDs, local paths, and process timestamps. Review and redact them before sharing. Do not upload the Codex profile, credentials, or chat content.

## Project Layout

```text
launcher/
  Codex-Wallpaper.cmd          # Dedicated launch entry
  Start-CodexWallpaper.ps1     # Version/entry checks, CDP launch, Startup management
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

`launcher/README.md` contains the detailed delivery and manual acceptance instructions in Chinese. `docs/planning/codex-wallpaper-candidate.md` records the current capabilities, offline evidence, and unfinished acceptance gates in Chinese. Both documents are currently Chinese-only.

## Known Limitations

- This is a development candidate, not a release that has completed all acceptance gates.
- It supports Windows only; there is no macOS, Linux, or mobile implementation.
- It is locked to the recorded identity of Codex `26.1111.2228.0`. A Codex update requires a new compatibility update; the old hash check must not be bypassed.
- The original Codex entry cannot attach the wallpaper automatically. The dedicated launcher must be used.
- The UI text is Simplified Chinese only. Translated READMEs do not constitute a multilingual UI.
- Online Web wallpapers are unsupported. Offline Web cannot execute scripts or load external resources.
- Not every Wallpaper Engine asset is guaranteed to play. Scene coverage, cross-DPI behavior, theme combinations, multi-window resource cost, and failure recovery still need item-by-item testing.
- Real login/restart Startup acceptance, the complete live host interaction matrix, the 30–60 minute resource comparison, the 8-hour baseline, and the 7-day observation have not been completed.
- Automated and headless fixtures prove only the rules they cover, not every window, panel, and edge case in the real Codex app.

## Upstream Sources and Licensing

- Steam installation discovery and Wallpaper Engine project scanning reuse `steam-discovery.js` and `wallpaper-scan.js` from [`elysia395/dsh-wallpaper-engine`](https://github.com/elysia395/dsh-wallpaper-engine) at pinned revision `fd3e01fd11cd5ad83f46940ab4d61d971cfbcf91`. The two files are kept as unmodified copies under `launcher/vendor/dsh-wallpaper-engine/`, with the upstream MIT `LICENSE`. The DSH/Cordis host integration was not reused.
- Scene rendering depends on [`webwallgl@3.0.0`](https://github.com/oneincase/webwallgl), licensed under MIT. See `launcher/vendor/THIRD_PARTY_NOTICES.md` for the complete third-party notice and `launcher/vendor/dsh-wallpaper-engine/UPSTREAM.md` for the pinned upstream information.
- This repository currently has no root `LICENSE`, so the entire project must not be automatically described as MIT or any other open-source license. Third-party code is covered only by its respective notice; the rights for wallpapers, characters, fonts, and preview assets remain with their sources. This project does not grant rights to those assets.
