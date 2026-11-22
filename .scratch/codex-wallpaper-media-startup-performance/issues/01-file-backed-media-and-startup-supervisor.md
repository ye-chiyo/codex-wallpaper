# 01 File-backed media and startup supervisor

Status: ready-for-agent
Type: task

## Scope

Implement the File-backed video lane, safe tail-moov virtual layout, single-slot warming, one-session startup supervisor, and deterministic behavior regressions.

## Result

- Implemented in `launcher/mp4-layout.mjs`, `launcher/client-runtime.mjs`, `launcher/wallpaper-host.mjs`, `launcher/wallpaper-library.mjs`, and `launcher/startup-supervisor.mjs`.
- Automated verification: Node 31/31, PowerShell startup 7/7 relevant assertions across two scripts.
- Detailed evidence: `../evidence/20261119-implementation.md`.
- The dedicated launcher loaded `8cc9fb36...` with `hostReady=true`. Live evidence is in `../evidence/20261119-live-8cc9fb36-results.md`. A front-moov video decoded frames but failed to hand over in 8 of 20 warmed attempts. Investigate the first-frame presentation gate before retesting performance. Full startup timing and user visual acceptance remain open.

## Comments

- 2026-11-19: Status moved to ready-for-human for user-approved restart/live acceptance and visual review. No unverified acceptance was marked passed.
- 2026-11-19: Fixed the replacement timeout introduced by the single-session host refactor. Root causes were the CLI closing its session after `ready` and a fallback-scoped `token` reference. The replacement and re-enable discard regressions now pass; full Node regression is 31/31.
- 2026-11-19: The first live probe loaded `be6e4ce1...` and confirmed that File-backed switching reduced the 110 MiB and 75 MiB paths to `714.7 ms` and `873.0 ms` to a real dynamic frame, with zero Base64 chunks. It also found that hover warm used the image thumbnail as a video source, and that active changes rebuilt all 106 cards. Follow-up source now uses a host `warm-asset` File slot, consumes that warm URL on selection, updates card state without rebuilding the list, and defers the complete card build until the first panel open. Latest candidate is `52d753e9...`; Node 31/31 and PowerShell preflights pass. Live measurements and visual acceptance remain pending because the running Codex instance still has the previous runtime.
- 2026-11-19: Reproduced the startup deadlock on the live launcher. PowerShell was still waiting for the long-lived supervisor and the loaded runtime had not enabled the host. Replaced the old second connect and injection with a two-stage handoff. The candidate `8cc9fb36...` passed the new handoff regressions, including fallback after PowerShell exits and cancellation while the page awaits a File. Waiting for the user-controlled restart to verify the actual loaded instance and repeat performance measurements.
- 2026-11-19: The user restarted and the actual dedicated instance reported `wallpaper-ready`, one supervisor, and the expected runtime. Timings on the real page showed that successful switches are faster, but the front-moov staging path intermittently stalls after decode. The original wallpaper config was restored. The product performance gate remains open.
- 2026-11-19: The user approved [Plan A](../../codex-wallpaper-plan-a/spec.md). The new switching behavior and unresolved acceptance are tracked in its [issue](../../codex-wallpaper-plan-a/issues/01-click-to-switch.md). This task still tracks the launch work.
- 2026-11-19 22:35: A fresh dedicated launch reached the exact main page at port 62165, then recorded `wallpaper-injection-failed` without a supervisor phase or host lock. The process exited after the verified handshake. Re-running the same supervisor against the settled page succeeded immediately with runtime `35e13dad`, host PID 25056, and the selected video playing. This identifies a startup-page handshake race: `startup-supervisor` closes its parent pipe when the pre-ready CDP session closes and has no reconnect/retry path before one-shot failure. The dedicated-session marker was corrected to main PID 54808 and port 62165 after recovery.
- 2026-11-19: The later slow-switch report was traced to the objectId query escaping. The misspelled selector made every File request fail at object lookup and silently fall back to full Base64. The fixed query is parsed by the host fixture and was verified in the running host: 4K90 → `《鸣潮》今昔` dropped from about 3.38 s to 258.2 ms, with zero Base64 chunks. Node regression is 41/41.
