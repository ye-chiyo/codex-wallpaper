# Codex 主界面壁纸：受支持接口与公开实现研究

> 调研日期：2026-11-10。范围仅限公开官方文档和公开 GitHub 源码；未读取或改动本机 Codex 安装包、ASAR、配置及运行环境。仓库中出现的实测记录按“作者提交的证据”对待，不视为本次独立复测。

## 结论先行

| 能力面                   | 结论                                                                                      | 对本项目的含义                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 官方主题设置             | **支持**颜色与字体级主题；查阅文档中**未发现**图片、视频或任意 CSS 的公开契约             | 官方已文档化设置不能单独满足主界面图片/视频壁纸                      |
| MCP Apps UI / Extensions | **可支持**受控 iframe 与既定宿主表面；**未发现**修改 Codex/Electron 主窗口背景的公开契约  | 适合在会话、面板、侧栏或文件查看器中显示内容，不等于“主界面壁纸”     |
| Codex Hooks              | **有**会话、轮次、工具和模型请求生命周期；公开事件中**未发现** Electron 启动/窗口就绪接口 | 不能仅凭会话 hook 承诺桌面原入口自动注入                             |
| 非官方本地适配           | **源码路径存在**：官方包启动 + loopback CDP + renderer CSS/DOM 注入 + 正常重启恢复        | 这是当前最接近需求的公开实现路线，但本机 Owl/MSIX 适用性仍为**未知** |

当前查阅的官方接口不足以建立主窗口壁纸方案，查到的候选路线是非官方本地 renderer 适配；它能否用于本机 `26.1103.4239.0`，在完成受控启动/CDP 探针前不能判定。自有脚本激活官方二进制与“用户点击原来的入口即可自动生效”是两个不同验收项，两个候选都未证明后者。

## 判定口径

- **支持**：第一方公开文档明确描述该能力，且存在稳定的公开契约。
- **未发现公开契约**：本次查阅的第一方公开资料没有建立本需求所需的主背景或任意宿主 CSS 能力；不声称穷尽所有内部实现。
- **未知**：公开源码实现了类似机制，但没有本机 Owl/MSIX 版本的实测；或需要依赖未公开、内部开关、调试环境或结构锚点。
- README 的市场描述、截图和“支持 Windows”字样不作为实测结论。下文只把可定位的启动、解析、注入、恢复源码，以及明确写出范围和限制的仓库文档作为证据。

## 1. 官方主题设置

