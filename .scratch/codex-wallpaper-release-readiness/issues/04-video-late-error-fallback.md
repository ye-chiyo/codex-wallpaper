# 04: 已提交视频的 late-error 降级

**What to build:** 视频加载并提交首帧之后，如果发生解码或播放错误，页面必须保留旧画面、作者预览或明确静态降级，并给出可观察状态。不能因为首帧已提交就忽略后续错误，也不能留下黑屏、重复播放器或永久“加载中”。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 在已提交视频上增加 late-error 处理，区分当前选择、旧选择、已停用和已取消状态。
- [x] 失败时保留可读的当前画面或预览，更新运行状态，不错误地重新启动旧素材。
- [x] 不因 late-error 产生第二个活动播放器、残留 Blob URL 或重复预览循环。
- [x] 复用现有媒体 stage/cancel/commit envelope，不为视频新增独立状态机。
- [x] 增加一个真实浏览器回归，证明首帧后错误能触达用户可见降级。

## Acceptance evidence

- 首帧后触发 video error 的回归先红后绿。
- 旧画面或预览保留，状态可观察，活动播放器数量仍为一个或零个。
- 停用、切换和取消后迟到的错误不会复活旧选择或当前选择。

## Comments

- 2026-11-23 红循环：临时把 `video.onerror = lateError` 回退为 `video.onerror = fail`（首帧提交后仍绑定已 settled 的失败处理器），运行 `node --test --test-concurrency=1 --test-name-pattern="committed video degrades" launcher/static-background.test.mjs`，1 失败、约 3.8 秒。失败断言为 `degraded=false`、`status="Late Error Video · 视频"`、`playerCount=1`、`blobRevoked=false`，复现旧实现吞掉首帧后错误。
- 2026-11-23 绿循环：恢复 `launcher/client-runtime.mjs:1928` 的 `video.onerror = lateError` 后，同一用例 1/1 通过，约 1.4 秒。
- 2026-11-23 判定顺序：`launcher/client-runtime.mjs:1903-1917` 依次检查 `config.enabled`、`isCurrentStage`、`media === next`、`mediaSelection === selection` 和 `entryKey(config.active) === selection`；旧选择、已停用和已取消的迟到错误都会直接丢弃，不会复活旧素材。
- 2026-11-23 降级证据：用例在真实 headless Edge 的 `<video>` 上把 `src` 改为不可解码的 `data:video/mp4;base64,AAAA` 并 `load()`，首帧提交后触发真实解码错误。断言状态匹配 `/视频播放失败.*预览/`、预览图 `naturalWidth > 0`、`playerCount=0`、`videoCount=0`、`.media.staged=0`、Blob URL 已撤销。
- 2026-11-23 复用：只复用 `stageMedia`、`trackPending`、`commitMedia`、`revokePlayback` 和 `recoverFailedMedia`，未新增视频状态机或第二套播放器。
- 2026-11-23 组合回归：`--test-name-pattern="committed video degrades|offline Web blocks"` 2/2 通过，约 5.4 秒；全量 `pnpm.cmd test` 94/94、0 跳过，约 146.3 秒。
- 未验证：真实 Codex 页面内的迟到解码错误、真实设备休眠/唤醒后的播放错误和长期稳定性。
