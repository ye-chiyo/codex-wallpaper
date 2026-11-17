# Baseline findings

This file records performance evidence only. Visual acceptance remains with the user.

## Candidate identity

- Host and client: Windows, Codex desktop on the Asia/Shanghai host.
- Hardware: Intel Core i7-14650HX, 24 logical processors; NVIDIA RTX 4060 Laptop GPU.
- Installed package: `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`.
- Integration candidate at the start of T01: `044b8bf`.
- Main process: PID 18132, started `2026-11-17 13:00:19` local time; CDP listener was loopback-only on port 50521.
- Main target: exactly one `app://-/index.html` page.
- Chromium reported by CDP: `Chrome/157.0.8103.78`.
- Full live core identity: normalized-LF body SHA-256 `ff8b9aff265b10683eaca424ac5ca398353799b7bead036ae9ddda383257c7f0`; it matches the `044b8bf` core.
- Live stylesheet: SHA-256 `d0e22b84ad8848cba4b57877c1febacb581b07d53c76d566207b5591cd5591e9`, length 18,436.
- `044b8bf` normalized-LF stylesheet: SHA-256 `6a9c59cf45ac83ad78ac89ef2e9d1141ad67b1980bb871770bb67905f2c11981`, length 18,739.
- The only stylesheet difference is the two scoped browser-sidebar rules added by `044b8bf`. No browser-sidebar host or webview existed during the Scene samples, so those rules did not affect the measured Scene path.

## Fixed environment

- Viewport: 1707 x 1066 CSS pixels, device pixel ratio 1.5.
- Theme: dark; document visible and foregrounded.
- Material library: 106 entries; imported entries: 0.
- Library classes: 37 video/on-demand, 64 Scene/on-demand, 1 image/on-demand, 4 web/preview-only.
- Representative Scene: native renderer, 2561 x 1599, configured cap 30 FPS, material ID fingerprint `16f531121815eb59`.
- Control panel: closed during passive Scene samples.

## Measurement method

- The main page was sampled through the existing read-only CDP helper at one-second intervals.
- Each main run used a 60-second window with 61 samples, including both endpoints.
- Renderer CPU is the delta of Chromium `SystemInfo.getProcessInfo().cpuTime`, divided by wall time and expressed as percent of one logical processor.
- The main renderer was identified by matching CDP `Performance.getMetrics().ProcessTime` to the renderer process CPU clock. Every Scene run identified PID 33508.
- `TaskDuration` and `ScriptDuration` are renderer main-thread counters from CDP Performance. They are cumulative deltas, not wall-clock percentages inferred from frame screenshots.
- `JSHeapUsedSize` and `Nodes` are CDP point samples. A single increase is not evidence of a leak.
- GPU, process private memory, dedicated GPU memory, and shared GPU memory were collected separately by a single PDH background stream. GPU utilization is aggregate and cannot be assigned wholly to the wallpaper because Chromium/Codex processes are shared.
- Scene `measuredFps` is not exposed by the current public runtime state, so actual scene FPS is marked unmeasurable. The 30 FPS value is only the configured cap.

## Native Scene, 60 seconds x 3

Raw sanitized samples: [20261117-scene-baseline-3x60.json](20261117-scene-baseline-3x60.json).

| Run | Main renderer CPU, one-core | TaskDuration | Task occupancy | ScriptDuration | JS heap delta |            Nodes |
| --- | --------------------------: | -----------: | -------------: | -------------: | ------------: | ---------------: |
| 1   |                      19.53% |      6.775 s |         11.19% |        0.639 s |     +6.94 MiB | 11,499 to 11,499 |
| 2   |                      24.24% |      8.890 s |         14.68% |        0.766 s |     -9.54 MiB | 11,499 to 12,211 |
| 3   |                      44.60% |     18.006 s |         29.72% |        2.546 s |    +13.29 MiB | 12,211 to 17,816 |

- Median main-renderer CPU: 24.24% of one logical processor.
- Worst main-renderer CPU: 44.60% of one logical processor.
- The third run is a clear outlier: its Node count rose by 5,605 and its TaskDuration rose with it. It is retained in the raw data but is not treated as a pure steady-state Scene point. The source of that unrelated UI structure growth was not isolated.
- The Scene path currently has a confirmed renderer-side cost and large run-to-run dispersion. Media decoding alone is not a sufficient explanation for the observed renderer and task cost; additional full-frame or compositor attribution remains unconfirmed.

