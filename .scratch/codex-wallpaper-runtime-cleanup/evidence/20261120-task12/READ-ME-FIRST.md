# Task 12 live acceptance

Current real dedicated instance:

- Package: `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`
- Main PID: `58548`
- CDP port: `60377`
- Wallpaper host PID: `62716`
- Runtime: `4825681e…`
- Viewport: `1706×1066`, DPR `1.5`

The dedicated entry reached `wallpaper-ready`, but the first host exited when the page target changed after startup. It was recovered from the exact matching successful receipt and then completed the acceptance run. This is not yet an automatic post-start reattach.

Results are in `live-60377/`; the consolidated summary is `live-acceptance-20261120.md`. All functional, material, reset, cross-window, failure, interaction and visible-performance scripts exited `0`. Final candidate and configuration checks pass.

Remaining:

- Front-video hot-switch dynamic-frame p95 was `300.3 ms` and `309.3 ms`, above the `300 ms` budget; tail was `262.5/273.9 ms`.
- A page-target change after a successful handoff still requires re-invoking the dedicated entry; continuous automatic reattach is not implemented.
- Visual acceptance remains with the user.

No commit, push or PR was made. Raw chat content, account data and material paths are not written by the acceptance scripts.
