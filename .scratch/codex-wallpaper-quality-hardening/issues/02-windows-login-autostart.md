# 02: 登录 Windows 后自动进入专用 Codex 并恢复壁纸

**What to build:** 提供一条可显式启用和撤销的 Windows 登录自启动路径，让专用启动器成为日常 Codex 入口。登录后自动恢复上次壁纸和设置，不要求打开终端、发送模型指令或手动双击；重复启动只复用现有实例。

**Blocked by:** 01 · 适配当前 Codex 更新并恢复壁纸。

**Status:** ready-for-human

- [x] 用户启用后，Windows 登录会自动通过专用入口启动一个 Codex 实例；不留下必须人工关闭的常驻控制台窗口。
- [ ] 冷启动完成后恢复上次壁纸与视觉设置，`Alt+Shift+W` 和页面按钮都能正常启停，且不出现第二个主进程、重复背景层或重复播放器。
- [x] 自启动行为只建立一个本项目自有入口；原 Codex 入口、官方安装文件、日常 profile、账号和聊天不被修改。
- [x] 用户撤销自启动后，下次登录不再启动专用 Codex；原入口仍可正常打开并使用原账号和已有聊天。
- [x] 自启动失败、版本不兼容或实例冲突时不能静默无响应。保留明确的本地回执或提示，且不无限重试或自动关闭用户正在使用的实例。
- [x] 自启动入口的启用、重复启用、撤销和失败路径使用现有启动器与测试基础能力验证；不为适配层再建平行守护进程或独立配置真源。
- [ ] 完成一次真实重启或注销重登验收，记录自动启动结果、壁纸、快捷键、实例数量、原账号和已有聊天状态。

## Boundary

本任务把专用启动器定义为日常入口。原 Codex 入口启动后的自动接入继续保持未完成，不能用本任务结果将它记为通过。

## Evidence

- `Start-CodexWallpaper.ps1` 新增互斥的 `-EnableStartup`、`-StartupStatus`、`-DisableStartup`。三个动作只使用当前用户 Startup 文件夹中的一个 `Codex Wallpaper.lnk`；没有服务、计划任务、系统级注册或后台重试。
- 快捷方式由同一份本地参数生成和校验：Windows PowerShell 以 `-WindowStyle Hidden -Launch -Unattended` 运行当前 worktree 的启动器，快捷方式窗口样式也是最小化。重复启用幂等覆盖同一入口；禁用前核对该入口的描述标识，不删除同名但非本项目创建的快捷方式。
- 最近一次成功注入会在启动器互斥锁仍持有时写入 `%LOCALAPPDATA%\CodexWallpaper\P0b\dedicated-session.json`，记录 `MainPid`、创建时间、端口和通过时间。重复入口只有在该记录与主进程身份、EXE、日常 profile、调试端口标志和环回 listener 归属全部一致时才成功复用；它不建立 CDP 连接、不发送探针、不重复注入。仅有调试参数的未知实例仍记录为冲突。
- 无人值守模式的本地回执现在在包查询前初始化；包查询失败、版本不支持、EXE/登记漂移、日常 profile 缺失、多主进程、普通实例、未记录调试实例、启动竞争和既有 activation/probe 失败路径都会保留 `Outcome`。包查询和版本拒绝不再在没有回执时直接退出。
- 既有成功语义保持为 `read-only-probe-passed`，壁纸响应仍记录在 `Wallpaper` 字段；新增的可复用身份是独立 marker，没有改变成功回执名称。
- TDD 红灯先分别观察到：缺少 Startup 入口函数、专用 root 未要求成功记录、launcher 不回写临时 receipt、外部同名快捷方式会被错误删除、包查询异常没有 receipt。逐项补最小实现后转绿。
- 自动化只使用进程 fixture、临时 Startup/回执目录、mock `Get-AppxPackage`/`Get-CimInstance`/`Get-NetTCPConnection` 和 activation 边界 stub。没有读取真实 Startup 内容，没有写真实 Startup，没有查询真实 Codex 进程、连接 CDP、启动/关闭/重启 Codex，也没有修改包、日常 profile、原入口或 source worktree。
- 自动化覆盖 11 个 launcher 预检场景、3 个 root 状态场景和 1 个 Startup 入口场景；离线完整 Node 测试另有 10/10 通过。`launcher/README.md` 给出可直接复制的启用、状态、撤销命令，并记录真实注销/重启门槛。兼容 CRLF 的全仓检查命令 `corepack pnpm exec prettier --check --end-of-line auto .` 与 `git diff --check` 通过。

## Human gates

- [ ] 用户在工作已保存、允许注销或重启的时间内运行 `-EnableStartup`，然后自行注销或重启。确认登录后没有可见且需人工关闭的控制台，只有专用 Codex 实例。
- [ ] 用户确认仍是原账号并能打开同一个已有聊天；确认上次壁纸和视觉设置恢复，页面按钮及 `Alt+Shift+W` 正常，且只有一个主进程、一个背景层和一个活动播放器。若出现登录页、第二个主进程或重复背景，停止验收并保留回执。
- [ ] 用户再次触发同一登录入口，确认它复用已记录实例而不新增主进程、不连接或重复注入；随后正常退出专用实例，运行 `-DisableStartup`，再自行注销或重启，确认不再启动专用 Codex。
- [ ] 用户用原入口启动一次，确认原账号和已有聊天仍可用；需要彻底清理时先运行 `-DisableStartup`，再运行 `Reset-CodexWallpaper.cmd`，不得把 reset 当作登录入口的撤销路径。

## Remaining uncertainty

- 隐藏快捷方式和 PowerShell `-WindowStyle Hidden` 已在 mock/temp 层验证参数，但“登录时绝不出现瞬时控制台”仍须真实登录观察。
- 真实登录、壁纸恢复、账号/聊天、快捷键、单实例和撤销行为没有在本次实施中执行；因此状态为 `ready-for-human`，不能把自动测试通过记成冷启动验收通过。