## Supplemental PDH Scene run

- One independent 64.79-second run produced 61 samples.
- Codex-process total CPU: 1.593% of all 24 logical processors, equivalent to 38.23% of one logical processor.
- Private memory: 2,916.867 MiB to 2,900.059 MiB.
- Dedicated GPU memory: 408.750 MiB to 410.164 MiB.
- Representative 3D utilization: approximately 19% to 20% aggregate.
- This run is supplemental because it was collected independently and must not be pooled with the three-run matrix.

## Native video, 60 seconds x 3

Raw sanitized samples: [20261117-video-3x60.json](20261117-video-3x60.json).

| Run | Main renderer CPU, one-core | Task occupancy | Draw FPS | JS heap delta |            Nodes |
| --- | --------------------------: | -------------: | -------: | ------------: | ---------------: |
| 1   |                      22.34% |         12.84% |       27 |   -197.36 MiB | 22,199 to 19,914 |
| 2   |                      20.25% |         12.16% |       28 |     -0.14 MiB | 19,914 to 19,914 |
| 3   |                      20.84% |         12.60% |       28 |     +2.80 MiB | 19,914 to 19,977 |

- Median main-renderer CPU: 20.84% of one logical processor.
- Median TaskDuration occupancy: 12.60%.
- The test used the same 1888 x 1078 video, visible window, dark theme, 30 FPS configured cap, one Canvas, and one hidden video source throughout.
- The Canvas drawing counter remained at 27–28 FPS. The `requestAnimationFrame` callback is still scheduled at display refresh cadence; 30 FPS is a drawing cap, not a decode or callback cap.

## Wallpaper disabled, 60 seconds x 3

Raw sanitized samples: [20261117-disabled-3x60.json](20261117-disabled-3x60.json).

| Run | Main renderer CPU, one-core | Task occupancy | JS heap delta |            Nodes |
| --- | --------------------------: | -------------: | ------------: | ---------------: |
| 1   |                       5.70% |          2.30% |     +5.92 MiB | 20,478 to 18,928 |
| 2   |                       5.16% |          1.18% |     -2.50 MiB | 18,928 to 18,976 |
| 3   |                       5.21% |          1.19% |     +4.16 MiB | 18,976 to 18,993 |

- Median main-renderer CPU: 5.21% of one logical processor.
- The disabled condition had the same visible Codex page and no wallpaper media node.
- Video minus disabled median renderer CPU: 15.63 percentage points of one logical processor.

## Static image, 20 seconds x 3

Raw sanitized samples: [20261117-image-3x20.json](20261117-image-3x20.json).

| Run | Main renderer CPU, one-core | Task occupancy | JS heap delta |            Nodes |
| --- | --------------------------: | -------------: | ------------: | ---------------: |
| 1   |                       5.64% |          1.42% |     +1.21 MiB | 19,981 to 19,981 |
| 2   |                       5.37% |          1.36% |     +0.33 MiB | 19,981 to 19,981 |
| 3   |                       5.98% |          1.64% |     +0.23 MiB | 19,981 to 19,981 |

- Median main-renderer CPU: 5.64%, close to the disabled baseline.
- The active image remained a single `<img>` with no Canvas, video, or animation loop.
- The stale public `measuredFps` value was still 24. It describes no image work and must not be presented as a real image FPS in the settings UI.

## Hidden Scene, 60 seconds x 3

Raw sanitized samples: [20261117-scene-hidden-3x60.json](20261117-scene-hidden-3x60.json).

| Run | Main renderer CPU, one-core | Task occupancy | Script duration |            Nodes |
| --- | --------------------------: | -------------: | --------------: | ---------------: |
| 1   |                       5.26% |          3.14% |          0.48 s | 20,901 to 20,337 |
| 2   |                       2.83% |          1.12% |          0.22 s | 20,337 to 20,337 |
| 3   |                       4.50% |          2.60% |          0.21 s | 20,337 to 20,337 |

- The dedicated page reported `visibilityState: hidden` in every sample.
- The visible Scene median was 24.24% versus 4.50% hidden, so the existing pause path produced a material reduction despite the visible Scene's high dispersion.

