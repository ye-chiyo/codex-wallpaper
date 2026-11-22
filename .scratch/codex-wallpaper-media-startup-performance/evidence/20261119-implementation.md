# File-backed video and startup implementation evidence

Date: 2026-11-19, Asia/Shanghai
Branch: codex/wallpaper-performance-settings
Base commit: 57cfc04e58440df2f903a4241a1205e012ccb001

## Implemented

- Added a real CDP `DOM.setFileInputFiles` path in `launcher/wallpaper-host.mjs`.
- Added strict allowed-root boundary checks before preparing a workshop asset in `launcher/wallpaper-library.mjs`.
- Added a virtual layout parser in `launcher/mp4-layout.mjs` for single-`mdat`, non-fragmented, unencrypted MP4 files. It returns an original single slice for front `moov`, and corrects small `stco/co64` tables for tail `moov`. Fragmentation, encryption, multiple `mdat`, oversized tables, invalid boundaries, or invalid offsets return null and fall back.
- Added the page-side `beginAssetFileTransfer`, `finishAssetFileTransfer`, and `cancelAssetFileTransfer` APIs in `launcher/client-runtime.mjs`. They create a temporary hidden input, receive a restricted File, create a CSP-compatible `blob:` URL, and reuse the existing generation-guarded `showVideo()` first-frame handoff.
- Retained the existing full Blob/Base64 path as the explicit compatibility fallback. The host records `file-input-unavailable` or `file-input-failed` before using it.
- Added single-slot hover/pointer metadata warming for one workshop video. It uses `preload="metadata"`, never calls `play()`, and releases the element on metadata load, error, candidate change, and disable.
- Added `launcher/startup-supervisor.mjs`, which performs `Page.getFrameTree`, runtime injection, and wallpaper bridge startup through one CDP WebSocket session. `Start-CodexWallpaper.ps1` now calls this supervisor instead of separately invoking `read-only-probe.mjs` and `static-background.mjs`.

## Reused infrastructure

- Existing PowerShell activation, package, main-process, profile, unique target, and loopback owner protections in `Start-CodexWallpaper.ps1`.
- Existing target discovery and CDP session utilities in `read-only-probe.mjs`.
- Existing scan signature/path resolution in `wallpaper-library.mjs`.
- Existing generation semantics, first-frame presentation callback, card state, runtime asset cache, and cleanup paths in `client-runtime.mjs`.
- Existing browser fixture and host protocol tests in `static-background.test.mjs`.
- Existing host process lock and compatibility Blob path in `wallpaper-host.mjs`.

## Automated verification

- Official `pnpm test`: 31 passed, 0 failed; `launcher/mp4-layout.test.mjs` is now part of the package test command.
  - Includes real CDP `DOM.setFileInputFiles` delivery in a real Edge page.
  - Includes front and tail synthetic MP4 layouts.
  - Includes File transfer cancellation, `blob:` playback, single-slot warming without `play()`, disable cleanup, Base64 fallback, and existing behavior regressions.
- PowerShell startup entry tests: 4 passed.
- PowerShell root/reuse tests: 3 passed.
- `git diff --check --ignore-cr-at-eol`: passed (CRLF conversion warnings only).

## Replacement regression fix

- The host CLI used to close its CDP session in a `finally` block immediately after printing `ready`, so later `Runtime.bindingCalled` replacement requests were never delivered. The session now closes only on initialization failure.
- The File fallback path referenced a `token` variable scoped inside `try`, so a failed File-input handoff threw `token is not defined` instead of completing the Base64 fallback. The token is now declared for both success and explicit cancellation.
- The existing replacement test now asserts a finite deadline and includes protocol diagnostics (call sequence, host stderr, socket state, write result, and CDP command sequence), so this regression cannot reappear as an opaque timeout.
- Focused replacement regression: passed in 280.9 ms.
- Related re-enable/discard regression: passed.
- Full official Node regression after the fix: 31/31 passed.

