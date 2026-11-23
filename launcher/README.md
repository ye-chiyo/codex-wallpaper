# Codex（壁纸）专用启动器：统一验收候选

本入口启动官方 Codex，核验实例、版本、日常 profile 和主界面后加入壁纸运行层。候选支持：

- 本地图片和视频导入、切换、默认静音、15/30 FPS 上限及不可见暂停。
- Wallpaper Engine 本机壁纸扫描；可见卡片懒加载作者预览，图片/视频/Scene 由隐藏宿主按需分块读取，Scene 使用 WebWallGL 或作者预览降级，Web 使用离线沙箱或预览降级。
- 可视化壁纸库、收藏、播放列表、定时轮播、暗化/模糊/透明度、声音与快捷键开关。
- 已注入的同源页面之间同步设置事件，每个页面独立判断可见性。
- 显式启用、查询和撤销一个隐藏运行的 Windows 登录入口。

专用入口使用一个隐藏的 Node 监督进程，在核验过的主界面会话里挂载运行时并处理按需素材请求。当前发布候选只接入一个精确匹配 `app://-/index.html` 的主页面；查询路由辅助页会被忽略，两个精确主页面会出现 `ambiguous-main-page` 并失败关闭。PowerShell 收到宿主就绪回执后退出。主界面连接断开时，监督进程在有限时间内重新发现主界面，复核原进程和环回监听归属后恢复上次壁纸或停用状态。Codex 退出后监督进程也退出。同源 `storage` 只同步已注入页面的设置，不承诺第二个真实主窗口自动获得壁纸。

宿主锁由 `launcher/host-lock.mjs` 统一判定，内容为 `{ version, pid, createdAt, port }`。PowerShell 和 Node 都要求锁内 PID 仍存在，且当前进程创建时间与 `createdAt` 一致；纯 PID、损坏内容、已退出进程或 PID 复用会得到可诊断的失效状态并允许清理旧锁。`createdAt` 是宿主进程创建时间，不是锁文件写入时间。

启动器对以下已核对组合使用精确哈希快速路径：

| `PackageFullName`                                | 原 EXE SHA-256                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0` | `21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82` |
| `OpenAI.Codex_26.1117.3838.0_x64__2p2nqsd0c76g0` | `AF4D57201946260D2754172BC660EFF80B5398EA146EF466126886CCD0CF2514` |
| `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` | `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` |

已登记包的摘要漂移会在接入前失败关闭。未登记的新版本只有在包名、包族、Publisher ID、Store 签名、x64 架构、应用登记和 OpenAI 主程序签名全部可信时，才会进入运行时兼容探测。探测会等待 Codex 主界面实际出现；界面结构不匹配或超时时不接入，Codex 原界面保持不变。需要 Windows PowerShell 和 Node.js 24。

桌面入口启动失败时会显示包含原因的 Windows 弹窗。若 Codex 已经运行，壁纸入口不会附加到普通实例；请完全退出 Codex 后重新打开。

桌面「Codex 壁纸」先显示上次壁纸的启动画面。启动层使用 PATH 中的 `ffmpeg.exe` 静音播放受核验的本地 Workshop 视频，或者播放主界面准备好的 Scene 和导入视频片段。片段只包含壁纸画面，按当前选择和适配方式缓存。缺少解码器或片段尚未准备好时使用静态首帧。壁纸停用后直接走原生启动。

## 快捷键

在 Codex 窗口内使用以下快捷键。主界面的壁纸工具栏已移除。

- `Alt + Shift + S` 打开或收起壁纸设置。壁纸停用时，先用下方快捷键恢复。
- `Alt + Shift + W` 关闭或恢复壁纸。重新开启后恢复上次选择的素材和设置。

## 交付与人工验收

03 的验收基于本地候选、自动化测试和历史录屏。脱敏历史录屏只证明曾观察到变更侧栏黑底；headless fixture 证明当前视觉/交互规则；二者都不替代真实 Codex、登录后宿主绑定或重启结果。03 的真实 detached 页面身份门禁仍未解决，因此没有按 URL 放行任何 browser/detached target。

从当前集成检出的工作树根目录执行：

```powershell
# 打开当前 worktree 的专用候选入口
powershell.exe -NoProfile -NonInteractive -STA -WindowStyle Hidden -File .\launcher\Start-CodexWallpaper.ps1 -Launch -Unattended