## Settings, switching, and lifecycle

- Raw settings samples: [20261117-settings-interaction.json](20261117-settings-interaction.json).
- Raw paced switching, rapid selection, disable, and re-enable samples: [20261117-switch-lifecycle.json](20261117-switch-lifecycle.json).
- Raw controlled transfer sample: [20261117-transfer-probe.json](20261117-transfer-probe.json).
- Raw video and image load samples: [20261117-load-video.json](20261117-load-video.json), [20261117-load-image.json](20261117-load-image.json).
- Navigation through the public runtime produced a disabled media-free state in 88 ms.
- Opening and closing the settings panel 11 times added 1,166 wallpaper cards, exactly 106 cards per toggle. The panel rebuilds every card and all setting controls each time it opens or closes.
- Click-to-double-`requestAnimationFrame` panel feedback was 71.4–129.4 ms. Slider-key feedback was 73.0–91.6 ms.
- Thirty arrow-key changes to the FPS slider produced 60 synchronous localStorage writes because FPS saves once unconditionally and again in its branch.
- A controlled storage event for one appearance value added 106 cards and one staged media node, and replaced the currently visible media node. This confirms that cross-window setting sync currently re-renders the library and reloads the wallpaper.
- Ten paced image/video cycles all reached the requested final type with one mounted media container and no staged container at the endpoint. Image readiness was 655–741 ms. Returning to the representative on-demand video was 6.01–6.90 seconds.
- The controlled transfer probe confirmed one `load-asset` request for the video on every return from the image. The representative video is 226.51 MiB. Retaining it automatically would trade a 6.7-second transfer for substantial memory use, so this baseline does not authorize a cross-selection cache.
- Three rapid choices resolved to the last video in 251 ms with one mounted media container, no staged leftovers, and active playback.
- Disable removed the media node in 17 ms. Re-enable reached a playing video in 6.20 seconds because the large on-demand transfer was required again.
- Ten paced cycles ended 4.34 MiB below their first sample. Global Node counts were not used as a leak signal because Codex's live conversation/tool UI changed the surrounding DOM during the run; wallpaper media and staged counts remained stable.

## Measurable limits

- The library contained four Web entries but no playable native offline-Web sample. Preview-only Web was not accepted as native-Web evidence; native Web FPS and pause behavior remain unmeasured.
- Scene exposes no measured FPS through the public runtime state. The configured 30 FPS cap is known, but actual rendered Scene FPS is unavailable.
- GPU utilization and memory are process-wide. They cannot be attributed wholly to the wallpaper, especially for shared Chromium GPU processes.
- The native video and Scene paths cannot yet be split further into hardware decode, raster, and compositor cost with the available counters.
- A short performance matrix does not replace the existing 8-hour or 7-day stability gates.

## Confirmed hotspots and excluded hypotheses

- Confirmed: native video has materially more renderer CPU than disabled or static-image states.
- Confirmed: video rAF callbacks run at display cadence even though draws are capped. Replacing the callback scheduling with the video frame source is eligible for T02.
- Confirmed: appearance synchronization rebuilds all 106 cards and reloads the current media. Targeted sync and panel updates are eligible for T03.
- Confirmed: continuous slider input performs duplicate writes. Coalesced persistence with a final flush is eligible for T03.
- Confirmed: a 226.51 MiB video is retransferred on each switch back from another asset. A persistent cache is excluded because its memory cost conflicts with the task's resource goal.
- Confirmed: the Scene path already pauses when hidden and honors the configured FPS API. No same-quality unused-loop evidence justifies rewriting or replacing WebWallGL.
- Confirmed: static images already stop after a single stable frame.
- Unconfirmed: replacing the video Canvas with direct video compositing. It may reduce CPU, but must retain crop, first-frame handoff, failure recovery, pause/resume, and visual behavior.
- Unconfirmed: Scene CPU could be reduced without lowering quality. T02 will not claim such an improvement; user-selected performance quality belongs to T05.

## Fixed optimization budgets

These thresholds were fixed after the baseline and before any T02-T07 product-code optimization.

