# Codex（壁纸）专用启动器：统一验收候选

本入口启动官方 Codex，核验实例、版本、日常 profile 和主界面后加入壁纸运行层。候选支持：

- 本地图片和视频导入、切换、默认静音、Scene 与兼容绘制帧率设置及页面不可见时暂停。
- Wallpaper Engine 本机壁纸扫描；可见卡片懒加载作者预览，图片/视频/Scene 由隐藏宿主按需分块读取，Scene 使用 WebWallGL 或作者预览降级，Web 使用离线沙箱或预览降级。
- 可视化壁纸库、收藏、播放列表、定时轮播、暗化/模糊/透明度、声音与快捷键开关。
- 同源全局配置跨窗口同步；每个窗口独立判断可见性。
- 显式启用、查询和撤销一个隐藏运行的 Windows 登录入口。

专用入口使用一个隐藏的 Node 监督进程，在核验过的主界面会话里挂载运行时并处理按需素材请求。PowerShell 收到宿主就绪回执后退出。主界面连接断开时，监督进程在有限时间内重新发现主界面，复核原进程和环回监听归属后恢复上次壁纸或停用状态。正常退出 Codex 后，监督进程在恢复窗口结束前退出。

启动器接受已核对的 x64 MSIX `26.1111.2228.0` 和 `26.1117.3838.0`。每个版本绑定各自的原 EXE SHA-256，并核验 `OpenAI.Codex_2p2nqsd0c76g0!App` 的登记。版本、摘要或登记不匹配时启动器不会接入。需要 Windows PowerShell 和 Node.js 24。

可选 GUI 桌面入口先显示上次壁纸的启动画面。启动层使用 PATH 中的 `ffmpeg.exe` 静音播放受核验的本地 Workshop 视频，或者播放主界面准备好的 Scene 和导入视频片段。片段只包含壁纸画面，按当前选择和适配方式缓存。缺少解码器或片段尚未准备好时使用静态首帧。壁纸停用后直接走原生启动。

## 快捷键

在 Codex 窗口内使用以下快捷键。主界面的壁纸工具栏已移除。

- `Alt + Shift + S` 打开或收起壁纸设置。壁纸停用时，先用下方快捷键恢复。
- `Alt + Shift + W` 关闭或恢复壁纸。重新开启后恢复上次选择的素材和设置。

## 专用入口

在仓库根目录安装锁定依赖，然后以命令行入口检查启动结果。

```powershell
pnpm install --frozen-lockfile
.\launcher\Codex-Wallpaper.cmd
```

已有普通 Codex 实例时，专用入口会拒绝接入。准备冷启动时先保存工作并完全退出 Codex。控制台的 `Outcome: wallpaper-ready` 表示宿主握手成功。页内偏好为停用时，`Wallpaper` 可以为 `disabled`。以下命令只读查看现有实例。

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

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

按 `Alt+Shift+S` 打开设置，在「外观与预设」页底部找到“停用并清除本项目数据”需要点击两次确认。它会删除页内全局配置和导入素材，并恢复内置渐变。

需要同时撤销登录启动时，先运行上面的 `-DisableStartup`，再双击 `Reset-CodexWallpaper.cmd` 清理回执和自有本地文件。重置脚本只处理 `%LOCALAPPDATA%\CodexWallpaper`，不删除 Codex 包、原入口、日常 profile、账号或聊天。

界面停用不会关闭专用启动参数开启的调试监听；正常退出该 Codex 实例后，监听才会关闭。

## 已知边界

- 联网 Web 壁纸没有可证明的隔离通道，仍未启用；当前只支持不依赖外部网络的 `srcdoc` 沙箱和预览降级。
- 视频主素材通过本地 File 通路支持到 1 GiB，超过 512 MiB 时不走 Base64 回退；其他素材和 File 不可用时的兼容回退仍以 512 MiB 为界。超过上限、读取失败或渲染器不支持时提交作者预览降级。真实创意工坊兼容率必须逐样本验收，不能按扫描数量推定。
- 素材库索引超过复核窗口后先继续服务当前索引，后台用扫描签名判断是否重扫；每 5 分钟最多进行一次后台完整复核。File 输入使用 `objectId` 交接，不重复获取整棵 DOM。
- CPU、GPU、内存预算和 8 小时、7 天结论尚未产生，必须按 [统一候选说明](../docs/planning/codex-wallpaper-candidate.md) 实测。
