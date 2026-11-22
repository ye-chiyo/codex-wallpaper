# Codex P0b：原 Start/AUMID 入口自动启用 CDP 的外部一手资料研究

> 调研日期：2026-11-10。范围仅限公开官方文档、公开源码和已有固定提交的公开候选仓库；不操作本机 Codex 进程、注册表、入口、MSIX 安装或持久配置，也不重复主代理的本地反编译或运行探针。下文把“功能上有可测可能”与“已有证据证明可用”严格分开。

## 结论先行

| 入口场景                                                           | 外部一手资料能证明什么                                                                                                                                                | 对目标约束的判断                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 冷启动后点击原始 Start/AUMID 项                                    | 原始 Start 项由包清单的 `<Application>` 生成；Windows 通用启动契约可以在调用方显式传入参数时激活 AUMID，但公开资料没有给用户提供“给既有 Start 项永久追加参数”的配置点 | **无证据证明 CDP 会自动开启**                                                               |
| 已由带 CDP 参数的自有启动器启动，再点击原始 Start/AUMID 项         | 单实例应用可把新激活重定向到已有实例；此时原入口可以聚焦已经运行、已经带 CDP 的进程                                                                                   | **热激活可复用既有 CDP；新参数不能在热激活时追溯启用 CDP**                                  |
| 通过 `IApplicationActivationManager` 以同一 AUMID 显式带参启动     | Windows API 明确接受 app-specific arguments；Microsoft WinApp CLI 也把参数传给 AUMID 激活                                                                             | **可测，且不修改安装与 AUMID；但仍不是“原始入口自动”**                                      |
| 通过包内 execution alias 或已验证的 `app\ChatGPT.exe` 显式带参启动 | Electron/Chromium 会从启动命令行读取调试开关；公开候选在 AUMID 丢参时尝试该路径                                                                                       | **属于原 binary 的自有启动路径，不是原 Start 点击路径；是否保留参数及能否执行仍待目标测试** |
| 登录时由用户级 companion 预启动带 CDP 的 Codex                     | Windows 有用户级启动机制；Electron 的 CDP 服务在浏览器主进程启动早期创建                                                                                              | **只能覆盖“之后原入口热激活”；Codex 完全退出后的原入口冷启动缺口仍在**                      |

**P0b 的核心检索结论：截至本次一手资料检索，没有公开证据表明，在不改受保护 MSIX、使用日常 profile、也不改变原 Start/AUMID 入口的条件下，用户冷启动原入口就能自动获得 CDP。** Windows API 支持调用者显式向同一 AUMID 传参；当前 Owl 冷启动是否接受该参数并转成 Chromium 启动开关仍未知。这不是“原入口零改动的自动带参”证据。

## 1. Chromium/Electron 的参数消费时机