官方 [Settings](https://learn.chatgpt.com/docs/reference/settings) 的抓取文本在 Appearance 节 `L989-L1051` 写明：用户可选 light/dark/system，调整 accent、background、foreground、UI/code font，以及 translucent sidebar 等。条目中的 “Background” 是颜色 token（例如 `#FFFFFF`、`#181818`），不是图片、视频或文件路径。

同一节 `L1016-L1110` 展示的 Import/Copy theme 仍是颜色、字体和对比度等主题配置，没有公开出 `background-image`、媒体资源、样式表路径或任意脚本入口。因此：

- 颜色、字体和明暗适配：**官方支持**。
- 静态图片或视频作为主窗口背景：**官方公开设置不支持**。
- 任意 CSS 或 DOM 扩展：**官方公开设置不支持**。
- 未公开实现中是否还存在内部主题字段：**未知，但不属于可依赖的支持接口**。

对本项目的直接含义是，官方主题可以作为注入失败时的降级配色，不能满足“主界面壁纸”的视觉要求。

## 2. MCP Apps UI 与 Extensions 的边界

官方 [Plugin Extensions](https://developers.openai.com/plugins/build/extensions) 在 `L960-L999` 把扩展面限定为 sidebar apps、conversation panels、plugin settings、file viewers/editors、display modes、deep links、composer 等；`L1000-L1030` 说明 sidebar app 是全屏 MCP App，file viewer 在 thread side panel 打开。

官方 [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui) 的 `L960-L978` 更明确：MCP App 组件运行在 iframe 内，通过 MCP Apps bridge（JSON-RPC over `postMessage`）与宿主通信，并渲染在对话附近。官方 [Security & Privacy](https://developers.openai.com/plugins/guides/security-privacy) 的 `L985-L988` 又说明 iframe 有严格 CSP，不可访问特权浏览器 API，嵌套 frame 默认关闭。

因此 MCP Apps/Extensions 能提供的是**宿主分配的 UI 容器**，不是对主窗口根 DOM 的样式所有权：

- 壁纸选择器、主题列表、配置表单或独立预览：**可做**。
- 在主聊天内容旁边打开面板：**可做**。
- 把 iframe 内容铺满宿主指定 surface：公开文档中存在 fullscreen display mode，但仍受宿主容器、CSP 和生命周期约束。
- 给整个 Codex 主窗口、侧栏、标题栏和正文设置共同背景：**官方扩展接口不支持**。
- 用 MCP App 冒充主窗口背景或绕过宿主壳层：不符合公开扩展边界。

## 3. Codex Hooks 的实际事件域

官方 [Hooks](https://learn.chatgpt.com/docs/hooks) 在 `L951-L976` 把 hooks 定义为 agentic loop 生命周期的一部分；触发时机包括 turn 内的工具/压缩/提示词/停止事件、模型请求、session/subagent 启动和主线程结束。官方没有列出 Electron process started、BrowserWindow created、renderer ready 或 app UI mounted 事件。

`SessionStart` 的细节在 `L1405-L1428`：`source` 是 `startup`、`resume`、`clear`、`compact` 或 `fork`，其用途是增加 developer context；该节没有承诺它与窗口创建或 renderer 就绪同步。

结论：

- Hooks 是**会话与 agent 生命周期事件**，不是 Electron 窗口启动钩子。
- 在 `SessionStart` 运行一个外部脚本在技术上可尝试，但公开契约不保证窗口已存在、CDP 可用或 renderer 已就绪，也无法据此安全获得主窗口 DOM。
- 用 hook 启动独立进程本质上仍是非官方 shell/renderer 适配，不能称为官方 UI 接口。
- “官方入口启动后自动恢复壁纸”目前没有第一方生命周期事件可直接承接。

## 4. GitHub 源码候选

公开搜索后最多保留两个候选。共同点是都不把改写 `app.asar` 当作运行入口，而是尝试启动官方 MSIX/Win32 应用、在 loopback CDP 上发现 renderer、向命中的页面执行 CSS/JS，再通过普通重启退出调试会话。

### 候选 A：`CCDawn/Codex-Dynamic-Skin`

固定提交：`5a0e74043b63ed9518ab37cdcf6865340a57006c`（MIT）。

**实际入口与 Windows/MSIX 适配。** `Get-DreamSkinRegisteredCodexInstalls` 使用 `Get-AppxPackage -Name 'OpenAI.Codex'`，验证包签名类型、安装根、family/application identity 和 AUMID（[common-windows.ps1 L840-L914](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/common-windows.ps1#L840-L914)）。启动时优先经 `IApplicationActivationManager` 激活已注册 AUMID；若 Owl 把参数转成 `codex://`，才回退到同一已验证包内的精确 `app\ChatGPT.exe`，并把 ACL 拒绝视为失败而不是接管 `WindowsApps`（[common-windows.ps1 L980-L1040](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/common-windows.ps1#L980-L1040)）。

**调试模式。** 它使用 `--remote-debugging-address=127.0.0.1`、`--remote-debugging-port=<port>` 和独立的受管 `--user-data-dir`，然后等待端口及 renderer（[start-dream-skin.ps1 L330-L334](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L330-L334)、[L319-L352](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L319-L352)）。启动失败时会关闭本轮进程、恢复已管理的配置变更，再通过普通 AUMID 重开 Codex（[L354-L382](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/start-dream-skin.ps1#L354-L382)）。

**补丁 / 注入方式。** 源码明确采用 CDP，不改 ASAR 或签名（[platforms.md L2-L12](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/docs/platforms.md#L2-L12)）。注入器只接受精确 loopback WebSocket，发现 `app://` page target；watch 模式循环枚举 target，对每个 renderer 建 CDP session 并注入（[injector.mjs L273-L308](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/injector.mjs#L273-L308)、[L1917-L2166](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/injector.mjs#L1917-L2166)）。renderer 端通过 adopted stylesheet 或 `<style>` 加根 CSS 变量和装饰属性，并额外创建静音循环 video 元素；cleanup 会移除属性、样式、媒体和 observers（[renderer-inject.js L669-L727](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/assets/renderer-inject.js#L669-L727)、[L861-L925](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/assets/renderer-inject.js#L861-L925)、[L1333-L1385](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/assets/renderer-inject.js#L1333-L1385)）。

**恢复机制。** `restore-dream-skin.ps1` 停止记录的 injector，按托管键或完整备份恢复 `config.toml`，清理状态和快捷方式；默认关闭本轮 Codex 后经普通启动入口重开，彻底结束 CDP 参数（[restore-dream-skin.ps1 L119-L176](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/windows/scripts/restore-dream-skin.ps1#L119-L176)）。安全说明也明确“暂停主题”不等于关闭 CDP，完整恢复或退出后从官方入口重开才结束风险窗口（[SECURITY.md L30-L39](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/SECURITY.md#L30-L39)）。

**证据强度。** 仓库内有作者在 Windows Codex `26.930.3930.0` 上的有限实测记录，覆盖单机、单缩放、单主题以及首页/滚动/输入等原生观察；明确不覆盖多版本、多 DPI 和完整矩阵（[windows-26-930-performance.md L9-L24](https://github.com/CCDawn/Codex-Dynamic-Skin/blob/5a0e74043b63ed9518ab37cdcf6865340a57006c/docs/windows-26-930-performance.md#L9-L24)）。这是目前最贴近 Windows Store/MSIX、Owl 兼容叙述和恢复闭环的候选，但不是本机版本的实测。

**对本机的关键缺口。** 当前选中的源码没有识别本机所说的 `CODEX_ELECTRON_CHROMIUM_SWITCHES`、`BUILD_FLAVOR` 或 `allowDevtools(e)=isInternal(e)` 门控；它仍按普通 Chromium CLI 参数尝试开放 CDP。由此只能判定“路线匹配、旧版本有作者证据”，不能判定在 `26.1103.4239.0` 上可用。

### 候选 B：`HeiGeAi/heige-codex-skin-studio`

固定提交：`a6fa39849eaa9bf69699ab8ce1992ecf63fa675a`（MIT）。

**实际入口与 Windows/MSIX 适配。** Windows 产品档案区分 Win32、StoreAlias、StoreAumid，并从 Store 安装根、包身份和 AUMID 建立不可变身份（[products.mjs L9-L46](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/products.mjs#L9-L46)、[windows-runtime.mjs L95-L113](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/windows-runtime.mjs#L95-L113)）。Store 启动先用 AUMID；若参数丢失，再只允许启动同一绑定包里的已验证主程序，WindowsApps 拒绝访问时 fail-closed（[common.ps1 L1368-L1425](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/scripts/windows/lib/common.ps1#L1368-L1425)、[L1546-L1738](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/scripts/windows/lib/common.ps1#L1546-L1738)）。

**调试模式。** Codex 使用 loopback `--remote-debugging-address` 和 `--remote-debugging-port`（[products.mjs L156-L169](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/products.mjs#L156-L169)）。Windows 入口还检查 Store AppContainer 回环隔离，并提供一次性 `CheckNetIsolation LoopbackExempt` 诊断/授权路径；不复制或改 ACL `WindowsApps`（[common.ps1 L1290-L1366](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/scripts/windows/lib/common.ps1#L1290-L1366)）。

**补丁 / 注入方式。** 仓库测试明确断言不存在 `src/asar.mjs` 或 `src/theme-patch.mjs`，因此不能把该版本描述成 portable ASAR patcher（[product-identity.test.mjs L43-L57](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/test/product-identity.test.mjs#L43-L57)）。注入器把主题图片作为 data URL 写入 CSS 表达式，枚举全部匹配的 `app://-/index.html` 主 renderer 并逐个连接、执行（[injector.mjs L145-L195](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/injector.mjs#L145-L195)、[L251-L290](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/injector.mjs#L251-L290)）。目标分类器只把精确 `app://-/index.html` 视为主 renderer，把 avatar overlay 与未知页面跳过（[target-classifier.mjs L1-L44](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/target-classifier.mjs#L1-L44)）。

**恢复机制。** remove 路径调用运行时 dispose，并删除 style、menu、根数据集和脚本 API（[injector.mjs L292-L337](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/src/injector.mjs#L292-L337)）。完整 restore 会先验证应用/进程/端口归属，再移除皮肤、注销后台控制器、关闭控制端点，并以不含 CDP 参数的普通模式重启 Codex（[SECURITY.md L3-L7](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/SECURITY.md#L3-L7)）；源码中的 `Restart-CodexWithoutCdp` 也先停止并确认端口释放，再走 `Start-CodexNative`（[common.ps1 L1740-L1772](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/scripts/windows/lib/common.ps1#L1740-L1772)）。

**证据强度与缺口。** 该项目的 Windows 文档明确写明：对官方独立版只有自动化验证；Microsoft Store/MSIX 的包发现、激活、回环诊断和豁免虽已实现，但没有维护者真机记录，因此应用、常驻、恢复和卸载均标为“未验证”（[windows-compat.md L2-L17](https://github.com/HeiGeAi/heige-codex-skin-studio/blob/a6fa39849eaa9bf69699ab8ce1992ecf63fa675a/docs/windows-compat.md#L2-L17)）。它同样没有本机 Owl 版本、`CODEX_ELECTRON_CHROMIUM_SWITCHES` 或 `BUILD_FLAVOR` 门控证据。

## 5. 两个方案的源码差异与取舍

| 维度                | CCDawn/Codex-Dynamic-Skin                                    | HeiGe/skin-studio                                                                |
| ------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 入口                | Store AUMID 优先，Owl 转参数时回退精确 Store exe             | Store AUMID 优先，丢参后回退精确 Store exe；另有 Store/Win32 身份模型            |
| 启动隔离            | 专门指出 Chromium 136+ 需要非默认 data dir；使用受管 profile | 启动参数固定 loopback，并显式处理 MSIX AppContainer 回环豁免                     |
| renderer 发现       | 枚举全部 `app://` page targets，并逐 target 注入             | 枚举 target 后严格分类，只处理精确 `app://-/index.html`；多 main target 逐个执行 |
| 内容能力            | 静态图、CSS、装饰 DOM、video/MSE、Wallpaper Engine 场景侧车  | 主要用图片 data URL、CSS、菜单脚本，偏静态主题                                   |
| WindowsApps 策略    | 不改包/ACL；直接启动只限已验证包内 exe；失败回滚             | 不改包/ACL；失败 fail-closed；有一次性 loopback exemption                        |
| 恢复                | 托管配置恢复、保留并发用户编辑、完整重启关闭 CDP             | 状态/租约/journal、删除注入、注销后台、无 CDP 重启                               |
| 公开 Windows 成熟度 | 有 26.930 单版本作者实测记录，覆盖有限                       | 源码完整，但 Store/MSIX 明确标为未验证                                           |
| 对本机 26.1103/Owl  | **未知**                                                     | **未知**                                                                         |

若需要一个最小、最接近 Windows Store 现实情况的技术参照，候选 A 的“AUMID 启动、受管 profile、多 target 注入、失败回滚、完整恢复”最完整。候选 B 值得借鉴的是严格 target 分类、不可变包身份、回环隔离诊断，以及“仓库内无 ASAR patcher”的明确测试。两者都不能作为本机已经可用的证明。

## 6. 本机限定证据带来的硬约束

以下信息由主代理提供，未作为公开一手来源采信，也不在本次研究中复读本机安装包：

- MSIX 为 `OpenAI.Codex 26.1103.4239.0`，ASAR 内的 `package.version` 为 `26.1103.32239`，两者是不同层级的版本字段，不能混用。
- 主入口是 `.vite/build/early-bootstrap.js`，运行目录包含 `owl-electron-app.json`、`app/ChatGPT.exe` 和 `chrome.dll`，不是可仅按普通 Electron 假设的 stock 运行时。
- `contextIsolation:true`、`nodeIntegration:false`，`devTools` 还受 `allowDevtools(e)=isInternal(e)` 门控。
- `topLevelTabs` 的 `createAppView` 会单独注册 WebContents，因此“只遍历 BrowserWindow”或只连接一个页面都不够。
- `webview/index.html` CSP 仅允许 `self`、`blob:` 和明确远端源，不允许任意 loopback connect/frame。
- `CODEX_ELECTRON_CHROMIUM_SWITCHES` 看似可读 `BUILD_FLAVOR`，但仅 Dev build 接受；改 `BUILD_FLAVOR` 会改变 Updater/发行策略，**不作为生产接入或研究方案**。
- 当前主进程未带 `remote-debugging`/`inspect` 参数，因此当前没有可直接使用的调试端口。

由此，两个公开候选的调试参数路线仍需本机验证；DevTools UI/开发环境变量的门控不等于原生 Chromium CDP 参数必然被拒绝。本轮没有设置 Dev 环境变量、修改 ASAR 或变更 WindowsApps ACL。用户允许评估可撤销的非官方适配；任何资源级方案仍须独立证明包完整性、启动与恢复，不能把这些条件默认为已满足。

## 7. 最小计划（仅供下一阶段评审）

1. **下一阶段先做不修改安装包的受控启动探针。** 从校验过的 Store AUMID 启动一次 Codex，只附加候选实现使用的 loopback remote-debugging 参数和独立非默认 user-data-dir。检查主进程归属、`/json/version`、`/json/list` 和实际主 renderer。探针会创建临时 profile 并改变进程运行状态，不属于只读操作，本轮未执行。不得自动关闭当前工作中的 Codex；独立 profile 成功不证明日常会话兼容。本探针不设置构建类型环境覆盖或改 ACL/ASAR。
2. **门失败即停止该探针。** 若参数被吞、端口不存在、身份不符或没有主 renderer，记为本次能力验证未通过并保留未知，不由单次失败推断所有接入方式绝对不可能，也不自动转为修改受保护包。
3. **门通过后按 WebContents 集合注入。** 像两个候选一样轮询 CDP discovery，对每个精确匹配的主 renderer 独立 attach；观察 `Page.loadEventFired`/导航并重新注入。不得依赖 BrowserWindow 或 `createAppView` 的未公开对象。
4. **第一版只做静态图片。** 用 scoped style 和少量装饰节点，把背景置于非交互层；图片通过 `blob:`/data URL 交给页面，避免依赖 loopback `fetch`。这是对当前 CSP 最保守的测试面。
5. **实现原位撤销。** 保存或可确定性删除所有 style、节点、属性和 observer；一键恢复后关闭本工具的注入进程，并验证官方主界面可用。
6. **实现完整恢复。** 仅结束已证明属于本轮 OpenAI.Codex 的进程，确认调试端口消失，再经原始 Store AUMID、无调试参数启动。不要覆盖用户后续编辑的配置。
7. **视频后置。** 只有静态图、多 WebContents 和恢复均通过后，才评估 video/MSE 或 loopback 流；当前公开 CSP 约束会让任意 loopback 流成为高风险未知项。

这套最小计划复用的是两个项目的公共结构，不直接复制其主题 DOM、选择器或发行逻辑。影响更新、签名、ACL 或官方文件的捷径不进入方案。

## 待验证点

1. `OpenAI.Codex 26.1103.4239.0` 是否接受 loopback `--remote-debugging-port` 与非默认 `--user-data-dir`；如果只在 Dev/内部构建接受，则所有公开 CDP 候选均不适用于当前生产包。
2. 正常 Store AUMID 激活是否会保留上述参数；精确 `app/ChatGPT.exe` 回退是否被 ACL 拒绝，或即使启动也不开放端口。
3. `/json/list` 中 `topLevelTabs` 创建的各 app WebContents 是否都暴露为精确 `app://-/index.html`；是否存在只暴露首个 target、延迟创建或目标 URL 变化。
4. 主 renderer 的实际 CSP 是否允许 `blob:` 图片；若图片也必须经 loopback 获取，是否会命中与 `webview/index.html` 相同的网络限制。
5. 多 target 注入后的生命周期：切换 tab、关闭/重建 WebContents、应用更新、窗口重启时能否去重、重注入并在完全退出时清理。
6. 恢复后是否能证明端口已消失、进程已由官方普通入口重开，且用户设置、登录和更新通道没有被改变。
7. “原入口自动”尚未被任何公开候选证明。现有项目普遍提供自己的启动器；如果不修改官方快捷方式或增加外部 watcher，官方普通启动不会自动带 CDP。该入口接入方式仍需单独设计和验证。
