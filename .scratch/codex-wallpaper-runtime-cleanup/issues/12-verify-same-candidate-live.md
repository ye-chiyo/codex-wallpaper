# 12 从真实专用入口完成同一候选端到端验收

Status: in-progress
Type: task
Blocked by: [11 统一扫描快照、允许根与交付复核](./11-align-scan-snapshot-and-roots.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 待用户明确授权关闭或重启当前 Codex，或由用户自行关闭并从专用入口启动。执行者负责同候选工程验收、原始数据和结论；已有用户视觉验收单独记载，需要追加视觉确认时由用户判断。
- 先获取真实启动回执和实际运行的包、主进程、端口、精确页面、监督进程与运行时/样式指纹，再做切换和性能采样。使用隔离的验收配置和素材执行破坏性重置或故障场景。

## 验收标准

- [ ] 真实专用入口成功完成握手，宿主唯一，首次正确画面与真实动态帧有证据，且聊天输入和滚动可用。临时注入、手工接回和自动化分别归档，未验证项保留待验。
- [x] 首次打开壁纸库按需构建，重开复用。普通图、115,500,404 B 前置、75,689,196 B 尾置、564,467,901 B 吊桥及 4K 视频分别具备当前层证据。4K90 →《鸣潮》今昔另查零暂存层、零临时输入、连续两帧 `mediaTime` 前进和零意外完整 Base64。
- [x] A→B→C 和 A→B→A 只提交最终选择；切换中停用在 500 ms 内清理且 30 秒不复活；缺失、读失败、解码失败保留旧画面和明确状态。
- [x] 设置打开、修改、关闭、重开、跨窗口和导入导出或分组重置通过。隔离配置上完成完整重置及工坊重新交付。恢复用于实机测量的配置并记录恢复验证。
- [ ] 按 [原媒体与启动预算](../../codex-wallpaper-media-startup-performance/spec.md#2-切换验收) 及 [方案 A](../../codex-wallpaper-plan-a/spec.md) 的样本量、上限和时钟分别记录反馈、首帧、动态帧、输入、滚动及资源。重复切换使用同进程已成功播放样本。保留失败、超时、计时起点、窗口条件及缓存状态。
- [x] 复核每批代码删减、兼容保护、测试结果及遗留缺口。每项证据附执行命令或实际操作、原始输出路径、候选身份和结论。最终从真实专用入口实测后才更新验收状态。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test .scratch/codex-wallpaper-performance-settings/baseline-probe.test.mjs
powershell.exe -NoProfile -File ./launcher/profile-preflight.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-roots.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-entry.test.ps1
pnpm test
```

## 真实入口与测量命令

从专用入口的成功回执取端口与主进程。仅在已获明确授权、当前实例已按授权关闭后执行启动命令。从项目根目录执行，启动回执留作本轮证据。

```powershell
powershell.exe -NoProfile -NonInteractive -STA -WindowStyle Hidden -File ./launcher/Start-CodexWallpaper.ps1 -Launch -Unattended
# $port 从本次成功回执取得。
Get-NetTCPConnection -State Listen -LocalPort $port
node --no-use-env-proxy .scratch/codex-wallpaper-performance-settings/candidate-check.mjs $port
```

现有探针覆盖部分用户流程。使用本轮独立输出路径，`$configBackupJson` 指向尚未创建的配置备份，其他测量的 `$initialConfig` 指向已核验的当前配置副本。先核对配置与目标身份。切换、动态帧和日常交互采样保持主界面前台可见，隐藏场景沿用原规格的条件。

```powershell
node --no-use-env-proxy .scratch/codex-wallpaper-media-startup-performance/evidence/20261119-live-switch-probe.mjs $port $lifecycleJson $configBackupJson lifecycle
node --no-use-env-proxy .scratch/codex-wallpaper-performance-settings/real-functional-acceptance.mjs $port $initialConfig $functionalJson
node --no-use-env-proxy .scratch/codex-wallpaper-performance-settings/real-interaction-metrics.mjs $port $initialConfig $interactionJson latency
```

实机脚本结果只覆盖实际运行的步骤。`lifecycle` 沿用已挂载的候选；历史 `plan-a-candidate`、`plan-a-lifecycle`、反馈和交互对照模式会临时换运行时，其结果单独归档。其余素材、精确过渡、样本量和故障场景用现有实机探针接入点及受信任用户操作补测。操作前后核对身份和配置。

## Comments

- 2026-11-20：用户明确授权开始任务 12。当前专用实例主进程 54808、端口 62165，实际运行时为旧候选 `35e13dad…`；工作树候选为 `f60cd7c7…`，因此必须真实冷启动。当前会话内无法安全关闭自身后继续取证，已启动独立 watchdog 54960，等待用户保存工作并完全退出 Codex。watchdog 将从专用入口冷启动，运行生命周期、代表素材、设置、交互、完整重置/恢复和性能探针。预检证据位于 `evidence/20261120-task12/preflight-*`，交接说明为 `evidence/20261120-task12/READ-ME-FIRST.md`。
- 2026-11-20 第一次真实冷启动：专用入口成功获取回执并到达 `verified`，但页面切换期间监督进程得到一次 `main-frame-unverified`，回执为 `wallpaper-injection-failed`。已修复为在规定次数内重新发现并复核目标，并新增确定性回归。手工接回当前专用实例后，候选身份匹配；四素材/4K90 过渡、20+20 次重复切换、交互延迟、完整重置与工坊重新交付均已跑通。`real-functional` 还发现并修复了当前 Web 项在迟到预览到达后未重新提交画面的问题。最终本地套件为 55/55。还需第二次真实冷启动验证修复后的专用入口握手机制。
- 2026-11-20 失败实例恢复复测：当前运行中的 PID `55692` 仍是第一次启动失败后留下的实例；专用入口因缺少匹配会话标记而拒绝再次激活。已补上仅对本地失败回执、PID、创建时间、端口、日常 profile、环回归属和“无存活宿主”全部精确匹配的失败实例恢复路径；已有匹配运行时通过 `configureHost()` 重绑宿主；宿主锁被独占持有时不再误判为不存在。恢复回执 `Outcome = wallpaper-ready`，候选身份匹配；再次调用入口得到 `dedicated-instance-reused` 且退出码为 `0`。`pnpm test` 56/56、三个 PowerShell 预检、候选探针和 Prettier 均通过。详细边界见 `evidence/20261120-task12/recovery-from-failed-launch.md`。该结果不等于第二次真实冷启动；当前主进程仍未退出，验收框保持未勾选。
- 2026-11-20 真实专用入口验收：用户退出后，专用入口于 13:01:13 创建主进程 `58548`、端口 `60377`，13:01:22 达到 `wallpaper-ready`，目标核验 2 次。随后页面目标再次切换，原宿主退出；13:10:09 从精确成功回执恢复宿主 `62716`，候选身份一致。恢复后的实例完成四素材与 4K90 过渡、20+20 热切、A→B→C/A→B→A、停用 500 ms/30 秒、缺失素材保留、设置/跨窗口/持久化、完整重置与重新交付、可见性能矩阵和最终身份复核，配置精确恢复。`pnpm test` 56/56，三个 PowerShell 预检、候选探针和 Prettier 通过。证据总览见 `evidence/20261120-task12/live-acceptance-20261120.md`。
- 剩余未通过：前置视频热切到真实动态帧 p95 为 `300.3 ms` 和 `309.3 ms`，高于 `300 ms`；启动成功后目标再次切换时宿主不会自动恢复，当前需再次调用专用入口恢复。两项均保留未勾选，任务 12 仍为 `in-progress`。
