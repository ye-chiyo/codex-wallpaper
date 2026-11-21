# Codex（壁纸）专用启动器：统一验收候选

本入口启动官方 Codex，核验实例、版本、日常 profile 和主界面后加入壁纸运行层。候选支持：

- 本地图片和视频导入、切换、默认静音、Scene 与兼容绘制帧率设置及页面不可见时暂停。
- Wallpaper Engine 本机壁纸扫描；可见卡片懒加载作者预览，图片/视频/Scene 由隐藏宿主按需分块读取，Scene 使用 WebWallGL 或作者预览降级，Web 使用离线沙箱或预览降级。
- 可视化壁纸库、收藏、播放列表、定时轮播、暗化/模糊/透明度、声音与快捷键开关。
- 同源页面同步设置，各页面独立判断可见性。多个真实 Codex 主窗口的壁纸表现仍待验。
- 显式启用、查询和撤销一个隐藏运行的 Windows 登录入口。

专用入口使用一个隐藏的 Node 监督进程，在核验过的主界面会话里挂载运行时并处理按需素材请求。PowerShell 收到宿主就绪回执后退出。主界面连接断开时，监督进程在有限时间内重新发现主界面，复核原进程和环回监听归属后恢复上次壁纸或停用状态。正常退出 Codex 后，监督进程在恢复窗口结束前退出。

宿主锁由 PowerShell 和 Node 按同一规则判定：锁内 PID 仍存在，且该进程的创建时间不晚于锁写入时间，才继续复用。PID 已退出或已被更晚创建的进程复用时，旧锁视为过期并恢复。

