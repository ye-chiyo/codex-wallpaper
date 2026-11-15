# 03: 聊天与变更页保持同一壁纸

**What to build:** 用户在 Codex 聊天与“变更”页面之间切换时，相同壁纸保持可见。未加载的素材使用已有作者预览或上一帧过渡，不出现黑闪、默认渐变闪入、旧新画面交替或重复播放器。

**Blocked by:** 01 · 适配当前 Codex 更新并恢复壁纸。

**Status:** ready-for-human

- [x] 以当前安装包的只读源码证据确认真实的“变更”入口：`async/175787.5f88647104.js` 注册 `DIFF` tab、标题为 Changes 并激活任务侧栏；`async/200114.81334159bb.js` 在 `data-app-shell-workspace-row` 内挂载 `data-app-shell-trailing-sidebar`。本单只为该页面内变更表面增加适配，不把 Avatar、浏览器标签页或其他 `app://` 页面纳入。
- [x] 自动回归在现有 `applyStaticBackground` / headless Edge fixture 接缝打开变更侧栏，确认壁纸仍使用同一根层和当前运行时；检查后关闭侧栏，避免后续端到端步骤停留在变更页。
- [x] 变更侧栏外壳仅在有 `[data-thread-find-target='review']` 时透明；同一 trailing sidebar 移除 review 标记后恢复普通可读底，避免影响 terminal、files 或其他面板。变更滚动根保持透明，真实代码/diff 的 `pre` 和既有局部表面对比度规则继续提供可读底。
- [x] 红灯先稳定复现：变更外壳不透明且 review 标记没有可读局部表面；生产最小改动后转绿。断言使用计算样式、根层数量和公开 `__codexWallpaperApi.state()`，不读取私有变量或完整 CSS 文本。
- [x] 复用同一运行时、同一全局配置、同一根壁纸层和既有 `pre` / 本地表面规则；没有新增播放器、素材请求通道、配置源、detached 注入或多窗口宿主流程。
- [ ] detached 页面身份门禁被阻断：`async/739154.e5ff8d46b9.js` 的 `detached-window.html` 只注册 `browser -> mountDetachedBrowserPage`，打包的 browser detach/prewarm 窗口也使用该入口；`.vite/build/early-bootstrap-331-29198f5b57adf59a.js` 的 `show-diff` 则把 `toggle-diff-panel` 发回 source WebContents。仅凭页面路径不能把它认定为 Changes，因此本单没有向 detached 目标注入。
- [ ] 若未来真实宿主证明确有 Changes 使用 detached 页面，需从真实 DOM、精确 target URL 和来源关系取得新证据，并在独立任务中重新评估；不能把当前 browser detach 泛化为 Changes。
- [ ] 现有素材连续性与播放器代次测试继续作为回归覆盖；本单没有修改图片、视频、Scene、Web 或异步回调路径。
- [ ] 真实 Codex 连续至少 10 次切换聊天与变更页，交付前完成截图或录屏视觉检查，记录黑闪、默认渐变、重复播放器和控制按钮状态。

## Evidence

- 当前安装包：`OpenAI.Codex 26.1111.2228.0`。只读取 MSIX `app.asar` 与脱敏历史录屏；未连接、启动、关闭或重启 Codex。
- `webview/assets/async/175787.5f88647104.js`：拦截已在变更页时的再次打开，调用 `toggleThreadSidePanel(..., false)`；否则注册 `DIFF` tab 并激活任务侧栏。
- `webview/assets/async/200114.81334159bb.js`：`data-app-shell-trailing-sidebar` 是 workspace row 的兄弟 motion div，子节点为 `h-full min-w-0`。
- `webview/assets/async/794655.a1ca8a7a9e.js`：Changes diff scroll 根发出 `data-thread-find-target="review"`，IDs 为 `review-diffs-open/collapsed`。
- `webview/assets/async/827427.1dce364c9d.js`：局部 diff 预览仍使用 `data-testid="diff-preview-scroll"` 与真实 `FileDiff`；本单保留既有局部表面规则并新增稳定 review 标记覆盖。
- 历史脱敏帧显示右侧变更区域重复变为近全黑，而主聊天区域仍有壁纸；该视觉现象证明问题所在，但不证明右栏 URL，更不证明 detached 页面属于 Changes。

## Human gates

- [ ] 用户明确允许操作真实候选后，在现有聊天连续至少 10 次切换“变更”和聊天，亲自检查无黑闪、默认渐变闪入、旧新画面交替、重复播放器或控制按钮消失；确认主聊天与变更侧栏显示同一当前选择。
- [ ] 在同一人工检查中确认变更滚动区域透出同一壁纸，diff/code 内容仍有足够局部读底；再切到 terminal/files 等非 review trailing pane，确认普通面板底与交互未回退。
- [ ] 人工确认实际点击“变更”没有进入未核验的 detached browser 页面。若宿主行为与静态源码不符，停止并把真实 target URL、DOM 标记和操作步骤作为新证据交回，不在现有实例中试探注入。
- [ ] 真实 Codex 中的输入、点击、滚动、文本选择和控制按钮仍可用；自动 fixture 只证明页面计算样式与单根层，不替代真实宿主结果。

## Comments

- 2026-11-15：TDD 红灯在 headless Edge fixture 中同时复现 opaque trailing sidebar 与 review 表面缺少可读底；调整 `:has([data-thread-find-target='review'])` 外壳透明规则、review 滚动根透明规则并保留局部 `pre` / class surface 后转绿。Fixture 关闭变更侧栏后再执行剩余启停与完整流程。
- 2026-11-15：验证通过 `corepack pnpm test` 10/10、startup-roots 2/2、profile-preflight 7/7。当前分支没有修改 02 的 PowerShell/startup 文件，也没有应用 04 candidate。
- 2026-11-15：05 统一链路只使用已核验的 `data-app-shell-trailing-sidebar` / `data-thread-find-target='review'` fixture 结构，未新增 detached 注入或 target allowlist。真实 detached 页面身份仍无 live 证据，本门禁保持未通过；脱敏历史帧仅保留“曾发生黑底”的外观佐证。
- 2026-11-16：从 D:/AI/codex-wallpaper-hardening 手动启动 20b9660 后，实际点击聊天卡上的「变更」。当前主聊天 CDP 目标保持可见，未新增 detached 目标；已存在的 detached 目标在点击前后均存在。窗口中出现可关闭的「变更」标签，当前脱敏截图显示右侧内容区仍有深色实底。窗口布局随后变化，未捕获十轮有效切换或时序证据；不勾选连续性及无闪动验收。
