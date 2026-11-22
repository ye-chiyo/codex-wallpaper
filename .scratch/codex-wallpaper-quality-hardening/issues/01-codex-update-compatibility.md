# 01: 适配当前 Codex 更新并恢复壁纸

**What to build:** 让专用入口在当前已安装的 `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` 上完成兼容核验并重新显示壁纸。启动器必须继续保留日常 profile、原账号和已有聊天，只在包身份、版本、可执行文件、日常数据路径、CDP 监听和主页面目标全部符合已验证条件时接入；真正未知的版本仍保持原界面。

**Blocked by:** None，可立即开始。

**Status:** ready-for-human

- [x] 当前版本的包身份、AppID、可执行文件摘要、日常 profile 观测、环回端口归属和主页面目标经过重新核验；版本兼容信息只记录为已验证组合，不通过放宽目标选择来掩盖变化。主页面目标采用当前包静态代码证据，未建立 live CDP target。
- [ ] 从专用入口冷启动后显示当前保存的壁纸，页面内 `Alt+Shift+W` 能启停壁纸，控制按钮可命中，且只有一个背景层、一个控制根和一份适配样式。
- [ ] 原账号和同一已有聊天保持可用；不创建空白 profile，不读取或迁移账号凭据与聊天正文。
- [x] 遇到未知版本、摘要不匹配、日常 profile 异常或多主进程时，不注入壁纸、不挂载快捷键，并给出可诊断的失败结果。
- [x] 新增或修改的测试必须对应真实失败行为。优先复用现有启动器预检、目标选择和页面运行时接缝，不为版本适配复制一套状态机。
- [x] 离线检查、启动器测试、相关运行时测试、Prettier 和 `git diff --check` 通过。真实冷启动由用户另选时间完成；源码通过不替代真实宿主结果。

## Evidence

- 复查时安装包为 `26.1111.2228.0`，而启动器仍固定校验 `26.1106.6628.0`。
- 当前运行实例是原入口普通启动，主进程没有调试参数，因此壁纸运行时没有注入。
- `Alt+Shift+W` 由页面内运行时安装；注入未发生时快捷键不存在。

## Human gates

- [ ] 用户另选空闲时间，从专用入口冷启动当前候选，确认当前保存壁纸恢复；控制按钮命中，`Alt+Shift+W` 可启停，且只有一个背景层、一个控制根和一份适配样式。该门禁尚未执行，今天观察到的普通实例没有 CDP 监听，不能据此判定通过。
- [ ] 用户确认仍是原账号并能打开同一个已有聊天；若出现登录页、意外导航或目标异常，停止且不在实验界面登录。不得把静态 URL 契约、自动夹具或源码检查替代这些真实宿主结果。
- [ ] 正常退出专用实例后，按 `launcher/README.md` 以原入口启动并重新运行只读状态检查，确认专用调试监听关闭。此项需要用户安排进程生命周期，本任务不自行操作。

## Remaining uncertainty

- 当前主页面目标来自当前版本 `app.asar` 的静态契约和既有精确 target 测试；本轮没有 live CDP endpoint，因而没有再次调用 `/json/list` 或 `Page.getFrameTree`。未知版本仍由完整包名与 EXE SHA 精确拒绝，没有把静态路由事实扩展成兼容范围。
- 日常 profile 只按目录存在性和子进程参数元数据核验；未读取其内容，故不能由本任务断言账号或聊天状态，必须保留真实冷启动人工门禁。

## Comments

- 2026-11-15 17:19（Asia/Shanghai）：只读主机元数据重新观察完成；未连接、启动、重启或关闭 Codex。当前只安装一份 `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`，包族为 `OpenAI.Codex_2p2nqsd0c76g0`，清单 Application IDs 为 `App`、`CodexChromeNativeHost`、`CodexCoreCommandRunner`，Start 登记精确命中 `OpenAI.Codex_2p2nqsd0c76g0!App`；`app\ChatGPT.exe` 的 SHA-256 为 `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6`。
- 2026-11-15 17:19：进程元数据只有一个可识别主 root，PID `23472`，创建时间 `2026-11-15T17:01:46.21025+08:00`，EXE 与当前包一致，`--remote-debugging-port/pipe` 未出现，root 名下没有 TCP 监听。crashpad 子进程参数仍指向 `%APPDATA%\Codex\web\Codex`；该逻辑目录当前不存在，包族 `LocalCache\Roaming\Codex\web\Codex` 目录存在。启动器无参数状态模式返回 `NativeProfile: matches-daily-path` 和 `ListeningPorts: []`。没有读取 profile 内文件、登录凭据或聊天正文。
- 2026-11-15：当前安装 `app.asar` 的既有只读静态复查记录表明：`.vite/build/early-bootstrap.js` 设置 packed origin `app://-`、默认 `index.html`，并把路由 `/detached-window` 指向 `detached-window.html`；`.vite/build/early-bootstrap-331-29198f5b57adf59a.js` 的 `loadAppRenderer` 只有调用方传入 role 时才设置 `desktopSurface`，默认主启动未传该 role。本单据此只保留精确主页面 `app://-/index.html`，不放宽 target 匹配；这是当前包静态代码证据，不是 live target observation，detached 页面处理留给任务 03。
- 2026-11-15：TDD 红灯由旧兼容常量触发：当前包/EXE fixture 在 `Unsupported or ambiguous Codex package` 处停止，未到 activation stub。更新为上述精确包和摘要后通过；另新增多主进程诊断回归，先观察到旧输出未指出多个主进程，再补最小分支。PowerShell 预检 7/7 覆盖当前包两个日常目录位置，以及未知版本、摘要漂移、登记缺失、日常目录缺失和多主进程均在 activation 前停止。
- 2026-11-15：收口检查结果：Node 运行时/只读目标测试 10/10（其中 exact target/frame/origin 协议 fixture 6/6）、启动器预检 7/7、root 状态测试 2/2 通过；变更文件 Prettier 检查与 `git diff --check` 通过。全仓 Prettier 仍报告 52 个未由本单修改的既有未格式化文件，未做无关批量改写。无头 fixture 只证明运行时节点/样式/启停与精确 target 选择行为，不证明当前 Codex 已真实注入。
- 2026-11-15：集成复核补充完成。`readMainFrame` 现在像注入路径一样进行 exact target 选择，并要求 `Page.getFrameTree` 返回的 frame URL 精确等于 `app://-/index.html`、`securityOrigin` 精确等于 `app://-`。协议 fixture 观察到 `/index.html?initialRoute=%2Favatar-overlay` 作为唯一 target 时只请求 `/json/list`，不会建立 WebSocket；exact target 返回 query-routed frame 或非 `app://-` origin 时均拒绝。没有记录 target 标题、临时 URL、登录或会话内容。
- 2026-11-22：用户报告桌面快捷方式无法打开壁纸。只读复现确认启动器仍只登记到 `26.1117.3838.0`，而本机已安装 `26.1117.4957.0`，因此在 activation 前以 `unsupported-package` 退出；桌面包装器不显示该非零退出信息。已按精确包名与 `app\ChatGPT.exe` SHA-256 `21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82` 增加该版本登记，没有放宽未知版本、摘要漂移、日常 profile 或多实例保护。预检、启动入口、root 状态和桌面包装器测试均通过；真实冷启动仍待用户完全退出当前普通实例后执行。
