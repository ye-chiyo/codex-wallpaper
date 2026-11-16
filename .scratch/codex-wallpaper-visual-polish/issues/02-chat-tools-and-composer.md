# 02: 聊天读底、工具与输入

**What to build:** 在原有聊天中从阅读正文、展开工具和查看代码到输入都保持清晰可用，沿用统一材质。

**Blocked by:** 01 · 主窗口壁纸与顶部交互。

**Status:** ready-for-human

- [x] 较深的半透明读底铺满原有对话区；正文、普通状态和辅助信息共用底色，可展开工具行和代码保留必要的局部读底，无窄面板、重复读底或输入框外侧黑块。
- [x] 输入框的细边框、圆角、悬停及焦点与共享材质协调。输入框可聚焦并接收键盘输入，文本可选择、聊天可滚动、工具行可展开。
- [ ] 复用现有夹具验证输入、焦点和外侧底衬等可稳定复现的行为；在获准后的真实界面复查操作和画面，不发送聊天。

## Comments

- 2026-11-16：源码与夹具完成，真实 Codex 未连接、未操作。沿用 01 的外框底涂和主区增量 Canvas，未调整四周材质或布局；普通正文、状态和用户气泡继续共享聊天 Canvas，不再被宽泛的 `.bg-surface` 或固定强调色重新加板。局部读底只用于 `[data-testid='webmcp-tool-scroll']`、`[data-summary-panel-variant]`、聊天代码和真实 footer 前导内容。输入框保留共享主题底、细边框和圆角，增加主题文字色驱动的 hover 与 `:focus-within` 状态；footer 背景与伪元素透明规则和真实前导内容读底继续复用。
- 2026-11-16：旧专用宿主只读结构核对后，将通用可展开行限定为 `[data-app-action-timeline-scroll] [data-local-conversation-item-target-ids] :has(> button[aria-expanded].rounded-md.bg-transparent)`；它覆盖稳定祖先下四层包裹的 `div.relative.min-w-0.gap-1`/按钮结构，未把 `aria-expanded` 单独当作工具行信号，也未命中 composer 或用户 Markdown/复制按钮。现有 Edge 主夹具镜像该层级、摘要行、聊天代码、普通状态和透明 footer；先红于普通状态被额外加板，再红于新增真实时间线层级未命中，规则收敛后转绿。输入检查已删除脚本内 `focus()`/合成 `keydown`，改为真实派发鼠标命中后在输入框处用 CDP `Input.insertText`，同时复用原 footer 计算样式回归，没有新增测试套件。
- 2026-11-16：`npm test` 12/12 通过，修改文件经指定 Prettier 与 `git diff --check` 通过。以上仅证明源码和浏览器夹具；真实宿主中的明暗视觉、工具展开、滚动/选择/输入及用户确认仍待验，第三项保持未勾选。提交后按用户指示合并当时最新集成提示 `23a8f00`；该提示只简化已完成的 01 独立夹具，不修改本单运行时或共享测试行为。
