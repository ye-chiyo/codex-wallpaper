# 07: 真实 WebWallGL Scene fixture 与集成

**What to build:** 用真实 `webwallgl@3.0.0` 和真实、可复现的 Scene fixture 验证生产渲染路径，而不是通过注入 fake `WebWallGL` 证明运行时接线。测试需要覆盖首帧、Canvas 尺寸、暂停/恢复、帧率、音量、fit 和不支持时的预览降级，并证明切换/取消/失败后资源被释放。

**Blocked by:** None (can start immediately; an external fixture availability check is required)

**Status:** ready-for-agent

- [x] 选择可分发或用户授权、脱敏且可复现的 Scene fixture，记录来源、大小、哈希和许可边界。
- [x] 测试加载实际安装的 WebWallGL 运行时，不允许 fake engine 作为完成证据。
- [x] 验证首帧、Canvas 尺寸、暂停/恢复、帧率、音量和 fit 能力；不支持项必须产生明确的预览降级。
- [x] 场景切换、取消、失败、停用和 reset 后释放 Scene、Blob URL 和活动播放资源。
- [x] 若没有合法 fixture，记录阻塞原因，不把 fake engine 结果升级成通过。（不适用：路线 A 可行）

## Acceptance evidence

- 真实 engine 加载和真实 Canvas 生命周期证据。
- 至少一个 Scene fixture 的首帧、暂停、恢复、帧率、音量和 fit 结果。
- 失败和取消路径的资源释放证据。
- fixture 来源、哈希、授权状态和未覆盖限制已写入验收记录。

## Comments

- 2026-11-23：可行性 gate 选择路线 A。`@webwallgl/editor@3.0.0` 没有独立“新建空白工程文档” API，因此使用其官方 `buildScenePkg` / `checkWeCompat` 对手写的合成 `project.json`、`scene.json` 和 WAV 进行打包与回读。生成器位于 `launcher/fixtures/minimal-scene/generate.mjs`，fixture 为 `launcher/fixtures/minimal-scene/scene.pkg`，2,994 字节，SHA-256 `be12f6570fdf7f8291fe9777494e16329ed4750155970ddeac08c635b84d018a`，2 层、0 错误。fixture 只含合成文本与音频，不含第三方壁纸素材；`webwallgl` 与 `@webwallgl/editor` 均为 MIT。
- 2026-11-23：新增 `@webwallgl/editor@3.0.0` 为 devDependency，仅用于 fixture 生成；peer 与现有 `webwallgl@3.0.0` 一致，不新增运行时依赖。
- 2026-11-23：host 测试确认生产 `engineUrl` 读取的 `webwallgl.global.min.js` 与安装文件逐字一致后才交付真实 `scene.pkg`。headless Edge 真实引擎测试验证首帧、Canvas 尺寸、FPS 上限切换、0.4→0.25 音量、`contain`/`cover` 帧差异、暂停/恢复，以及损坏包预览降级。切换、停用和 reset 后真实 WebGL 上下文丢失，Scene Blob URL 被撤销，活动 Canvas/播放器归零；取消路径保持无残留 staged 节点和播放器。
- 2026-11-23：现有 5 处 fake `WebWallGL` 用例保留为接线测试，未作为本 ticket 的完成证据。验证：`node --test --test-concurrency=1 launcher/static-background.test.mjs` 62/62；`node --test --test-concurrency=1 launcher/wallpaper-host.test.mjs` 5/5。聚合 `pnpm test` 为 92/94，失败项是既有的 supervisor 目标替换等待和一次本地 CDP 连接超时，与本 ticket 的新增用例无关；两条新增真实 engine 用例在聚合运行中均通过。未覆盖真实 Codex、模型/粒子/shader/视频纹理、创意工坊通用兼容和长期运行。
