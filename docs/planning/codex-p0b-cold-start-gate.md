# P0b 续查：保留原入口与日常登录的冷启动门槛

2026-11-12（Asia/Shanghai）。本轮仅检查已安装文件、运行元数据和公开资料。没有启动、激活、关闭或重启 Codex，没有创建 profile，也没有改动登录数据、安装文件、系统启动项或快捷方式。

**结论：尚未找到同时满足原注册入口、日常登录、无须每次手动操作、可撤销的可行接入方案。** 新找到的 Chromium 内建调试机制值得区分，但目前不能列为符合要求的方案。P0b 继续保留门槛，不为验证而冷启动。

## 新版实际证据

- 原 Windows 注册入口仍为 `OpenAI.Codex_2p2nqsd0c76g0!App`（`Get-StartApps` 显示 `ChatGPT`）。新版 MSIX `26.1106.6628.0` 的清单第 55 行仍指向 `app/ChatGPT.exe`，另外声明执行别名、登录启动任务和 `codex:` 协议；没有发现为原 Start 项声明自定义 CDP 参数的配置。
- 本轮观察到的工作主进程 PID `26152`、创建时间 `1794457893.48387`，来自该原安装包。进程树无 TCP 监听，主进程命令行未见 `--remote-debugging*`。两条 crashpad 子进程的 `--user-data-dir` 仍为 `%APPDATA%\Codex\web\Codex`。这是参数元数据，未打开 profile 数据文件，也未检查或复制登录凭据。
- Owl 内部构建号 `26.1106.51428`，ASAR 元数据为 `prod`。11 月 10 日的 CDP 与恢复实验使用的是 `26.1103.4239.0`，不算新版实测。新版 `app.asar` SHA-256 为 `54b74a9131680fc9eead711ed5d9f718f6127c22222ca60d2e3b577a707e2485`；`chrome.dll` 为 `18fd2723c7359468fd4e8dafa4c539ce2a077bd3dc3f314eb4abb22e64e39650`。
- 只读解析 ASAR 后，`.vite/build/early-bootstrap.js` 的 `CODEX_ELECTRON_CHROMIUM_SWITCHES` 仍限 Dev（字符约 `279917`）。在字符约 `274400` 另有构建类型覆盖逻辑，但它作用于应用构建语义，不能当作只启用调试的生产版设置。`.vite/build/early-bootstrap-631-8a15b3cfc1548366.js` 中，应用在约 `1048972` 取得单实例锁，在约 `1049660` 把第二次启动参数送入队列。观察到的代码并未建立为现有进程热启用 CDP 的路径。

## 新候选：应用自身的持久调试开关

