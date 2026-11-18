# T08 integrated candidate acceptance

Updated: 2026-11-18, Asia/Shanghai.

## Current state

- Candidate branch: `codex/wallpaper-performance-settings`.
- Candidate commit: resolve from the launching integration worktree with `git rev-parse HEAD` immediately before start and record that exact SHA with the receipt.
- Candidate runtime hash: `58a81a15effed517b4aa7c23f23254e60d4c5dee0508395e4572ee731a62ef85`.
- Candidate generated style hash: `2279f3528465d8db61ebf62d20165a08112142a10891f108a1a0e24ad1b7dab2`.
- Installed package: `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`.
- Main process currently loaded: PID 18132, created `2026-11-17 13:00:19`, port 50521.
- The current page has the older style hash `d0e22b84ad8848cba4b57877c1febacb581b07d53c76d566207b5591cd5591e9` and no `identity()` API. It is not the T08 candidate.
- Current main target, package, loopback port and daily profile match the dedicated receipt. No restart or candidate load has been attempted.

## Automated evidence

- Full Node/browser suite: 23/23 passed on the final integrated source.
- Baseline probe tests: 2/2 passed.
- Profile, startup-entry and startup-root PowerShell preflights passed.
- Prettier and `git diff --check` passed.
- Browser fixture coverage includes the full settings path, media capability branches, in-place settings updates, cross-window nested merge, presets/migration/import/export/reset, disable cleanup and candidate identity.
- Real Codex same-candidate function, performance and ten-cycle checks remain pending until the dedicated cold start.

## Minimal cold-start steps

1. Save work and completely exit every Codex window. Closing or minimizing a window is insufficient.
2. In a normal PowerShell window run:

   ```powershell
   Set-Location 'D:\AI\codex-wallpaper-hardening'
   .\launcher\Codex-Wallpaper.cmd
   ```

3. Wait until the launcher reports:

   ```text
   Outcome: read-only-probe-passed
   Wallpaper: enabled
   ```

4. Leave that dedicated Codex window visible and say that it has started. No login entry, profile creation or product launch-file modification is needed.

## Post-launch agent checks

1. Read `%LOCALAPPDATA%\CodexWallpaper\P0b\dedicated-session.json` and verify PID, creation time and loopback port against the process tree.
2. Run:

   ```powershell
   $port = (Get-Content "$env:LOCALAPPDATA\CodexWallpaper\P0b\dedicated-session.json" -Raw | ConvertFrom-Json).Port
   node .scratch\codex-wallpaper-performance-settings\candidate-check.mjs $port
   ```

   The check must report `pass: true` and exactly one `app://-/index.html` target through the existing read-only probe.

3. Capture the candidate snapshot with `baseline-probe.mjs`.
4. Run real settings, media capability, rapid selection, failure retention, disable/re-enable, keyboard, input, scroll and ten chat/changes cycles.
5. Re-run the fixed performance matrix:
   - visible representative video: 60 seconds x 3;
   - visible representative Scene: 60 seconds x 3;
   - hidden Scene: 60 seconds x 3;
   - static image: 20 seconds x 3;
   - disabled: 60 seconds x 3;
   - settings interaction, rapid selection, ten switching cycles and load timings under the existing conditions.
6. Compare the candidate against the budgets in `baseline-findings.md`, retain raw sanitized samples and stop all diagnostic sampling afterward.

## Status matrix

| Gate                                 | Status                 |
| ------------------------------------ | ---------------------- |
| Source implementation 04–07          | Passed                 |
| Automated browser regression         | Passed                 |
| Candidate identity tooling           | Prepared and tested    |
| Candidate actually loaded            | Pending cold start     |
| Real Codex function path             | Pending candidate load |
| Same-candidate performance           | Pending candidate load |
| User visual and aesthetic acceptance | Pending user           |