启动器接受已核对的 x64 MSIX `26.1111.2228.0` 和 `26.1117.3838.0`。每个包的完整原 EXE SHA-256 见 [启动器兼容表 `$supportedExeHashes`](Start-CodexWallpaper.ps1#L11)。启动器同时核验 `OpenAI.Codex_2p2nqsd0c76g0!App` 的登记。版本、摘要或登记不匹配时，使用官方入口继续打开 Codex。首次安装、初始化和工具版本见[快速开始](../README.md#快速开始)。

可选 GUI 桌面入口先显示上次壁纸的启动画面。启动层使用 PATH 中的 `ffmpeg.exe` 静音播放受核验的本地 Workshop 视频，或者播放主界面准备好的 Scene 和导入视频片段。片段只包含壁纸画面，按当前选择和适配方式缓存。缺少解码器或片段尚未准备好时使用静态首帧。壁纸停用后直接走原生启动。

## 快捷键

在 Codex 窗口内使用以下快捷键。主界面的壁纸工具栏已移除。

- `Alt + Shift + S` 打开或收起壁纸设置。壁纸停用时，先用下方快捷键恢复。
- `Alt + Shift + W` 关闭或恢复壁纸。重新开启后恢复上次选择的素材和设置。

## 专用入口

首次使用先从官方入口完成 Codex 初始化。正常、完全退出 Codex 后，在仓库根目录安装锁定依赖并运行专用入口。

```powershell
pnpm.cmd install --frozen-lockfile
.\launcher\Codex-Wallpaper.cmd
```

已有普通 Codex 实例时，专用入口会拒绝接入。准备冷启动时先保存工作并完全退出 Codex。控制台的 `Outcome: wallpaper-ready` 表示宿主握手成功。页内偏好为停用时，`Wallpaper` 可以为 `disabled`。以下命令只读查看现有实例。

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

升级壁纸工具时，先完全退出旧的专用实例，再更新源码、检查 Codex 包、安装锁定依赖并重开。若出现 `Outcome: runtime-version-mismatch`，说明当前主界面中已经有版本不同的壁纸运行时。完全退出 Codex 后，用新版专用 CMD 重开即可。启动器会保留原先挂载的壁纸运行时。

### 可选桌面入口

源码附带 GUI 启动器，可在 **Windows PowerShell 5.1** 中本地编译。它使用当前已安装 Codex 包中的图标。可选的 `ffmpeg.exe` 由本机 PATH 提供，用于播放可识别的本地 Workshop 视频；缺少解码器时使用静态首帧。

```powershell
$compiler = Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
$entry = Join-Path (Get-Location).Path 'launcher\CodexWallpaper.exe'
$script = (Resolve-Path -LiteralPath .\launcher\Start-CodexWallpaper.ps1).Path
& $compiler /nologo /target:winexe /optimize+ /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll "/out:$entry" .\launcher\CodexWallpaperDesktop.cs
if ($LASTEXITCODE -ne 0) { throw 'Desktop launcher compilation failed.' }
& $entry $script
```

如果要从桌面启动，可以新建一个专用快捷方式，目标填写带引号的 EXE 绝对路径和脚本绝对路径，例如 `"C:\Tools\Codex Wallpaper\launcher\CodexWallpaper.exe" "C:\Tools\Codex Wallpaper\launcher\Start-CodexWallpaper.ps1"`。第一次运行没有缓存时会直接进入 Codex。保留 CMD 入口用于查看诊断输出。若自行创建了该快捷方式，卸载时可删除该快捷方式和本地编译的 EXE。

桌面入口隐藏控制台。排查启动中止时，先看[启动回执](#诊断与回执)；需要直接查看启动提示时，用 CMD 入口。

## Windows 登录启动

以下命令只操作当前用户 Startup 文件夹中的 `Codex Wallpaper.lnk`，不会注册服务、计划任务或系统级启动项。入口以隐藏窗口运行现有专用启动器；在有记录证明同一专用实例仍运行时只复用，不重新连接或注入。

```powershell
# 启用或幂等更新这一个登录入口
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -EnableStartup

# 查看入口是否指向当前 worktree 的启动器
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -StartupStatus

# 撤销登录启动
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -DisableStartup
```

无人值守启动的回执保存在 `%LOCALAPPDATA%\CodexWallpaper\P0b`。`Outcome` 为 `wallpaper-ready` 时，回执包含通过核验的主页面、`Wallpaper.hostReady`、候选哈希和监督进程 PID。壁纸偏好为停用时，`Wallpaper.state` 可以是 `disabled`。专用会话标记只有在宿主就绪后才写入。重复启动时，标记必须与运行中主进程的 PID、创建时间、端口和环回监听归属一致。若专用启动已核验主界面但注入失败，或成功回执对应的宿主随后消失，后续入口会先用本地回执、PID、创建时间、端口、日常 profile 和环回监听归属精确匹配该实例，再只重试监督握手；任一条件不匹配时仍保持原界面并拒绝接入。

`-StartupStatus` 报告 `stale` 时，说明同名快捷方式指向旧路径或参数。先撤销项目创建的登录入口，再用当前检出重新启用。临时 Startup 目录的夹具已有覆盖，真实登录、注销、重启和重复触发仍待验。

## 诊断与回执

专用 CMD 的启动预检以控制台提示为准。缺少日常配置、包不匹配以及 EXE 摘要或应用登记不匹配的处理步骤见[常见问题](../README.md#常见问题)。无人值守模式还会将这类失败写入启动回执。

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
Get-ChildItem "$env:LOCALAPPDATA\CodexWallpaper\P0b" -Filter *.json |
  Select-Object Name, LastWriteTime
```

排查时记录包版本、控制台提示、素材类型及出现问题的时间。有回执时可查 `Outcome` 和 `NativeProfile`。回执可能含进程 PID、创建时间和本机路径，分享前请脱敏。将 Codex 日常 profile、账号信息和聊天内容保留在本机。

## 手动验收

[发布验收记录](../docs/planning/codex-wallpaper-candidate.md) 区分自动化、历史实机、本次只读核对和用户视觉验收。选择一段可以完全退出 Codex 的空闲时间，建议预留 **20–30 分钟**。关闭窗口或最小化不等于完全退出。

1. 从原入口启动，确认原账号和同一个已有聊天可用，然后完全退出。
2. 运行上述 CMD 入口。预期 `Outcome: wallpaper-ready`。有缓存后，再从可选桌面入口冷启动一次，检查首帧、动态帧和主界面交接。
3. 确认主聊天、工具卡片、代码、差异、输入框和左右面板可读可操作；切换明暗主题和窗口缩放。
4. 按 `Alt + Shift + S` 打开壁纸设置，导入一张图片和一个视频，分别切换；视频应默认静音并自动循环。
5. 检查本机 Wallpaper Engine 条目分类。选择图片/视频、代表性 Scene 和离线 Web；记录原生播放、预览降级或不支持。
6. 调整暗化、模糊、不透明度、帧率、音量和轮播间隔。把至少两个素材加入轮播，重开一次确认选择、收藏和列表恢复。
7. 最小化、恢复并切换项目或聊天，确认不可见时停止绘制、恢复后继续。在另一个窗口确认设置一致但暂停状态独立。
8. 按 `Alt + Shift + W`，确认背景和设置面板立即消失。再次按下可重新启用。
9. 正常退出专用实例，再从原入口启动。运行以下只读状态检查，预期普通实例 `DebugFlag: false`、`ListeningPorts: []`：

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

10. 启用登录入口后，在用户方便且工作已保存时自行注销或重启一次。确认没有任何常驻控制台窗口，只有专用 Codex 实例和壁纸，重复登录触发的入口不会增加第二个主进程或重复注入；这是尚未由自动测试代替的人工门槛。

## 清除与撤销

1. 临时停用用 `Alt+Shift+W`。再按一次可恢复上次选择。调试监听会在 Codex 实例完全退出时结束。
2. 要清理页内数据，在专用实例退出前打开「外观与预设」，点击 `停用并清除本项目数据`，再点击 `再次点击确认清除`。这会停用壁纸并删除页内配置和导入素材。
3. 如果启用过[登录启动](#windows-登录启动)，运行 `-DisableStartup`，确认状态为 `disabled`。
4. 正常、完全退出专用 Codex，再运行 `Reset-CodexWallpaper.cmd` 清理 `%LOCALAPPDATA%\CodexWallpaper` 的回执和缓存。
5. 从 Windows 开始菜单的官方入口重新打开 Codex，确认原账号和已有聊天可用。保留 Codex 自己的日常 profile。

## 已知边界

- 离线 Web 使用 `srcdoc` 沙箱。外部资源被屏蔽，依赖它们的页面可能显示不完整。HTML 无法读取、超过 512 KiB 或含 `<script>` 时尝试使用作者预览。联网 Web 壁纸不受支持。
- 视频主素材通过本地 File 通路支持到 1 GiB，超过 512 MiB 时不走 Base64 回退；其他素材和 File 不可用时的兼容回退仍以 512 MiB 为界。超过上限、读取失败或渲染器不支持时提交作者预览降级。真实创意工坊兼容率必须逐样本验收，不能按扫描数量推定。
- 素材库索引超过复核窗口后先继续服务当前索引，后台用扫描签名判断是否重扫；每 5 分钟最多进行一次后台完整复核。File 输入使用 `objectId` 交接，不重复获取整棵 DOM。
- CPU、GPU、内存预算和 8 小时、7 天结论尚未产生，必须按 [统一候选说明](../docs/planning/codex-wallpaper-candidate.md) 实测。
