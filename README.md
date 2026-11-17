# Codex Wallpaper：Windows Codex 本地壁纸与界面适配

[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

> **项目状态：开发候选。** 当前发布快照包含可运行的候选实现和部分离线验证，但尚未完成完整真实 Codex、登录/重启和长期稳定性验收。
>
> **非官方工具：** 这不是 OpenAI 官方功能，也不代表 OpenAI 对兼容性或安全性的认可。它通过独立启动器核验本机 Codex 后，向主界面加入本地壁纸和界面适配。

## 项目简介

Codex Wallpaper 面向 Windows 版 Codex 桌面端，把本地图片、视频、Wallpaper Engine 本机素材和静态网页背景显示在 Codex 主界面后方，并调整聊天、工具卡片、侧栏、设置和输入区域的可读性与层次。

项目不修改 Codex 安装包，也不替换账号或聊天数据。入口始终是 `launcher/Codex-Wallpaper.cmd`；原 Codex 启动入口目前不能自动接入壁纸层。候选会先核对精确的 Codex 包版本、应用登记和原可执行文件摘要，不匹配时保持原界面。

## 功能与状态

状态说明：

- **已实现（候选）**：发布代码中存在对应路径，但不等于已经完成真实宿主验收。
- **直接播放 / 原生渲染**：由浏览器媒体元素或 WebWallGL 直接显示，不是静态图片占位。
- **预览降级**：无法直接播放时，显示 Wallpaper Engine 作者提供的预览图。
- **不支持**：当前候选没有实现该能力。
- **未验证**：代码可能具备相关路径，但缺少足以承诺可用的实测结果。

| 能力                       | 候选行为                                                                   | 状态                   | 已知边界                                                  |
| -------------------------- | -------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| 内置背景                   | 无需素材即可显示渐变背景                                                   | 已实现（候选）         | 仅作为默认背景与失败回退                                  |
| 导入本地图片               | 通过页面文件选择器导入，存入浏览器 IndexedDB，并可直接显示                 | 直接播放               | 完整真实交互和大图性能尚未统一验收                        |
| 导入本地视频               | 静音循环、可调音量、将绘制帧率限制为 15/30 FPS，页面不可见时暂停           | 直接播放               | 有声视频、休眠唤醒和长时间播放未验证                      |
| Wallpaper Engine 图片/视频 | 扫描本机已下载项目，选中后由隐藏辅助进程按需分块读取并播放                 | 已实现（候选）         | 单个素材的实际编码和兼容性需逐项验证                      |
| Wallpaper Engine Scene     | 在素材大小和传输限制内由 WebWallGL 渲染；失败或不支持时使用作者预览        | 原生渲染或预览降级     | 真实创意工坊样本覆盖率和长期表现未验证                    |
| Wallpaper Engine 离线 Web  | 读取本地 HTML；无脚本、无外链，在严格 `srcdoc` 沙箱中显示                  | 离线沙箱或预览降级     | HTML 超过 512 KiB、含 `<script>` 时降级；脚本和外链不可用 |
| 联网 Web 壁纸              | 不加载联网页面                                                             | 不支持                 | 尚无已证明可用的网络隔离通道                              |
| 界面适配                   | 为聊天、工具卡片、代码/差异、侧栏、设置、输入框和弹层增加半透明/实底可读层 | 已实现（候选）         | 完整真实界面矩阵和跨 DPI 仍需验收                         |
| 壁纸库与外观设置           | 导入、切换、收藏、播放列表、定时轮播、暗化、模糊、不透明度、帧率、音量     | 已实现（候选）         | 真实交互和跨窗口行为尚未全部验收                          |
| 多窗口                     | 同源窗口同步壁纸与设置；各窗口独立判断可见性和暂停                         | 已实现（候选）         | 30–60 分钟资源对照与全部窗口类型未验证                    |
| 快捷键                     | 在壁纸运行的 Codex 页面中，按 `Alt+Shift+W` 启停壁纸                       | 已实现（候选）         | 是页面快捷键，不是系统全局热键                            |
| Windows 登录启动           | 可创建、查询和撤销当前用户的单个 Startup 快捷方式                          | 代码已实现，验收未完成 | 尚未完成真实登录、注销和重启验收                          |
| 原 Codex 入口自动接入      | 原入口保持未修改                                                           | 不支持                 | 必须从专用启动器进入                                      |

## 环境要求

| 项目       | 要求                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 操作系统   | Windows；当前包为 x64 MSIX。仓库记录没有确认具体 Windows 版本下限，不应声称已支持所有版本                                                                                            |
| Codex      | 精确匹配包 `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0`、AUMID `OpenAI.Codex_2p2nqsd0c76g0!App` 和原 EXE 摘要 `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` |
| PowerShell | Windows PowerShell 5.1；启动脚本由 `powershell.exe -NoProfile -STA` 运行                                                                                                             |
| Node.js    | 24 或更新版本；需要内建 WebSocket 和 `--no-use-env-proxy` 支持                                                                                                                       |
| 包管理器   | pnpm `11.25.0`；版本记录在 `package.json` 的 `packageManager` 字段                                                                                                                   |
| 可选依赖   | 本机 Steam 和 Wallpaper Engine。未安装时仍可使用内置背景和导入素材，但没有 WE 壁纸库                                                                                                 |
| 仓库访问   | 仓库为私有仓库，使用者需要相应 GitHub 访问权限                                                                                                                                       |

运行依赖是 `webwallgl@3.0.0`。开发依赖包括 `husky`、`lint-staged` 和 `prettier`。候选没有业务代码构建步骤，安装依赖后直接运行启动器。

## 快速开始

以下命令均在仓库根目录执行。PowerShell 示例使用通用相对路径，不依赖个人绝对路径。

1. 获取私有仓库并安装依赖：

```powershell
git clone https://github.com/ye-chiyo/codex-wallpaper.git
Set-Location .\codex-wallpaper
pnpm install --frozen-lockfile
```

2. 只读核对本机 Codex 包版本：

```powershell
Get-AppxPackage -Name OpenAI.Codex | Select-Object PackageFullName, Version
```

当前启动器只接受上表中的精确 `26.1111.2228.0` 包。升级 Codex 后，先使用原入口；若包版本、应用登记或 EXE 摘要不匹配，专用启动器会停止接入并保持原界面。

3. **完全退出 Codex。** 关闭窗口或最小化不算退出。确认没有残留的 Codex 主进程后，运行专用入口：

```powershell
.\launcher\Codex-Wallpaper.cmd
```

4. 控制台首次成功时通常显示：

```text
Outcome: read-only-probe-passed
Wallpaper: enabled
```

此前已在页面内停用时，`Wallpaper` 可能显示 `disabled`。`Outcome: read-only-probe-passed` 只表示启动、核验和壁纸注入链路通过，不替代账号、聊天、界面和媒体的人工确认。

5. 确认原账号和已有聊天可用，主聊天、工具卡片、代码/差异、输入框和左右面板可读可操作。若出现登录页，不要在该验证实例中登录；退出后使用原入口检查状态。

6. 需要只读查看当前实例状态时运行：

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

普通原入口实例预期包含 `DebugFlag: false` 和 `ListeningPorts: []`。该命令不启动、不附加、不注入，也不会修改当前实例。

开发时可以运行 `pnpm test` 检查 Node 测试。自动测试和 headless fixture 不等同于真实 Codex 验收。

## 日常使用

壁纸运行时，主界面右下角附近会显示工具栏。当前界面文案只有简体中文；英文和日文文档保留中文按钮名并附译文。

| 中文界面                | English                               | 日本語                                       |
| ----------------------- | ------------------------------------- | -------------------------------------------- |
| `壁纸设置`              | Wallpaper settings                    | 壁紙設定                                     |
| `导入图片或视频`        | Import image or video                 | 画像または動画をインポート                   |
| `壁纸库`                | Wallpaper library                     | 壁紙ライブラリ                               |
| `使用`                  | Use                                   | 使用                                         |
| `加入轮播` / `移除轮播` | Add to / remove from rotation         | ローテーションに追加 / から削除              |
| `停用壁纸`              | Disable wallpaper                     | 壁紙を無効化                                 |
| `停用并清除本项目数据`  | Disable and clear this project’s data | 壁紙を無効化して本プロジェクトのデータを消去 |
| `再次点击确认清除`      | Click again to confirm deletion       | もう一度クリックして消去を確定               |

基本流程：

1. 点击 `壁纸设置`，在 `壁纸库` 中选择内置背景、导入媒体或本机 Wallpaper Engine 项目。
2. 点击 `使用` 切换当前壁纸。素材缺失或读取失败时，页面会跳过缺失项或保留当前画面。
3. 使用星号按钮收藏，使用 `加入轮播` / `移除轮播` 管理播放列表。轮播至少需要两项，间隔为 0 分钟时关闭。
4. 调整外观参数。参数会保存在当前 Codex 页面配置中，并在同一站点的窗口间同步。
5. 点击 `停用壁纸` 立即移除背景和控制层；再次按 `Alt+Shift+W` 会恢复上次启用的素材和设置。

外观参数：

| 参数     | 范围与默认值          | 说明                                     |
| -------- | --------------------- | ---------------------------------------- |
| 暗化     | 0–70%，默认 18%       | 加深背景以提升文字可读性                 |
| 模糊     | 0–24 px，默认 0       | 模糊壁纸媒体层                           |
| 不透明度 | 20–100%，默认 100%    | 控制壁纸媒体层透明度                     |
| 帧率     | 15 或 30 FPS，默认 30 | 视频绘制和 Scene 的帧率上限              |
| 音量     | 0–100%，默认 0        | 0 为静音；有声视频及素材自身音频仍需实测 |
| 轮播     | 0–120 分钟，默认 0    | 至少两项且大于 0 才启用                  |

最小化、切到其他窗口或页面不可见时，候选会暂停视频/Scene 绘制；恢复可见后继续。每个窗口独立判断可见性，但共享同源设置。

## Windows 登录启动（可选，待验收）

当前快照确实包含登录启动命令。它只操作当前用户 Startup 文件夹中的 `Codex Wallpaper.lnk`，不会注册 Windows 服务、计划任务或系统级启动项；快捷方式以隐藏窗口启动专用启动器。

> **验收状态：** 发布记录显示尚未完成真实的登录、注销、重启和重复触发作人工验收，因此不能把该功能描述为长期稳定。

```powershell
# 启用或幂等更新当前用户的登录入口
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -EnableStartup

# 查询状态；输出 JSON 中的 Status 为 enabled、stale 或 disabled
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -StartupStatus

# 撤销登录启动
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1 -DisableStartup
```

启用后，登录入口会以 `-Launch -Unattended` 调用现有专用启动器。若已有可核验的专用实例，启动器只复用该实例；普通 Codex 实例、多个主进程或无匹配回执的情况不会被当作可复用专用实例。无人值守回执保存在 `%LOCALAPPDATA%\CodexWallpaper\P0b`。

## 停用与卸载

按需要选择对应层级，不要为了移除壁纸工具删除 Codex 的日常 profile、登录数据或聊天。

1. **临时停用壁纸：** 点击 `停用壁纸`，或在有焦点的专用 Codex 页面按 `Alt+Shift+W`。再次按快捷键可恢复。页面内停用不会关闭专用启动器带来的调试监听；正常退出该 Codex 实例后监听才会结束。
2. **停止登录自启动：** 运行 `-DisableStartup` 并核对状态为 `disabled`。
3. **清除本项目页内数据：** 点击 `停用并清除本项目数据`，再点击 `再次点击确认清除`。这会删除页内全局配置和 IndexedDB 中的导入素材，并恢复内置渐变；不会删除 Codex 日常 profile、账号或聊天。
4. **清理回执和自有本地文件：** 双击 `launcher\Reset-CodexWallpaper.cmd`。该脚本只处理 `%LOCALAPPDATA%\CodexWallpaper`，不会清除页面 IndexedDB 中的导入素材，因此应先完成第 3 步。
5. **恢复原入口：** 完全退出专用 Codex 实例，再从原 Codex 入口启动。原入口未被安装器或本项目替换。
6. **移除工具本身：** 完成以上步骤后，可删除本仓库的本地检出目录。没有系统级安装器或自动卸载程序需要调用。

不要删除 `%APPDATA%\Codex\web\Codex`、`%LOCALAPPDATA%\Packages\OpenAI.Codex_2p2nqsd0c76g0` 或其他 Codex 数据目录来“卸载壁纸”。这些目录不属于本项目。

## 常见问题

### 启动后没有壁纸

先确认 Codex 已完全退出，再从头运行 `launcher\Codex-Wallpaper.cmd`。如果 Codex 正在运行，启动器会拒绝启动或复用；它不会把普通实例自动变成专用实例。核对包版本是否为 `26.1111.2228.0`，并查看控制台中的 `Outcome`。状态命令只读，不会注入。

### `Alt+Shift+W` 没有反应

该快捷键安装在壁纸运行的页面内，不是系统全局热键。请先点击专用 Codex 窗口使其获得键盘焦点，再重试。面板按钮仍无效时，检查页面是否处于停用状态，或回到启动器查看 `Wallpaper.state`。

### 提示版本或可执行文件不匹配

启动器会精确核验包、AppID、安装路径、EXE SHA-256 和日常 profile。Codex 更新后出现 `Unsupported or ambiguous Codex package`、`Original executable or app registration did not match` 或 `daily-profile-missing` 时，不要绕过检查；先用原入口，等待发布版本更新兼容目标。

### Wallpaper Engine 素材无法播放

候选只处理本机已下载项目，不等于完整兼容 Wallpaper Engine 创意工坊。Scene 渲染器不可用、读取失败或主素材超过 512 MiB 时可能显示作者预览。离线 Web 含有脚本、主 HTML 超过 512 KiB 或依赖外链时会降级；联网 Web 当前不支持。可改试本地导入图片/视频，以区分工具问题和单个素材问题。

### 切换壁纸出现黑屏、卡住或画面未更新

大型 Scene/视频需要按需读取。先等待当前切换完成，再选择另一项；必要时按一次 `Alt+Shift+W` 停用并恢复。若问题可重复，保留发生时间、素材类型和回执中的 `Outcome`，不要附带聊天正文、账号信息或未经检查的完整回执。

### 出现登录页或账号状态异常

不要在这个验证实例中重新登录。完全退出验证实例，再从原 Codex 入口确认原账号和已有聊天。若原入口正常，把专用启动器回执中的 `Outcome` 和 `NativeProfile` 作为诊断信息，不要复制或上传 profile。

### 登录启动没有生效

运行 `-StartupStatus`。`stale` 表示同名快捷方式指向旧路径或参数，先运行 `-DisableStartup`，再运行 `-EnableStartup`。该功能仍未完成真实注销/重启验收，不应据此认定 Codex 登录态或素材隔离已经通过。

### 必要诊断

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
Get-ChildItem "$env:LOCALAPPDATA\CodexWallpaper\P0b" -Filter *.json |
  Select-Object Name, LastWriteTime
```

回执可能包含 PID、本机路径和进程时间等元数据。共享前先检查并脱敏；不要上传 Codex profile、账号凭据或聊天内容。

## 项目结构

```text
launcher/
  Codex-Wallpaper.cmd          # 专用启动入口
  Start-CodexWallpaper.ps1     # 版本/入口核验、CDP 启动、Startup 管理
  static-background.mjs        # 注入壁纸运行层
  client-runtime.mjs           # 壁纸库、设置、快捷键和页面适配
  wallpaper-library.mjs        # Steam/WE 发现、扫描、按需素材准备
  wallpaper-host.mjs           # 本地隐藏辅助进程
  Reset-CodexWallpaper.cmd     # 清理自有本地回执/文件
  Reset-CodexWallpaper.ps1
  vendor/                      # 固定版本的上游扫描代码与许可说明
docs/planning/
  codex-wallpaper-candidate.md # 中文候选能力与人工验收门槛
package.json
pnpm-lock.yaml
```

`launcher/README.md` 是更详细的中文交付与人工验收说明。`docs/planning/codex-wallpaper-candidate.md` 记录当前候选能力、离线证据和尚未完成的验收项。这两份资料目前只有中文。

## 已知限制

- 当前是开发候选，不是完成全部验收的稳定版本。
- 只支持 Windows；没有 macOS、Linux 或移动端实现。
- 只锁定 Codex `26.1111.2228.0` 的一组已记录身份。Codex 更新后必须先等待兼容更新，不能沿用旧的摘要检查。
- 原 Codex 入口尚不能自动接入；每次必须从专用启动器进入。
- 界面文案只有简体中文，英文和日文文档不等于多语言 UI。
- 不支持联网 Web 壁纸；离线 Web 不能执行脚本或加载外部资源。
- 不能保证所有 Wallpaper Engine 素材可播放。Scene 覆盖率、跨 DPI、主题组合、多窗口资源成本和故障恢复仍需逐项实测。
- 真实登录/重启 Startup、完整真实宿主交互、30–60 分钟资源对照、8 小时基础和 7 天长期观察尚未完成。
- 自动 fixture 与 headless 测试只证明已覆盖的规则，不证明真实 Codex 中全部窗口、面板和边界场景。

## 上游来源与许可证

- Wallpaper Engine 的 Steam 安装发现和项目扫描复用了 [`elysia395/dsh-wallpaper-engine`](https://github.com/elysia395/dsh-wallpaper-engine) 固定版本 `fd3e01fd11cd5ad83f46940ab4d61d971cfbcf91` 中的 `steam-discovery.js` 和 `wallpaper-scan.js`。这两个文件作为未修改副本放在 `launcher/vendor/dsh-wallpaper-engine/`，按上游 MIT 许可保留 `LICENSE`。DSH/Cordis 宿主集成没有随之复用。
- Scene 渲染依赖 [`webwallgl@3.0.0`](https://github.com/oneincase/webwallgl)，采用 MIT 许可。完整第三方声明见 `launcher/vendor/THIRD_PARTY_NOTICES.md`，上游固定信息见 `launcher/vendor/dsh-wallpaper-engine/UPSTREAM.md`。
- 本仓库当前没有根目录 `LICENSE`，因此不能把整个项目自动描述为 MIT 或其他开源许可。第三方代码只适用各自声明，壁纸、角色、字体和预览素材的授权仍由素材来源决定；本项目不随代码授予这些素材的使用权。
