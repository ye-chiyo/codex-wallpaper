# 2026-11-20 失败专用启动的恢复复测

## 现象

第一次真实冷启动在 `verified` 后以 `main-frame-unverified` 失败，但 Codex 主进程继续运行。后续从专用入口启动时，隐藏窗口没有显示壁纸；watchdog 持续报告等待 Codex 退出。

## 原因

1. 运行中的主进程仍是 11:51:24 创建的 `55692`，不是重新启动后的新进程。失败的专用启动没有写入可复用会话标记，`dedicated-session.json` 仍指向更早的实例。
2. 专用入口看到带调试端口但没有匹配成功标记的实例时按设计拒绝再次激活。
3. 手工接回后页面仍保留匹配运行时，但宿主已退出。监督进程原先在检测到 `__codexWallpaperApi` 时直接返回 `runtime-not-ready`，没有重新绑定宿主。
4. Node 宿主以独占方式持有 `codex-wallpaper-host-55136.lock`。PowerShell 用 `ReadAllText` 判断宿主时触发共享冲突，把仍存活的宿主误判为不存在，从而让重复入口错误进入恢复路径。

## 修复

- 只对本地失败回执与运行中主进程的 PID、创建时间、端口、可执行文件、日常 profile、环回监听归属和“当前无宿主”全部匹配的实例，重试监督握手。
- 页面已有匹配运行时且身份一致时，通过 `configureHost()` 重新绑定宿主；身份不匹配仍失败关闭。
- 宿主锁文件可读时按 PID 校验；锁存在但被独占持有视为宿主存活；文件缺失或 PID 已退出仍视为不存在。
- 恢复成功后才写 `dedicated-session.json`，后续入口只复用，不重复注入。

## 证据

- `recovery-20261120-124315-receipt.json`：恢复成功，`Outcome = wallpaper-ready`，`HostReady = true`，宿主 PID `42736`。
- `recovery-20261120-124550-reuse-receipt.json`：再次调用专用入口得到 `dedicated-instance-reused`，退出码 `0`。
- `recovery-candidate-check.json`：运行时与样式哈希均匹配当前工作树候选。
- `recovery-page-state.json`：壁纸启用、背景层 1、播放器 1、宿主就绪、聊天输入存在。
- `pnpm test`：56/56 通过；`startup-roots.test.ps1`、`profile-preflight.test.ps1`、`startup-entry.test.ps1`、基线身份探针和 Prettier 均通过。

## 边界

本次是失败实例的恢复与幂等复用，不是第二次真实冷启动。当前 Codex 主进程仍未退出，因此任务 12 的冷启动、代表素材、性能与重置验收仍待用户真正完全退出后由 watchdog 执行。视觉结论仍由用户确认。