# 只读检查现有实例；无专用成功回执时不会连接或注入
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

运行回执和登录入口命令见下方“Windows 登录启动”。只报告 `Outcome`、`Wallpaper.state` 和脱敏状态，不复制个人路径、PID、账号、聊天正文或其他回执内容。

人工门槛按以下顺序完成：

1. 用户保存工作并完全退出 Codex。可先从原入口只读确认原账号和已有聊天正常，再退出；原入口保持未修改，自动接入仍未完成。
2. 运行上述隐藏启动命令，从专用实例打开同一聊天并确认当前壁纸。
3. 选择本地图片、视频、代表性 Scene 和离线 Web；调整暗化、模糊、透明度、帧率、音量，并在聊天与变更侧栏间连续切换至少 10 次后返回。
4. 按 `Alt + Shift + W` 停用壁纸，再按一次恢复；确认当前素材和设置恢复、背景根层与控制层各一份、图片无活动播放器。对持久化为停用且上次选择按需素材的情况再退出/重开一次，确认快捷键恢复后会向真实媒体宿主请求素材，而不是永久停留在渐变。
5. 如验证登录入口，使用上面的 `-EnableStartup` 后由用户自行注销或重启；确认只复用/生成一个专用主进程且回执一致，完成后立即执行 `-DisableStartup`。
6. 正常退出专用实例，再从原入口启动并执行只读检查；预期普通实例没有项目调试标志或环回监听。

自动 fixture 只覆盖视觉、交互、状态持久化和资源计数，不证明登录后真实 host bind、真实 detached 页面归属、10 次真实切换、注销/重启或原入口自动生效。

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

选择一段可以完全退出 Codex 的空闲时间，建议预留 **20–30 分钟**。关闭窗口或最小化不等于完全退出。

1. 从原入口启动，确认原账号和同一个已有聊天可用，然后完全退出。
2. 运行上述隐藏启动命令。预期回执的 `Outcome` 为 `wallpaper-ready`，`Wallpaper.hostReady` 为 `true`。
3. 确认主聊天、工具卡片、代码、差异、输入框和左右面板可读可操作；切换明暗主题和窗口缩放。
4. 按 `Alt + Shift + S` 打开壁纸设置，导入一张图片和一个视频，分别切换；视频应默认静音并自动循环。
5. 检查本机 Wallpaper Engine 条目分类。选择图片/视频、代表性 Scene 和离线 Web；记录原生播放、预览降级或不支持。
6. 调整暗化、模糊、不透明度、帧率、音量和轮播间隔。把至少两个素材加入轮播，重开一次确认选择、收藏和列表恢复。
7. 最小化、恢复并切换项目或聊天，确认不可见时停止绘制、恢复后继续。不要为本次验收打开第二个 Codex 主窗口；同源设置事件由浏览器夹具覆盖，不等于真实跨窗口壁纸。
8. 按 `Alt + Shift + W`，确认背景和设置面板立即消失。再次按下可重新启用。
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
- 当前发布候选只支持一个经过包、摘要、profile、监听和主页面核验的 Codex 主窗口。第二个精确主页面会失败关闭，真实多窗口壁纸不属于本次范围。
- 视频主素材通过本地 File 通路支持到 1 GiB，超过 512 MiB 时不走 Base64 回退；其他素材和 File 不可用时的兼容回退仍以 512 MiB 为界。超过上限、读取失败或渲染器不支持时提交作者预览降级。真实创意工坊兼容率必须逐样本验收，不能按扫描数量推定。
- 素材库索引超过复核窗口后先继续服务当前索引，后台用扫描签名判断是否重扫；每 5 分钟最多进行一次后台完整复核。File 输入使用 `objectId` 交接，不重复获取整棵 DOM。
- CPU、GPU、内存预算和 8 小时、7 天结论尚未产生，必须按 [统一候选说明](../docs/planning/codex-wallpaper-candidate.md) 实测。
