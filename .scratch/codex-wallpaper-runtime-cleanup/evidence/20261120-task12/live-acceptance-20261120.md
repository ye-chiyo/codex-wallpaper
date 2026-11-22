# 2026-11-20 真实专用入口验收结果

## 身份与启动

- 工作树：`codex/wallpaper-performance-settings`，HEAD `57cfc04`，保留脏工作树。
- 包：`OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`。
- 真实专用启动：主进程 `58548`，端口 `60377`，`Outcome = wallpaper-ready`，目标核验 2 次，宿主 `12372`。回执：`startup-success-20261120-130122.json`。
- 启动阶段：`TargetAcknowledgedMs = 4927`、`TargetReverifiedMs = 6897`、`HostReadyMs = 8879`。这些是入口内部阶段值；尚未建立与官方入口的 T0–T7 差值样本。
- 启动后页面目标再次切换，原宿主退出。专用入口从精确匹配的成功回执恢复：宿主 `62716`，`Outcome = wallpaper-ready`。回执：`recovery-20261120-131009-receipt.json`。
- 最终候选：运行时 `4825681e…`，样式 `47a54154…`；再次调用入口为 `dedicated-instance-reused`，退出码 `0`。
- 最终页面：壁纸启用、1 个背景层、1 个播放器或当前媒体、宿主就绪、聊天输入存在，视口 `1706×1066`、DPR `1.5`。

## 代表素材

- 115,500,404 B 前置 `moov`：提交 `367.2 ms`，动态帧有效，File 3、Base64 0、暂存 0、临时输入 0。
- 75,689,196 B 尾置 `moov`：提交 `183.7 ms`，动态帧有效，File 1、Base64 0、暂存 0、临时输入 0。
- 564,467,901 B 吊桥：提交 `220.2 ms`，动态帧有效，File 1、Base64 0、暂存 0、临时输入 0。
- 4K 视频：提交 `121.6 ms`，动态帧有效，File 1、Base64 0、暂存 0、临时输入 0。
- 4K90 →《鸣潮》今昔：提交 `181.7 ms`，两帧 `mediaTime` 前进，File 1、Base64 0、暂存 0、临时输入 0。
- 原文：`live-60377/four-assets/four-assets.json`。

## 切换、停用与故障

- 前置/尾置热切各 20 次，零错误；点击反馈 p95 `28.9 / 26.7 ms`，提交 p95 `205.5 / 164.5 ms`。
- A→B→C `344.7 ms`，A→B→A `322 ms`；复测为 `322.8 / 286.7 ms`。
- 切换中停用 `226.6 ms`，30 秒后仍为 `disabled`、根层 0、播放器 0。
- 缺失素材保留旧画面并显示明确状态。
- 原文：`live-60377/live-switch-full.json`、`live-switch-full-repeat.json`。

## 设置、交互与重置

- 面板打开复用、筛选、图片、Scene、视频、Web 降级、预设、导入导出、10 轮切换和启停均通过。
- 跨窗口更新：透明度 66 生效，媒体与 106 张卡片节点保持不变。
- 持久化：一次写入，关闭重开值一致。
- 可控失败：旧画面保留，错误明确。
- 完整重置：停用、根层/播放器/临时输入清空；重新启用后工坊 File 重新交付；原配置精确恢复。
- 原文：`live-60377/real-functional.json`、`real-interaction-full.json`、`reset-restore.json`。

## 性能

- 可见矩阵全部有效，零拒绝样本：视频 3×60、Scene 3×60、图片 3×20、Scene 性能档 3×60、停用 3×60。
- 主渲染器 CPU 中位数：视频 `37.46%`、Scene `44.76%`、图片 `7.83%`、Scene 性能档 `24.80%`、停用 `8.92%`。
- 无完整 Base64，File 通路保持。
- 未达项：前置视频热切到真实动态帧的 p95 为 `300.3 ms` 和 `309.3 ms`，高于 `300 ms` 门槛；尾置为 `262.5 / 273.9 ms`。
- 启动性能未完成：没有官方入口与专用入口的 T0–T7 对照，也没有独立的启动 T5 首帧/T6 动态帧样本。
- 原文：`live-60377/real-performance-visible.json`。

## 回归

- `pnpm test`：56/56。
- `profile-preflight.test.ps1`、`startup-roots.test.ps1`、`startup-entry.test.ps1`：通过。
- 基线候选探针：2/2。
- Prettier 与 PowerShell 语法检查：通过。

## 遗留

- 启动成功后页面目标再次切换时，宿主不会自动恢复；当前通过再次调用专用入口恢复。连续自动重连尚未实现和实测。
- 前置视频热切动态帧 p95 仍有约 0.3–9.3 ms 超出预算。
- 用户视觉结论仍由用户确认；未提交、未推送、未创建 PR。
