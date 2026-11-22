# Live switching probe before the follow-up fixes

Date: 2026-11-19, Asia/Shanghai.
Candidate loaded in the dedicated instance: `be6e4ce104e955104682c0fb03e9ba67f9844a3b708d37869d8227d2acf2f3b1`.
The latest source candidate is `52d753e9c344bb393c964e6945bc3d17a12d0e363379187c96d1846229896ec1` and has not yet been loaded into the running Codex instance.

## Conditions

- Codex package: `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`.
- Dedicated main process: PID `46184`, created `2026-11-19T12:56:43.1130100+08:00`.
- CDP: loopback port `64390`, unique `app://-/index.html` target.
- Viewport: `1707 x 1066` CSS pixels, DPR `1.5`, dark theme, visible.
- User configuration was backed up to `20261119-live-switch-config-before.json` with SHA-256 `cd14709b95a6e4e34a889a8b420553dba7222381f8ecf31dfc278fb55f11657d`; it was restored byte-for-byte.
- The first probe attempt was retained as `20261119-live-switch-probe-attempt1.json`; it had a measurement-fixture bug and is not used as acceptance evidence.

## Real file-backed switch samples

The target files were confirmed through the existing scanner:

- `1791074903`: `115500404` bytes, single `mdat`, front `moov`, original single-slice layout.
- `1986730797`: `75689196` bytes, tail `moov`, `26660` byte `moov`, `1802` corrected offsets, three virtual segments.

| Sample | Click-to-commit | Click-to-real-dynamic-frame | Transfer path | Dynamic-frame predicate |
| --- | ---: | ---: | --- | --- |
| 110 MiB front `moov`, first selection | 595.7 ms | 714.7 ms | 1 File transfer, 0 Base64 chunks | visible, not paused, `readyState=4`, `mediaTime 0.033333 -> 0.066667`, 1920 x 1080 |
| 75 MiB tail `moov`, first selection | 729.1 ms | 873.0 ms | 1 File transfer, 0 Base64 chunks | visible, not paused, `readyState=4`, `mediaTime 0.066667 -> 0.100000`, 1920 x 1080 |

These samples prove the new path is materially faster than the previous full-transfer behavior, which recorded 6.01-6.90 seconds for a larger on-demand video. They are single live samples, not p95 values. The 110 MiB sample is above the 600 ms cold p95 budget and the 75 MiB sample is within the 1000 ms maximum but also above the target p95.

## Findings that required follow-up

1. **Warm selection was not real.** Hovering a real video card created a hidden video whose source was the card's `data:image/...` preview. It failed with media error code `4` and never prepared the MP4. The implementation now requests `warm-asset` from the host, receives a restricted File through the existing hidden-input protocol, and holds one blob-backed metadata slot.
2. **Every active change rebuilt the full wallpaper card list.** The click path called `renderPanel()` and replaced all 106 cards even when only the selected card changed. The current source uses `renderPanel(false)` for active changes, synchronizes card state in place, and builds the complete card list only when the panel is first opened.
3. **Selection feedback exceeded the 50 ms target in the live probe.** The measured event path was `176-305 ms` to the selected attribute and `267-405 ms` to the first feedback frame. This was dominated by the synchronous panel rebuild and is covered by the in-place state change above; the new source must be measured after a restart.
4. **Warm samples were not faster.** The first-selection and return-selection paths both still performed one File transfer because the previous warm slot was unusable. The new warm slot is consumed by the next selection instead of transferring the file again.

## Disable and lifecycle

- Real disable during a switch: the trusted toggle dispatch reached cleanup in `13.1 ms`; the total probe command window was `727.2 ms` because the CDP mouse sequence itself was serialized.
- After 30 seconds: state `disabled`, no wallpaper root, zero players, zero warm videos.
- The `window.codexWallpaperApi.disable()` path in the browser regression also clears the File transfer, warm slot, staged media, and pending timers.

## Startup evidence from the 12:56 restart

- Receipt started at `2026-11-19T12:56:43.0643270+08:00`.
- Main process appeared at `2026-11-19T12:56:43.1130100+08:00`.
- Receipt completed at `2026-11-19T12:56:49.8831484+08:00`.
- The receipt contains one main process, the expected package, matching daily profile, loopback listener ownership, `read-only-probe-passed`, and `Wallpaper.state=enabled`.
- This is a successful dedicated-entry chain, but it is not a T0-T7 comparison against the official entry and does not prove the new candidate's first-open card deferral. Those measurements remain pending a restart with `52d753e9...`.

## Automated checks for the follow-up source

- Node regression: `31/31` passed.
- PowerShell startup entry: passed.
- Profile and reuse preflight: 11/11 assertions passed.
- Root ambiguity preflight: 3/3 assertions passed.
- `git diff --check --ignore-cr-at-eol`: passed, with CRLF conversion warnings only.
- The opening-panel regression now asserts zero cards before the first open and the expected cards after the first open.

## Status

The functional and automated portions of the follow-up are complete. The latest candidate has **not** been loaded into the running Codex process, so live selection-feedback, cold/warm p95, rapid-selection, failure-sample, startup T0-T7, and visual acceptance remain open. The user's visual judgment is still required.