`--remote-debugging-port` 是启动开关。Electron 当前源码在 `ElectronBrowserMainParts::PreMainMessageLoopRun()` 中检查当前进程的命令行；只有存在该开关时才调用 `DevToolsManagerDelegate::StartHttpHandler()`（[Electron `fcb3c2a...` L587-L629](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/shell/browser/electron_browser_main_parts.cc#L587-L629)）。处理器随后从同一命令行读取端口并启动 HTTP 调试服务（[Electron 同提交 L61-L91](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/shell/browser/ui/devtools_manager_delegate.cc#L61-L91)）。这证明开关必须在目标浏览器主进程启动时已经存在。

Electron 官方文档同样要求用 `app.commandLine.appendSwitch(...)` 在主脚本、`ready` 事件之前追加开关，且 `--remote-debugging-port` 用于开启 HTTP 调试（[Electron Command Line Switches](https://www.electronjs.org/docs/latest/api/command-line-switches)）。因此可从外部直接测试的是“用带开关的命令启动原二进制”，没有公开的“向已启动进程补送 Chromium 开关”接口。

Electron 的 `second-instance` 事件虽然把第二实例的 `argv` 交给主实例，但该事件保证在 `ready` 之后发生（[Electron `app.md` L528-L558](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/docs/api/app.md#L528-L558)）；而 CDP 服务在前面的 `PreMainMessageLoopRun()` 已经决定是否启动。单实例 API 会提示第二个进程退出并只发送参数（[Electron `app.md` L1190-L1247](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/docs/api/app.md#L1190-L1247)）。由此可推断：普通热激活即使把 `--remote-debugging-port` 传到已运行的 Electron app，也不能由公开 API 在新的第二实例中启动该原实例的 CDP 服务；是否保留该 argv 还取决于目标应用自己的启动/单实例实现。

### 日常 profile 与 Chromium 136 限制

Chrome 136 起忽略“默认 profile + `--remote-debugging-port`/`--remote-debugging-pipe`”，要求非标准 `--user-data-dir`（[Chrome 官方变更说明](https://developer.chrome.com/blog/remote-debugging-port)）。但该检查位于 Chrome browser 层，并受 `GOOGLE_CHROME_BRANDING` 控制（[Chromium `8fd0b1b...` L160-L183](https://github.com/chromium/chromium/blob/8fd0b1bc04c1ede29a418dddf8e576d21f2f9718/chrome/browser/devtools/remote_debugging_server.cc#L160-L183)），不能直接推导到 Electron/Owl。

当前 Electron 自己的处理器没有这层 Chrome 默认 profile 检查，而是使用 app 的 `DIR_SESSION_DATA` 启动 CDP（[Electron `fcb3c2a...` L87-L91](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/shell/browser/ui/devtools_manager_delegate.cc#L87-L91)）。因此：

- 对 **upstream Electron**，没有必要仅因 Chrome 136 就强制新建 profile；测试应先保留目标应用原本解析出的日常 `DIR_SESSION_DATA`。
- Owl 是否有自己的 build/profile 门控仍未知；这必须由目标版本测试，不能由 Chrome 品牌层源码或 Firefox/普通 Chromium 推断。
- 自定义 `--user-data-dir` 会改变 Chromium cookies、缓存和本地存储的位置；仅“原 profile 文件仍在磁盘上”不等于“本次运行使用日常 profile”。

Electron 当前 HTTP 实现把监听地址硬编码为 `127.0.0.1`（[Electron `fcb3c2a...` L33-L77](https://github.com/electron/electron/blob/fcb3c2a65b7f732e351da8e2fe38787ed490008e/shell/browser/ui/devtools_manager_delegate.cc#L33-L77)）。候选仓库额外传 `--remote-debugging-address=127.0.0.1` 并非 upstream Electron 开启 CDP 的必要条件；最小启动面应优先只测端口参数。

## 2. Windows 原始 Start/AUMID 激活

Windows 的 AUMID 用于识别和启动应用；`Get-StartApps` 返回的条目正是 Start 中应用的 AUMID（[Microsoft：Find the AUMID](https://learn.microsoft.com/en-us/windows/configuration/store/find-aumid)）。MSIX 清单中的一个 `<Application>` 对应一个 Start 入口（[Microsoft：Group applications in Start](https://learn.microsoft.com/en-us/windows/msix/packaging-tool/create-start-group)）。因此原始 Start 项不是可由用户在 `HKCU` 中给它追加 command-line arguments 的普通 `.lnk` 配置。

`IApplicationActivationManager::ActivateApplication` 则以 `appUserModelId`、可选的 app-specific `arguments` 和 activation options 发起 `Windows.Launch`，并返回实际承接激活的 PID（[Microsoft API 文档](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication)）。Microsoft 的 WinApp CLI 官方源码确实把调用方给出的 arguments 交给该 API（[Microsoft `WinAppCli@cf21887` AppLauncherService L23-L60](https://github.com/microsoft/WinAppCli/blob/cf21887f60965dfaff887d5a3ebd5a48f110818d/src/winapp-CLI/WinApp.Cli/Services/AppLauncherService.cs#L23-L60)），其文档也明确：AUMID 激活和 execution alias 是两条启动路径，`--args` 可把参数交给 packaged app（[Microsoft WinApp CLI usage `cf21887` L763-L816](https://github.com/microsoft/WinAppCli/blob/cf21887f60965dfaff887d5a3ebd5a48f110818d/docs/usage.md#L763-L816)）。

这建立了两个不同事实：

1. **调用方显式调用 `ActivateApplication(AUMID, arguments, ...)`** 是受支持的带参激活；不修改包，不换 AUMID，可由普通用户运行。
2. **用户直接点击原始 Start 项** 仍是普通 `Windows.Launch`；本次检索没有找到 Windows 提供的 per-AUMID 用户设置，能让系统在 Start 每次激活时自动追加指定 arguments。

Windows App SDK 的单实例文档说明：应用可选择把新激活重定向到已有实例；默认桌面应用也可能多实例运行，是否单实例由应用实现决定（[Microsoft：Multi-instance apps](https://learn.microsoft.com/en-us/windows/apps/develop/launch/multi-instance-apps)）。这使“热激活”结果依赖 Owl 的实例策略：可以聚焦旧实例、创建第二实例或退出第二实例，不能只凭 AUMID 断言。

### 热激活与冷启动的分界

- **热激活**：若已有 Codex 主进程是带 CDP 启动的，原 Start/AUMID 激活只需要让目标应用聚焦现有窗口；既有调试服务仍在。新激活携带的调试参数不能反向改写旧主进程的 Chromium 命令行。
- **冷启动**：原 Start/AUMID 激活没有调用方自定义参数，浏览器主进程到达 `PreMainMessageLoopRun()` 时命令行中没有 `--remote-debugging-port`，因此按 Electron 公开源码不存在可启动的 CDP 服务。
- **先点原入口、再另起 helper 补 CDP**：目标主进程已启动，补参太晚；要生效只能重启 Codex，这与“原入口冷启动即可用”不同，也会中断当前工作。

## 3. “原 binary 自有启动器”不等于“原入口自动”

保留原 Start/AUMID 项，同时允许用户或 companion 调用原包的同 AUMID、execution alias 或精确包内可执行文件，属于**自有启动路径**。它可以复用原包身份和原 binary，但调用者、参数和启动时机已改变，不能据此声称“用户点击原 Start 项会自动开启 CDP”。

固定提交的公开候选源码给出了实际的兼容处理：

- `CCDawn/Codex-Dynamic-Skin@5a0e7404` 通过 `IApplicationActivationManager` 带参激活，并检查进程命令行中的 flag 是 `forwarded`、`protocol-redirected` 还是 `not-forwarded`；若被转换为 `codex://`，它关闭本轮新进程并尝试直接启动已验证的 Store exe（[入口激活 L898-L1000](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/common-windows.ps1#L898-L1000)、[判定与回退 L1015-L1096](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/common-windows.ps1#L1015-L1096)）。源码因此明确承认“AUMID 参数不保证变成 Chromium 命令行”。
- `HeiGeAi/heige-codex-skin-studio@a6fa3984` 同样先以 AUMID 带参激活；若调试参数没有进入主进程命令行，则退出后改走包内可执行文件（[AUMID 与 store-exe 回退 L1620-L1816](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/scripts/windows/lib/common.ps1#L1620-L1816)）。

两个候选都提供自己的启动/重启流程；公开源码没有实现“用户仍点原始 Start 项，系统自动把调试参数附上”。它们可以作为参数是否保留、协议重定向和恢复路径的测试参照，不能作为原入口自动化的存在证明。

## 4. 用户级参数追加机制搜索结论

| 候选机制                                                              | 是否保留原 Start 项          | 是否自动作用于原入口冷启动   | 结论                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `IApplicationActivationManager::ActivateApplication(AUMID, args)`     | 是（仍用同一已注册 AUMID）   | 否；必须由本次调用方显式带参 | 最小、受支持、可测的自有启动路径                                                                           |
| execution alias / 已验证原 exe 加参数                                 | 是（不删原项）               | 否；只是另一条启动命令       | 属原 binary 自有启动；目标接受参数、ACL、身份和 profile 行为均待测                                         |
| 新增用户 Start 快捷方式/`.lnk` 或包清单 `desktop7:Shortcut Arguments` | 原项可保留，但新增的是另一项 | 否；点击哪一项决定走哪条命令 | 新入口不是原入口；清单 shortcut 还需改包重签                                                               |
| 登录时用户级 companion/Run/Startup 预启动                             | 原项可保留                   | 仅让后续点击变成热激活       | 可覆盖常驻后的热激活，不能填补完全退出后的冷启动                                                           |
| 修改原 Start 项/清单直接写 arguments                                  | 名义上保留名称               | 是                           | 需要改受保护包或替换入口，违反当前约束                                                                     |
| 通用一用户环境变量追加 Electron/Chromium switches                     | 是                           | 未发现公开契约               | Electron 有若干具名环境变量，但没有文档化的通用 extra-CLI 参数变量；目标是否自读私有环境变量属应用特定行为 |

`desktop7:Shortcut` 可以在包清单中声明 `.lnk` 的 `Arguments`、是否固定到 Start 等（[Microsoft schema](https://learn.microsoft.com/en-us/uwp/schemas/appxpackage/uapmanifestschema/element-desktop7-shortcut)），但这是包作者通过签名清单声明的另一个 shortcut；不能在用户级安全追加到既有 MSIX Start 项。

Windows 的用户启动项（`HKCU\...\Run`、Startup 文件夹）能启动命令（[Microsoft Run/RunOnce](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys)），但它们只启动 companion，不拦截之后点击原 Start 项，也没有公开的“应用激活前 shell hook”供普通应用注册。

因此，未发现同时满足下列全部条件的受支持用户级持久机制：

1. 保留签名 MSIX 和 AUMID；
2. 冷启动点击原 Start 项；
3. 每次由系统自动给该 AUMID 的浏览器主进程追加 Chromium arguments；
4. 继续使用日常 profile；
5. 不改变 shell、系统调试状态或默认应用入口。

## 5. 明确排除或不能默认接受的机制

| 机制                                     | 关键事实                                                                                                                                                                                                                                                            | 处置                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| IFEO / Image File Execution Options      | 以文件名为持久系统配置；公开说明也指出 IFEO 不能按版本、架构等其他特征区分（[Microsoft Exploit Protection reference](https://learn.microsoft.com/en-us/defender-endpoint/exploit-protection-reference)）                                                            | **不默认接受**；会扩大影响面，不能证明 MSIX 激活/日常 profile/恢复安全 |
| `IPackageDebugSettings::EnableDebugging` | 可设置 package 的 debugger command line 和环境，并关闭激活超时、自动挂起/终止/恢复（[Microsoft API](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ipackagedebugsettings-enabledebugging)）；Developer Mode/包调试是开发场景    | **不默认接受**；改变 lifecycle，不应作为消费级自动入口                 |
| Package Support Framework                | 需解包、加入 PSF、修改 manifest，再重新打包/签名（[Microsoft PSF](https://learn.microsoft.com/en-us/windows/msix/psf/package-support-framework)）                                                                                                                   | **不可用于不改受保护安装的 P0b**                                       |
| 修改 WindowsApps/ACL 或 ASAR             | MSIX 位于受保护目录并做签名/完整性校验（[Microsoft MSIX containerization](https://learn.microsoft.com/en-us/windows/msix/msix-containerization-overview)、[Sign an MSIX package](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview)） | **直接违反目标约束**                                                   |
| 用新 profile 冒充日常 profile            | Chromium profile 保存 cookies、缓存和本地存储；换 `--user-data-dir` 是 isolate debugging 的官方建议（[Chrome 官方说明](https://developer.chrome.com/blog/remote-debugging-port)）                                                                                   | **不满足日常 profile**；不能以“原文件没删”代替运行同一 profile         |

## 6. 登录窗口：候选原理与本轮实测边界

本节只解释公开候选的机制，不能用于回推本轮现象的根因。本轮并未执行这些候选脚本；登录窗口发生在主代理自建空白 profile、独立 `CODEX_HOME` 且未借用日常登录凭据的实验中。具体实测、停止动作与清理结果以 [codex-p0b-validation.md](codex-p0b-validation.md#登录窗口干扰与处理) 为准。

以下仅列候选原理：

1. `CCDawn@5a0e7404` 默认把 Codex 的 Chromium data 改到 managed `cdp-profile`，理由是规避 Chromium 136+ 对默认 profile 的调试限制（[`start-dream-skin.ps1` L126-L133](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L126-L133)），随后无条件加入 `--user-data-dir=<该路径>`（[L330-L335](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L330-L335)）。独立 profile 没有日常 profile 的 cookies/local storage，出现重新登录是合理结果；若每次 state root 或启动方式不同，还会形成不同登录态。
2. 该候选一次失败操作可能连续启动多次：先 AUMID 带参激活；发现参数被转成 `codex://` 后关闭并直接启动 Store exe；最终失败时再以无 CDP 的普通 AUMID 重开（[common-windows L1032-L1096](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/common-windows.ps1#L1032-L1096)、[start-dream-skin L366-L391](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L366-L391)）。因此一次失败的接入尝试可能显示多个认证/启动窗口。

上述内容只说明候选脚本为何可能触发登录窗口，不是本轮实测归因；本轮原因以 `codex-p0b-validation.md` 为准。也不能把 Chrome 136 规则直接当作 Owl 必须换 profile 的结论：upstream Electron 没有该 Chrome 品牌层检查，见第 1 节。

## 7. 后续可测方案与判据

下列方案仅为下一阶段的受控实验设计，本轮均未执行。前提是用户另行允许重启 Codex；当前工作中的 Codex 不关闭。

### T0：只在用户允许后、独立测试窗口测，不碰当前会话

先记录基线：正常退出 Codex 后，仅通过原始 AUMID/Start 契约冷启动，确认没有调试端点、没有参数，且日常 profile 正常。该项是**冷启动对照基线**，不应为了通过而继续叠加环境变量或系统调试开关。

**通过判据：** `/json/version` 和 `/json/list` 均不出现；主进程命令行无 `remote-debugging`。**停止条件：** 出现该端点即说明环境中存在未识别注入，先隔离环境，不能据此归因于本次代码。

### T1：同 AUMID 的显式带参冷启动

使用已确认属于 `OpenAI.Codex` 的 AUMID，调用 `IApplicationActivationManager::ActivateApplication(AUMID, "--remote-debugging-port=<随机空闲端口>", AO_NONE, ...)`。默认**不传** `--user-data-dir`，以便保持应用的日常 profile 解析。随后分别记录：

- 主进程命令行是否原样包含开关；
- 端口是否仅监听 loopback；
- `/json/version` 是否归属于本轮 PID；
- 是否使用日常登录态；
- 是否只是把参数变成 `codex://`。

**结论分类：** `forwarded` / `protocol-redirected` / `not-forwarded` / `uninspectable`。只有 `forwarded + verified endpoint + daily profile` 才算“同 AUMID 的自有启动器可用”；它仍不等于原入口自动。

### T2：已有 CDP 会话时点击原始入口

先由 T1 成功建立带 CDP 的 Codex，再按原始 AUMID/Start 契约热激活。预期可以由目标应用单实例策略聚焦旧窗口，且旧 CDP 继续存在。

**通过判据：** 没有新主进程；旧 PID 的 CDP 端点和目标集合仍在；未因热激活产生第二套 profile 或新的认证窗口。**不能据此证明冷启动原入口。**

### T3：登录预启动后点击原始入口

若以后评估用户级 companion，可在登录时由该 companion 以 T1 方式启动 Codex；之后原入口热激活复用该进程。该方案仍是“预启动 + 热激活”，必须明确其缺口：

- Codex 完全退出后，再次先点原入口仍是 T0，不带 CDP；
- companion 不能安全地抢占或拦截这次原入口激活；
- 自动驻留会增加攻击面、内存/启动影响和登录态暴露；是否提供必须由用户显式开关控制。

### T4：仅作兼容性对照的自有 binary 路径

如果 T1 失败，再分别测试 execution alias 和已验证的精确包内 exe 加同一最小参数。它们只回答“原 binary 是否接受启动参数”，不回答“原入口是否自动带参”。不得修改 `WindowsApps`、ACL、ASAR、注册表或激活清单；失败即保留为未知。

## 8. 不可由外部资料或本次研究判定的边界

- Owl `26.1103` 是否把 `IApplicationActivationManager` arguments 原样放入 `process.argv`、转成 `codex://`、或直接丢弃；
- Owl 在单实例热激活时是否会新建 profile、创建第二主进程或仅聚焦既有窗口；
- Owl 使用的 Chromium/Electron 分支是否引入额外 CDP/profile/build 门控；
- 日常 profile 是否能同时容纳 CDP 且不触发登录、锁冲突或会话损坏；
- MSIX 的 trust level、AppContainer/loopback 规则是否阻止调试客户端连接；
- 随机端口上的进程所有权、`app://` target 归属与多 WebContents 注入是否安全；
- 任何“用户级自动追加参数”是否存在于未公开的 Owl 私有机制，而不能由第三方依赖。

## 9. 安全边界与建议

CDP 能执行脚本、导航和操控页面；upstream Electron 当前服务监听 `127.0.0.1`，但 loopback 并没有协议级认证。若未来测试，建议使用随机空闲端口、严格校验 listener PID/包身份/`app://` target、只在皮肤会话存活期间开放，并在完整退出后确认端口消失。若运行在 AppContainer 且需要从外部客户端反连/接入，Microsoft 的 loopback 文档说明默认隔离并要求显式豁免（[Microsoft IPC / Loopback](https://learn.microsoft.com/en-us/windows/apps/develop/communication/interprocess-communication)）；这项系统级变更不应成为默认方案。

对当前约束下的产品结论：

1. 把“原入口热激活复用已启动 CDP”与“原入口冷启动自动开启 CDP”拆成两个独立验收项。
2. 前者可作为预启动 companion 的能力，但必须承认 Codex 完全退出后无 CDP。
3. 后者目前没有一手证据；在出现目标应用官方支持、签名清单 arguments 或新公开 OS 钩子之前，不应宣传为可实现。
4. 基于本次有限检索，已识别的受支持显式带参路径需要自有调用方；尚未建立既有原入口每次冷启动自动带参的公开契约。这不排除未来出现新官方能力、目标应用合作或本次未检索到的公开机制；也不能以 IFEO、PackageDebugSettings、改包或更换 profile 冒充已满足原需求。
