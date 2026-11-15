# 04: 输入区底衬与界面组件视觉收口

**What to build:** 消除输入框后方比输入框大得多的黑色矩形，同时保留输入框本体、长聊天、工具卡片、代码、差异、侧栏、面板和弹窗的可读实底与正常操作。

**Blocked by:** 01 · 适配当前 Codex 更新并恢复壁纸。

**Status:** ready-for-human

- [x] 输入框后方的大面积宿主底衬恢复透明，壁纸连续显示到输入区边缘；输入框本体、代码、差异和工具卡片仍有足够读底。
- [x] 明暗主题下文字可读；壁纸层不拦截点击、滚动、文本选择、复制、焦点和键盘输入。
- [x] 控制按钮、设置面板、侧栏和弹窗层级正确；不为视觉透明改写内嵌网页或编辑器内容。
- [x] 保留并验证当前已经存在但尚未统一提交的底衬修复；真实问题由计算样式和用户可见截图共同证明。
- [x] 回归覆盖“输入框本体有底衬、输入框后方宿主底衬透明、工具卡片可点击、输入框可获得焦点、文字可选择”。删除只重复上述行为或只断言脆弱 CSS 文本的测试。
- [x] 新增选择器必须对应已复现的 Codex DOM 结构或稳定语义属性；优先复用现有主题变量和表面规则，不维护第二套固定主题色。
- [ ] 交付前在真实 Codex 检查输入、选区、复制、工具卡片展开、左右面板和明暗主题，并保存不含聊天正文的视觉证据。

## Evidence

- **源码证据（当前安装包，非当前真实视觉验收）：** 只读核对 `OpenAI.Codex 26.1111.2228.0` 的 `webview/assets/async/344734.3322725bda.js`。`[data-thread-composer-backdrop]` 位于 `[data-thread-scroll-footer]` 内，并包裹输入区内容，因此不能用它或其全部 `.bg-surface` 后代表示纯背景层；最终规则以 footer 为边界，并显式保留 `[data-composer-surface-variant]` 及其后代的可读表面。
- **历史视觉证据（问题存在，非修复验收）：** `C:/Users/614/.codex/visualizations/2026/11/15/01a1de7d-8db1-72c2-8265-60074996389d/historical-composer.jpg` 显示真实历史截图中输入框后方的大面积深色底衬。
- **自动回归证据（当前 fixture，非真实 Codex）：** headless Edge fixture 将输入区嵌套在语义 marker 内，分别核对明暗主题下 footer 背景计算色透明、输入框本体与工具卡片/代码/差异仍有读底，以及按钮点击、输入焦点、键盘事件和文字选择。
- **当前真实视觉验收：** 未执行。按本轮约束没有连接、交互、启动或重启真实 Codex。

## Comments

- 2026-11-15：原始 `D:/AI/壁纸` 的三文件未提交候选保持不动；已用 `D:/AI/codex-wallpaper-composer-candidate.patch` 核对内容。补丁因 03 已修改相邻 CSS/fixture 上下文而无法直接应用，按候选行为手工移植 footer 修复，并让 fixture 镜像“marker 包裹输入区”的当前源码结构。
- 2026-11-15：TDD 红灯先只暴露 `footerBackdropTransparent: false`，输入框本体读底与全部交互仍为绿；加入 footer 透明规则并排除输入区表面后，同一 headless Edge 回归转绿。没有用完整 CSS 字符串或私有实现状态作断言。
- 2026-11-15 Standards 复核：安装包 `344734.3322725bda.js` 证明输入区 wrapper 不是字面 `.bg-surface` 背景层，且 footer 还有 `[data-pip-obstacle='thread-footer-leading']` 前导内容分支。规则保留用户已证明的 footer 透明修复，并显式排除该分支及其后代；fixture 新增同分支读底断言。没有猜测新的 backdrop 节点身份，也没有改动 Codex 自带 footer 淡出伪元素。真实 Codex 的最终视觉范围和伪元素表现仍保留在人工门禁中。
