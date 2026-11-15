# Codex（壁纸）专用启动器：统一验收候选

本入口启动官方 Codex，核验实例、版本、日常 profile 和主界面后加入壁纸运行层。候选支持：

- 本地图片和视频导入、切换、默认静音、15/30 FPS 上限及不可见暂停。
- Wallpaper Engine 本机壁纸扫描；可见卡片懒加载作者预览，图片/视频/Scene 由隐藏宿主按需分块读取，Scene 使用 WebWallGL 或作者预览降级，Web 使用离线沙箱或预览降级。
- 可视化壁纸库、收藏、播放列表、定时轮播、暗化/模糊/透明度、声音与一键停用。
- 同源全局配置跨窗口同步；每个窗口独立判断可见性。
- 显式启用、查询和撤销一个隐藏运行的 Windows 登录入口。

运行期间可能有一个隐藏的本机 `wallpaper-host` Node 辅助进程，用于按需读取当前选中的 Wallpaper Engine 素材；它不监听网络端口，并随 Codex 页面退出而结束。

只接受本机已核对的 MSIX `26.1111.2228.0`、原 EXE SHA-256 `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` 及 `OpenAI.Codex_2p2nqsd0c76g0!App`。更新后先用原入口；版本、摘要或登记不匹配时启动器不会接入。需要 Windows PowerShell 和 Node.js 24。

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

无人值守启动的回执保存在 `%LOCALAPPDATA%\CodexWallpaper\P0b`。只有最近一次成功注入写下的 `dedicated-session.json` 与运行中主进程的 PID、创建时间、端口和环回监听归属全部一致时，重复入口才会直接成功返回；其他已运行实例都按冲突记录。

## 手动验收

选择一段可以完全退出 Codex 的空闲时间，建议预留 **20–30 分钟**。关闭窗口或最小化不等于完全退出。

1. 从原入口启动，确认原账号和同一个已有聊天可用，然后完全退出。
2. 双击 `Codex-Wallpaper.cmd`。预期控制台出现 `Outcome: read-only-probe-passed` 和 `Wallpaper: enabled`。
3. 确认主聊天、工具卡片、代码、差异、输入框和左右面板可读可操作；切换明暗主题和窗口缩放。
4. 点击右下角“壁纸设置”，导入一张图片和一个视频，分别切换；视频应默认静音并自动循环。
5. 检查本机 Wallpaper Engine 条目分类。选择图片/视频、代表性 Scene 和离线 Web；记录原生播放、预览降级或不支持。
6. 调整暗化、模糊、不透明度、帧率、音量和轮播间隔。把至少两个素材加入轮播，重开一次确认选择、收藏和列表恢复。
7. 最小化、恢复并切换项目或聊天，确认不可见时停止绘制、恢复后继续。在另一个窗口确认设置一致但暂停状态独立。
8. 点击“停用壁纸”，确认背景、设置面板和按钮立即消失；按 `Alt+Shift+W` 可重新启用。
9. 正常退出专用实例，再从原入口启动。运行以下只读状态检查，预期普通实例 `DebugFlag: false`、`ListeningPorts: []`：

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

10. 启用登录入口后，在用户方便且工作已保存时自行注销或重启一次。确认没有任何常驻控制台窗口，只有专用 Codex 实例和壁纸，重复登录触发的入口不会增加第二个主进程或重复注入；这是尚未由自动测试代替的人工门槛。

## 清除与撤销

壁纸设置面板底部的“停用并清除本项目数据”需要点击两次确认。它会删除页内全局配置和导入素材，并恢复内置渐变。

需要同时撤销登录启动时，先运行上面的 `-DisableStartup`，再双击 `Reset-CodexWallpaper.cmd` 清理回执和自有本地文件。重置脚本只处理 `%LOCALAPPDATA%\CodexWallpaper`，不删除 Codex 包、原入口、日常 profile、账号或聊天。

界面停用不会关闭专用启动参数开启的调试监听；正常退出该 Codex 实例后，监听才会关闭。

## 已知边界

- 联网 Web 壁纸没有可证明的隔离通道，仍未启用；当前只支持不依赖外部网络的 `srcdoc` 沙箱和预览降级。
- 单个主素材超过 512 MiB、读取失败或渲染器不支持时走作者预览降级。真实创意工坊兼容率必须逐样本验收，不能按扫描数量推定。
- CPU、GPU、内存预算和 8 小时、7 天结论尚未产生，必须按 [统一候选说明](../docs/planning/codex-wallpaper-candidate.md) 实测。
