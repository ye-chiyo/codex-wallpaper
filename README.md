# Codex Wallpaper：Windows Codex 本地壁纸与界面适配

[简体中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

> **项目状态：Windows 开发候选。** 自动测试覆盖启动校验、素材导入、停用和清理。在 x64 Codex `26.1117.3838.0` 上，较早的发布快照已实测专用冷启动、设置恢复和清理后返回官方入口。本次改动的实机复测、登录启动和长期运行仍待验收；当前候选只支持一个经核验的 Codex 主窗口。[候选验收记录](docs/planning/codex-wallpaper-candidate.md)
>
> **非官方工具：** 这不是 OpenAI 官方功能，也不代表 OpenAI 对兼容性或安全性的认可。它通过独立启动器核验本机 Codex 后，向主界面加入本地壁纸和界面适配。
>
> 参考材料：[架构说明](docs/architecture.md) · [Windows 开发候选发布说明](docs/releases/codex-wallpaper-windows-candidate.md)

## 项目简介

Codex Wallpaper 面向 Windows 版 Codex 桌面端，把本地图片、视频、Wallpaper Engine 本机素材和静态网页背景显示在 Codex 主界面后方，并调整聊天、工具卡片、侧栏、设置和输入区域的可读性与层次。

项目不修改 Codex 安装包，也不替换账号或聊天数据。基础入口是 `launcher/Codex-Wallpaper.cmd`；测试者也可以按 [launcher/README.md](launcher/README.md) 中的可选说明自行构建 C# 桌面启动层。原 Codex 启动入口目前不能自动接入壁纸层，本项目不会替换或修改现有的 Codex、桌面或任务栏快捷方式。候选会先核对精确的 Codex 包版本、应用登记和原可执行文件摘要，不匹配时保持原界面。

自有源码公开供阅读，具体范围见[上游来源与许可证](#上游来源与许可证)。

## 功能与状态

功能列描述当前实现，验收列列出已有证据和仍待实机确认的范围。

| 功能                        | 当前实现                                                                                    | 验收和限制                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 内置背景                    | 无需导入素材即可显示内置渐变                                                                | 自动夹具覆盖启动和恢复                                                               |
| 导入本地图片和视频          | 从壁纸库选择文件，存入 IndexedDB 后显示。视频默认静音循环                                   | 自动夹具覆盖导入、切换、失败保留和清理。真实 Codex 的图片和视频导入及重开验证待验    |
| Wallpaper Engine 图片和视频 | 扫描本机已下载项目，选中后由隐藏宿主按需读取                                                | 视频主素材上限 1 GiB，其他素材及兼容回退上限 512 MiB。前置 `moov` 视频热切有实测样本 |
| Wallpaper Engine Scene      | 由 WebWallGL 渲染，失败或不支持时尝试作者预览                                               | 自动夹具已有覆盖。创意工坊样本兼容率和长期运行待验                                   |
| Wallpaper Engine 离线 Web   | 在 `srcdoc` 沙箱中显示本机 HTML。外部资源会被屏蔽，依赖它们的页面可能显示不完整             | HTML 超过 512 KiB、无法读取或含 `<script>` 时尝试作者预览。联网 Web 不受支持         |
| 界面适配和设置              | 适配聊天、工具卡片、代码/差异、侧栏、设置、输入框和弹层。提供壁纸库、播放与性能、外观与预设 | 已有设置持久化、停用和恢复的实机记录。完整交互、主题和 DPI 组合待验                  |
| 同源设置同步                | 在已注入的同源页面间同步设置事件，各页面独立判断可见性                                      | 浏览器夹具通过，隐藏 iframe 只验证设置事件。当前候选只接入一个经核验的主窗口         |
| 快捷键                      | 在 Codex 页面中用 `Alt+Shift+S` 打开或收起设置，`Alt+Shift+W` 停用或恢复壁纸                | 浏览器夹具和已有实机记录覆盖恢复。快捷键需窗口焦点                                   |
| Windows 登录启动（可选）    | 可创建、查询和撤销当前用户的一个 Startup 快捷方式                                           | 临时目录夹具通过。真实登录、注销、重启和重复触发待验                                 |

## 环境要求

| 项目       | 要求                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| 系统       | Windows，安装下表中的 x64 MSIX。候选尚未确认最低 Windows 版本                               |
| PowerShell | Windows PowerShell 5.1，系统自带的 `powershell.exe`                                         |
| 工具       | Git、Node.js Windows x64 24 或更新版本。日常使用由安装脚本调用固定的 pnpm 11.25.0。         |
| 可选依赖   | Steam 和 Wallpaper Engine，用于访问本机 Wallpaper Engine 库。内置背景和手动导入无需安装它们 |

### Codex 兼容性

| `PackageFullName`                                | 原 EXE SHA-256                                                     | 验证记录                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0` | `21C2EAC7703B43611392234738F669A8AF23907585B231EBDE54CA3CB104CC82` | 本机只读状态显示 `CompatibilityMode: known`；本次改动待真实 E2E 复测     |
| `OpenAI.Codex_26.1117.3838.0_x64__2p2nqsd0c76g0` | `AF4D57201946260D2754172BC660EFF80B5398EA146EF466126886CCD0CF2514` | 此前发布快照实测专用入口达到 `wallpaper-ready`。本次改动待实机复测       |
| `OpenAI.Codex_26.1111.2228.0_x64__2p2nqsd0c76g0` | `CF2EE1CE895DF9EE158EE61830D9D0F805C77D9B212AD0E159AE605AE04260C6` | 较早候选达到过 `wallpaper-ready`。本发布候选对此版本只有启动预检夹具记录 |

启动器核对完整包名、应用登记 `OpenAI.Codex_2p2nqsd0c76g0!App`、原 EXE 的 SHA-256、日常 profile、唯一主进程和主界面。已登记包与摘要完全一致时走快速路径；可信但未登记的版本进入主界面兼容探测；未知或不可信包、已登记包的摘要漂移和多主进程均在接入前失败关闭，保留原界面。实机和夹具结果见[候选验收记录](docs/planning/codex-wallpaper-candidate.md)。

## 快速开始

在 PowerShell 中按顺序操作。

1. **获取源码。** 克隆后使用 GitHub 默认分支，并进入仓库根目录。

   ```powershell
   git clone https://github.com/ye-chiyo/codex-wallpaper.git
   Set-Location .\codex-wallpaper
   ```

   也可以在 GitHub 点击 **Code → Download ZIP**，完整解压后打开解压目录。

2. **先核对 Codex 包。** 只有结果恰好一条、且 `PackageFullName` 与上表一项完全一致，才继续安装依赖。无结果、多条结果或包名不同，请使用 Windows 开始菜单中的官方 Codex 入口，等壁纸项目支持你的安装包。

   ```powershell
   Get-AppxPackage -Name OpenAI.Codex | Select-Object PackageFullName, Version
   ```

3. **安装壁凸运行依赖。** 从 [Node.js 官方归档](https://nodejs.org/en/download/archive/v24.16.0) 安装 Windows x64 MSI，然后打开新的 PowerShell。回到源码目录，双击 [Setup-CodexWallpaper.cmd](launcher/Setup-CodexWallpaper.cmd)，或运行下方命令。首次安装需要联网，脚本按锁文件安装运行依赖，无需全局安装 pnpm。

   ```powershell
   .\launcher\Setup-CodexWallpaper.cmd
   ```

4. **先用官方入口完成 Codex 初始化。** 从 Windows 开始菜单打开 Codex，需要时登录。等主界面加载，确认账号和已有聊天可用。如果是全新账号，确认能打开新聊天。然后正常、完全退出 Codex，等待主进程结束。关闭窗口或最小化后，Codex 仍可能在后台运行。

5. **启动主界面壁纸。** 在仓库根目录运行专用 CMD。

   ```powershell
   .\launcher\Codex-Wallpaper.cmd
   ```

   ```text
   Outcome: wallpaper-ready
   Wallpaper: enabled
   ```

   `Outcome: wallpaper-ready` 表示启动器已核验主界面且壁纸宿主已就绪。`Wallpaper: enabled` 时应能看到主界面壁纸。若之前保存了停用状态，可能显示 `Wallpaper: disabled`，此时仍能看到原界面，可在 Codex 窗口内按 `Alt+Shift+W` 恢复。确认能打开聊天并正常使用输入框。若专用会话显示登录页，退出后从官方入口完成初始化。启动器提前停止时，按控制台提示查阅[常见问题](#常见问题)。

要只读确认 Codex 是否已退出，可在仓库根目录运行：

```powershell
powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1
```

兼容包下，`"Running": []` 表示未发现 Codex 主进程。官方入口启动的普通实例预期显示 `DebugFlag: false` 和 `ListeningPorts: []`。

开发时先运行 `pnpm.cmd install --frozen-lockfile` 安装开发依赖，再运行 `pnpm.cmd test`。自动夹具和实机结果分别记录在[候选验收记录](docs/planning/codex-wallpaper-candidate.md)。

## 日常使用

壁纸运行时，按 `Alt+Shift+S` 打开或收起设置面板。当前界面文案只有简体中文；英文和日文文档保留实际中文按钮名并附译文。

| 中文界面                | English                               | 日本語                                       |
| ----------------------- | ------------------------------------- | -------------------------------------------- |
| `壁纸设置`              | Wallpaper settings                    | 壁紙設定                                     |
| `壁纸库`                | Wallpaper library                     | 壁紙ライブラリ                               |
| `播放与性能`            | Playback and performance              | 再生とパフォーマンス                         |
| `外观与预设`            | Appearance and presets                | 外観とプリセット                             |
| `导入素材`              | Import assets                         | 素材をインポート                             |
| `使用`                  | Use                                   | 使用                                         |
| `收藏`                  | Favorite                              | お気に入り                                   |
| `加入轮播` / `移除轮播` | Add to / remove from rotation         | ローテーションに追加 / から削除              |
| `保存当前设置`          | Save current settings                 | 現在の設定を保存                             |
| `导出设置` / `导入设置` | Export / import settings              | 設定をエクスポート / インポート              |
| `移除全部导入素材`      | Remove all imported assets            | インポート素材をすべて削除                   |
| `停用并清除本项目数据`  | Disable and clear this project’s data | 壁紙を無効化して本プロジェクトのデータを消去 |
| `再次点击确认清除`      | Click again to confirm deletion       | もう一度クリックして消去を確定               |

基本流程：

1. 按 `Alt+Shift+S` 打开 `壁纸设置`，在 `壁纸库` 中选择内置背景、导入媒体或本机 Wallpaper Engine 项目。
2. 点击 `使用` 切换当前壁纸。素材缺失或读取失败时，页面会跳过缺失项或保留当前画面。
3. 使用星号按钮收藏，使用 `加入轮播` / `移除轮播` 管理播放列表。轮播至少需要两项，间隔为 0 分钟时关闭。
4. 在 `播放与性能` 调整性能档位、Scene 上限、静音、音量和轮播；在 `外观与预设` 调整画面、界面读底、分区覆盖，并可保存、导入、导出或恢复预设。已注入的同源页面会同步设置；当前候选不会接入第二个真实 Codex 主窗口。
5. 按 `Alt+Shift+W` 移除背景和设置面板；再次按下会恢复上次启用的素材和设置。

外观参数：

| 参数     | 范围与默认值                                          | 说明                                     |
| -------- | ----------------------------------------------------- | ---------------------------------------- |
| 暗化     | 0–70%，默认 18%                                       | 加深背景以提升文字可读性                 |
| 模糊     | 0–24 px，默认 0                                       | 模糊壁纸媒体层                           |
| 不透明度 | 20–100%，默认 100%                                    | 控制壁纸媒体层透明度                     |
| 帧率     | 性能优先 15 FPS，均衡 30 FPS（默认），自定义 1–30 FPS | Scene 渲染上限，视频按源文件的节奏播放   |
| 音量     | 0–100%，默认 0                                        | 0 为静音；有声视频及素材自身音频仍需实测 |
| 轮播     | 0–120 分钟，默认 0                                    | 至少两项且大于 0 才启用                  |
| 界面读底 | 20–100%，默认 72%                                     | 调整 Codex 界面可读层强度                |
| 界面雾化 | 0–24 px，默认 0                                       | 对界面可读层施加模糊                     |

视频和 Scene 默认在各自页面报告不可见时暂停，恢复可见后继续。离线 Web 沙箱内的帧率和暂停由其内容决定。

## 启动器选项与诊断

[启动器说明](launcher/README.md)集中记录完整 EXE 摘要的查询位置、可选 GUI 构建、[登录启动](launcher/README.md#windows-登录启动)与[详细诊断](launcher/README.md#诊断与回执)。详细说明当前为中文。[候选验收记录](docs/planning/codex-wallpaper-candidate.md)列出自动化结果、对应的实机快照和待验项目。

## 停用与卸载

### 升级壁纸工具

先正常、完全退出旧的专用 Codex 实例，再更新源码、复查 Codex 包并重新安装锁定依赖。之后按[快速开始](#快速开始)重新运行专用 CMD。重复启动时，已核验的专用实例会被复用，已有普通实例会拒绝接入。若控制台报告 `Outcome: runtime-version-mismatch`，完全退出 Codex，再用新版专用 CMD 重开。启动器会保留已挂载的那一份壁纸运行时。

### 临时停用

在有焦点的 Codex 窗口中按 `Alt+Shift+W`。再次按下可恢复上次的壁纸和设置。停用后壁纸层和播放器卸载，专用调试监听会在 Codex 实例完全退出时结束。

### 清理和返回官方入口

1. **先清除页内数据。** 在专用实例里按 `Alt+Shift+S`，打开 `外观与预设`。点击 `停用并清除本项目数据`，再点击 `再次点击确认清除`。这会停用壁纸并清除本项目的页内设置和 IndexedDB 导入素材。如果已临时停用，先用快捷键恢复以打开设置。
2. **撤销登录启动。** 如果启用过，运行 `-DisableStartup`，再用 `-StartupStatus` 确认 `Status` 为 `disabled`。[登录启动命令](launcher/README.md#windows-登录启动)
3. **完全退出专用 Codex。** 如需确认，可运行快速开始中的只读状态命令，等待显示 `"Running": []`。
4. **清理本地回执和缓存。** 退出后运行 `launcher\Reset-CodexWallpaper.cmd`。该命令会清理 `%LOCALAPPDATA%\CodexWallpaper`。
5. **从官方入口打开 Codex。** 在 Windows 开始菜单打开 Codex，确认原账号和已有聊天可用。如需彻底移除工具，可删除本地仓库和自行创建的壁纸快捷方式。

保留 Codex 的日常 profile、账号和聊天数据。页内清理及本地重置只针对本项目数据。

## 常见问题

### 启动后没有壁纸

先确认 Codex 已完全退出，再从头运行 `launcher\Codex-Wallpaper.cmd`。运行中的已核验专用实例可以复用，普通实例继续使用原界面。核对包版本是否为已登记的 `26.1117.4957.0`、`26.1117.3838.0` 或 `26.1111.2228.0`，并查看控制台中的 `Outcome`。可信但未登记的版本可能先进入兼容探测；状态命令只读，不会注入。

### `Alt+Shift+S` 或 `Alt+Shift+W` 没有反应

快捷键安装在壁纸运行的页面内，不是系统全局热键。请先点击专用 Codex 窗口使其获得键盘焦点，再重试。页面停用时没有设置面板，先按 `Alt+Shift+W` 恢复壁纸；仍无响应时回到启动器查看 `Outcome` 和 `Wallpaper.state`。

### 首次启动提示缺少日常配置

如果控制台显示 `Expected daily profile directory is missing`，请用 Windows 开始菜单中的官方 Codex 入口完成[快速开始](#快速开始)第 4 步，然后重试专用 CMD。若仍报同样的错，先继续使用官方入口。无人值守模式下，这项失败对应回执中的 `daily-profile-missing`。

### 提示版本或可执行文件不匹配

- `Unsupported or ambiguous Codex package`（无人值守回执 `unsupported-package`）。重新执行[快速开始](#快速开始)第 2 步，核对是否只有一个匹配的 x64 MSIX。如果 Codex 已更新到表外版本，请用官方入口继续使用，等壁纸项目更新兼容包。
- `Original executable or app registration did not match`（无人值守回执 `executable-or-app-registration-mismatch`）。即使包名匹配，EXE 的 SHA-256 或 Windows 应用登记也可能不一致。请用官方入口确认 Codex 能打开。若官方入口可用而专用入口仍报错，请保留该提示以便排查。

这两种不匹配都发生在壁纸接入之前。专用 CMD 在此阶段直接显示控制台提示。请保留启动器的版本、登记和摘要检查，使用官方入口继续打开原界面。

### Wallpaper Engine 素材无法播放

候选只处理本机已下载项目。视频主素材通过本地 File 通路支持到 1 GiB，其他素材和兼容回退上限为 512 MiB。离线 Web 的 HTML 超过 512 KiB、无法读取或含 `<script>` 时，会尝试使用作者预览。外链资源会被屏蔽，页面可能只显示本地内容。

### 切换壁纸出现黑屏、卡住或画面未更新

大型 Scene/视频需要按需读取。先等待当前切换完成，再选择另一项；必要时用 `Alt+Shift+W` 停用，再按一次恢复。若问题可重复，保留发生时间、素材类型和回执中的 `Outcome`，不要附带聊天正文、账号信息或未经检查的完整回执。

### 出现登录页或账号状态异常

不要在这个验证实例中重新登录。完全退出验证实例，再从原 Codex 入口确认原账号和已有聊天。若原入口正常，把专用启动器回执中的 `Outcome` 和 `NativeProfile` 作为诊断信息，不要复制或上传 profile。

## 项目结构

```text
launcher/
  Setup-CodexWallpaper.cmd     # 安装锁定的运行依赖
  Codex-Wallpaper.cmd          # 专用启动入口
  Start-CodexWallpaper.ps1     # 版本/入口核验、CDP 启动、Startup 管理
  CodexWallpaperDesktop.cs     # 可选 C# 桌面启动层
  startup-supervisor.mjs       # 主界面发现、重连和宿主监督
  startup-preview.mjs          # 启动画面缓存
  mp4-layout.mjs               # 大视频 File 播放布局
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

[启动器说明](launcher/README.md)记录运行选项和诊断，[候选验收记录](docs/planning/codex-wallpaper-candidate.md)记录证据及待验项目。

## 已知限制

- 当前是开发候选，不是完成全部验收的稳定版本。
- 只支持 Windows；没有 macOS、Linux 或移动端实现。
- 精确支持 Codex `26.1117.4957.0`、`26.1117.3838.0` 和 `26.1111.2228.0` 三组已记录身份；可信但未登记的版本只能经主界面探测后接入。已登记包的摘要漂移、未知身份和多主进程都会失败关闭，不能绕过包、登记、摘要或主界面核验。
- 当前候选只支持一个经核验的 Codex 主窗口。出现两个精确主页面时失败关闭；同源 `storage` 只同步已注入页面的设置，不代表真实第二窗口会获得壁纸。
- 原 Codex 入口尚不能自动接入；每次必须从专用启动器进入。
- 界面文案只有简体中文，英文和日文文档不等于多语言 UI。
- 不支持联网 Web 壁纸；离线 Web 不能执行脚本或加载外部资源。
- 不能保证所有 Wallpaper Engine 素材可播放。视频上限为 1 GiB，其他素材及兼容回退上限为 512 MiB；Scene 覆盖率、跨 DPI、主题组合和故障恢复仍需逐项实测，真实第二主窗口自动注入不在本次范围。
- 真实登录/重启 Startup、完整真实宿主交互、30–60 分钟资源对照、8 小时基础和 7 天长期观察尚未完成。
- 自动 fixture 与 headless 测试只证明已覆盖的规则，不证明真实 Codex 中全部窗口、面板和边界场景。

## 上游来源与许可证

- Wallpaper Engine 的 Steam 安装发现和项目扫描复用了 [`elysia395/dsh-wallpaper-engine`](https://github.com/elysia395/dsh-wallpaper-engine) 固定版本 `fd3e01fd11cd5ad83f46940ab4d61d971cfbcf91` 中的 `steam-discovery.js` 和 `wallpaper-scan.js`。这两个文件作为未修改副本放在 `launcher/vendor/dsh-wallpaper-engine/`，按上游 MIT 许可保留 `LICENSE`。DSH/Cordis 宿主集成没有随之复用。
- Scene 渲染依赖 [`webwallgl@3.0.0`](https://github.com/oneincase/webwallgl)，采用 MIT 许可。依赖安装后，许可全文位于 `node_modules/webwallgl/LICENSE`。[第三方声明](launcher/vendor/THIRD_PARTY_NOTICES.md)和[扫描代码的上游固定信息](launcher/vendor/dsh-wallpaper-engine/UPSTREAM.md)可直接查阅。
- 项目自有源码公开供阅读和参考。仓库未提供项目自有代码的一般性复用许可。复制、改编或分发时，请向维护者取得相应授权。上游代码按各自许可使用，壁纸、角色、字体和预览素材按各来源的授权使用。