1. **Native video steady state:** median main-renderer CPU across three 60-second runs must fall from 20.84% to at most 17.50% of one logical processor. This requires an improvement larger than both the 2.09-point video range and the 0.54-point disabled range.
2. **Static image steady state:** no continuing media/draw loop; median main-renderer CPU must remain within 1.5 points of the disabled median (at most 6.71%).
3. **Hidden activity:** a hidden representative wallpaper must not add more than one percentage point over the disabled median; Scene hidden CPU must remain at most 6.21%. Restoring visibility must leave exactly one active media/player and resume playback.
4. **Disable:** within 500 ms the wallpaper state is disabled, no wallpaper media node remains, and no stale preparation is allowed to remount. This is an end-state budget; background work may finish asynchronously only if it cannot revive media.
5. **Rapid selection:** the last choice must win, with at most one active media container and zero staged containers after settling. Cached/fixture transitions must settle within 1 second; the 226.51 MiB on-demand video may take at most 8 seconds.
6. **Repeated switching:** ten paced image/video cycles must end within +15 MiB of their first JS heap sample. Every endpoint must have one active media container, zero staged containers, and no monotonically growing active-player count.
7. **Settings feedback:** panel open/close and slider preview must reach the painted second animation frame with p95 at most 150 ms and maximum at most 250 ms.
8. **Persistence:** one settled slider burst may perform at most one localStorage write after preview updates, and the final value must survive closure/reopen and reload.
9. **Cross-window settings:** appearance, volume, supported in-place playback settings, favorites, and playlist changes must not replace the visible media node, create a staged media container, or rebuild the wallpaper-card list.
10. **Panel rebuild:** opening/closing an already mounted panel and updating non-identity settings must add zero wallpaper cards. Library preview arrival may update only its own thumbnail.
11. **No regression:** disabled CPU must remain at or below 5.75% median of one logical processor in the same final candidate, within observed baseline spread.

All comparisons use the same media, 1707 x 1066 CSS-pixel window at DPR 1.5, visible dark-theme dedicated page, and the existing CDP/PDH measurement definitions. Lower-quality performance-profile energy savings, when implemented in T05, must be reported separately from same-quality improvements.

## 2026-11-17 pause and resume

- User asked to pause after the current operation and continue after switching models. The live test processes and the T01 subagent were stopped. No T02–T08 writes or acceptance started.
- After the user foregrounded the existing window, the matrix reached the wallpaper-disabled state but stopped before the 60-second run: its child sampler `baseline-smoke.mjs` had been moved or removed from the T01 worktree. This attempt yields no disabled performance result.
- The matrix cleanup verified that the exact prior stored config was restored and that all 106 library entries remained. The prior panel open state was restored, and no further live operation was started.
- Resumed against integration `044b8bf`, completed the remaining visible controls, and fixed the budgets above before optimization.

## 2026-11-17 T03 settings interaction and config sync

The fixed pre-change live baseline recorded:

- Thirty FPS slider changes produced 60 synchronous localStorage writes.
- Opening and closing the mounted panel 11 times added exactly 106 cards per toggle.
- One appearance `StorageEvent` added 106 cards, created one staged media node, and replaced the visible media node.

The T03 candidate starts from integration `7668cae`. Headless Edge behavior evidence from the existing browser fixture now records:

- A 30-event opacity burst updates the visible preview immediately and performs one config write when the slider is committed; the final value survives panel close/reopen.
- A remote event received while that local write is pending flushes the pending local value and does not drop it. A later remote event, received with no pending local write, is applied normally.
- An appearance, volume, FPS, favorites, and playlist `StorageEvent` preserves the same wallpaper cards, settings elements, visible media node, panel focus, and panel scroll position. It creates zero cards and zero staged media nodes. Video volume changes on the existing video.
- A material identity `StorageEvent` still reloads to the new material and settles with zero staged media nodes.
- Opening, closing, and reopening the mounted panel adds zero cards.

Validation: the full Node suite passed 18/18; the profile, startup-entry, and startup-roots PowerShell preflights passed; Prettier and `git diff --check` passed.

These results are headless fixture behavior evidence for source review. They do not replace the real Codex p95/maximum settings-interaction latency measurement, the same-candidate real settings path, the 8-hour gate, or the 7-day gate. The corresponding T03 acceptance boxes remain unchecked.