Google 的 [Chrome 内建远程调试说明](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session) 描述了通过 `chrome://inspect#remote-debugging` 启用调试、保留现有浏览器会话的能力。上游 [Chromium 调试服务实现](https://chromium.googlesource.com/experimental/chromium/src/+/refs/heads/main/chrome/browser/devtools/remote_debugging_server.cc) 将该设置与需要用户批准连接的模式绑定。它值得检查，因为如果**宿主提供针对自己的受支持接入开关**，原入口不需要改变，连接和撤销也能由宿主管理。

本机 `chrome.dll` 的静态 ASCII 扫描找到 `devtools.remote_debugging.user-enabled`（文件字节偏移 `289713248`）、`DevToolsAcceptDebuggingConnections`（`311202425`）、`chrome://inspect`（`305111024`）和 `remote-debugging-enabled`（`305112012`）。这些仅证明库包含相关标记。它们不能证明 Owl 生产版注册了此页面、在正常启动时读取该设置，或会把 Codex 主界面交给该端点。同期 ASAR 扫描未找到 `chrome://inspect` 或相关远程调试偏好的明确调用；可见的 `debug-chrome-pages-enabled` 在 `worker.js`（约 `811836`）被定义为默认关闭的 Browser Use 内部诊断页设置，不是主界面 CDP 开关。主包中浏览器 `webContents.debugger` 的观察片段面向浏览器标签，不提供主界面外部接入契约。

即使 Owl 提供与 Chrome 相同的入口，Chrome 文档描述的流程也要求每个新调试连接由用户确认，不能直接满足原入口打开后无须手动操作的目标。无需安排冷启动来验证一个仍缺入口或仍依赖每次确认的机制。不要直接编辑 Chromium 偏好文件，也不要试图绕过确认。

## 其他候选的处置

| 机制                         | 判断                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 原 AUMID 带参        | [Microsoft 激活 API](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication) 支持调用方显式传参；普通原入口不会因此永久带参。保留日常 profile 的显式带参冷启动也尚未在本版本验证。                                                                                                           |
| 辅助程序预先启动带调试实例   | 可以保留原图标供之后唤起；完全退出后先点原图标、或原入口抢先启动时依然没有保证。只保留为有明确限制的备选。                                                                                                                                                                                                                                                                 |
| 受支持插件                   | [OpenAI 插件扩展文档](https://developers.openai.com/plugins/build/extensions) 说明的是既定面板、侧栏、设置等界面入口；未找到能改 Codex 主界面背景或为其开启 CDP 的公开接口。                                                                                                                                                                                               |
| 系统调试、应用兼容层或重打包 | [Microsoft 包调试 API](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ipackagedebugsettings-enabledebugging) 会改变包的进程生命周期；[MSIX Package Support Framework](https://learn.microsoft.com/en-us/windows/msix/psf/package-support-framework) 需要修改并重新打包应用。没有证据表明它们能提供满足本项目边界的日常入口，故不部署。 |

## 何时冷启动，如何验收

只有确认候选有可指认的启用/撤销入口、正常 Start 激活可触发、不会更换现有 profile，才安排验证。若需要每次同意调试或点击其他入口，应先明确是需求变更，不按本标准验收。冷启动验证留在用户正常退出当前实例后进行，由用户选择时机；本轮不执行。

1. **原版对照**：候选关闭，完全退出后点击日常原入口。记录实际点击的入口、AUMID、包版本和新的主进程；确认能正常进入已登录界面、打开现有聊天。仅记录结果，不复制 profile 或聊天内容。进程完全退出以进程状态为准，关窗口不等于完全退出。
2. **启用验证**：仅启用候选的可撤销设置；完全退出后仍点击同一个原入口。保持应用原来的 profile 解析，不指定新的 `--user-data-dir`。确认无需点击另一个入口、手动启动脚本或在每次启动时操作，仍能直接打开现有聊天。只读验证端点归属该版本和此次主进程，目标是 Codex 主界面 `app://-/index.html`，不是内置浏览器标签；只执行一次只读 `Page.getFrameTree` 或同等的宿主接入探针。
3. **再次冷启动**：正常退出，重复从原入口启动，确认第一次不是预启动碰巧抢先或热激活。任一轮要求重新登录、出现空白 profile、发现额外常驻实例或目标不符，立即判定该候选不通过；不靠循环启动补救。
4. **停用与还原**：停止适配，核查连接和辅助进程退出；用该机制的正式关闭方式撤销接入，再从同一原入口冷启动，复核无适配通道、原登录和聊天仍可用、原包和入口不变。若仅断开客户端而端口仍在，记为已断开但未撤销传输。未启用和版本不匹配时应保持普通启动，不尝试自动重启应用。

## 通过后进入 P1

P0b 验收通过后才接入最小宿主适配：在版本与主界面目标都吻合时，加入一个可辨认的静态渐变，不改变布局和输入事件；提供即时停用，移除其样式与节点。按[实施计划](codex-integration-proposal.md)从日常原入口完成三次冷启动，核查只加载一份背景、停用后当场恢复、重开尊重停用状态、版本不兼容时保持原界面。P1 不接播放器、素材库、Web 壁纸，也不宣称组件和长期运行验收通过。