## Live instance evidence and limitation

- Installed package: `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`.
- Dedicated session marker: PID `47160`, port `59805`, created `2026-11-19T01:07:24.9197810+08:00`.
- A live reuse invocation returned `dedicated-instance-reused` without reconnecting, scanning, or re-injecting. Wall-clock observation was `4989 ms`, but this includes PowerShell process startup and is not a performance sample.
- The currently loaded page runtime hash was `27bf19fdaa7601e6e9e875f6d14329a828c41a9f5fac60c6cb10766192eab681`, which is not the new candidate runtime hash. The live page therefore has not received this implementation.
- The proposed candidate runtime hash after implementation is recorded below and must be compared after user-authorized restart.
- No Codex window was closed or restarted by this implementation work.

## Candidate identity

- Runtime hash: `52d753e9c344bb393c964e6945bc3d17a12d0e363379187c96d1846229896ec1`.
- Style hash: `a7adb923564a8cd66da635f73466e92bc8479e2d92fdca986983bbd3dd23a8d0`.
- Snapshot: `20261119-worktree-snapshot-52d753e9/` and `source-backup-20261119-52d753e9.zip`.
- Git HEAD: `57cfc04e58440df2f903a4241a1205e012ccb001`.
- Worktree contains pre-existing uncommitted changes; none were reverted or cleaned.

## Follow-up after the first live probe

The first live probe on the loaded `be6e4ce1...` candidate found two real bottlenecks and one measurement limitation. The details and raw results are in [the pre-fix live results](20261119-live-pre-fix-results.md).

- The large-video File path worked and avoided Base64, but the observed dynamic-frame latency was `714.7 ms` for the 110 MiB front-`moov` sample and `873.0 ms` for the tail-`moov` sample. This is a large improvement over the old 6-second transfer path but does not yet meet the cold p95 budget.
- The old hover implementation used the card's image thumbnail as the hidden video source, producing media error `4`. The source now uses a `warm-asset` host request, the same restricted File-input delivery, one blob-backed metadata slot, and releases that slot on metadata completion, candidate replacement, disable, reset, and page hide. A subsequent selection consumes the warm URL rather than starting another File transfer.
- Active changes no longer rebuild all cards. `renderPanel(false)` updates settings and card state in place; the full card list is built on the first panel open. The opening-panel regression now asserts `0` cards before the first open.
- The live selection feedback was `176-305 ms` to the selected attribute and `267-405 ms` to the first feedback frame. The source no longer performs the synchronous full card rebuild on active changes; the new candidate still needs a live measurement.
- Disable during a switch reached cleanup in `13.1 ms` from the trusted toggle dispatch and remained clean after 30 seconds.

## Current automated verification

- Node regression: `31/31` passed; log: `20261119-node-tests-52d753e9.txt`.
- Startup entry: passed; evidence log: `20261119-powershell-preflight-52d753e9.txt`.
- Profile/reuse preflight: 11/11 passed.
- Root ambiguity preflight: 3/3 passed.
- `git diff --check --ignore-cr-at-eol`: passed; log: `20261119-diff-check-52d753e9.txt`.

## Known limitations and open acceptance

- The latest candidate `52d753e9...` has not been loaded into the running instance. The current live process still has `be6e4ce1...`.
- The 110 MiB and 75 MiB real-file performance budgets, real rapid switching samples, full cold/startup T0-T7 samples, screen recordings, DSH baseline, and non-current preview byte counts remain unverified on the latest candidate.
- Do not close the current Codex instance without explicit user confirmation. Minimal user action is to save work, quit Codex normally, then run `launcher/Start-CodexWallpaper.ps1 -Launch -Unattended`.
- Visual quality, composition, colors, transparency, and typography are user acceptance criteria and are not marked passed.
- Final implementation status: functionality and deterministic performance behavior are complete in code and automated tests; live proposed-candidate performance and visual acceptance remain pending.
