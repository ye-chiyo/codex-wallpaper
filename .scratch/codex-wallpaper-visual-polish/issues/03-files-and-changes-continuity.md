# 03: 文件与「变更」面板连续显示

**What to build:** 从原有主窗口打开文件或「变更」时，壁纸连续可见，差异可读，标签可切换并可返回聊天。

**Blocked by:** 01 · 主窗口壁纸与顶部交互。

**Status:** ready-for-agent

- [ ] 文件与「变更」外壳透出同一壁纸，差异保留局部读底和清晰的增删标识；右侧开合无明显接缝、裁切或遮挡。
- [ ] 沿用已核验的同一主窗口入口和现有防闪路径。在获准后的真实界面中，用鼠标验证文件与「变更」标签切换及返回聊天，不关闭含未保存内容的标签。
- [ ] 无法安全透明化的宿主区域保留原生读底及操作，记录具体位置、原因和实际效果。

## Comments

- 2026-11-16 源码与夹具：沿用质量收敛单已核验的 `data-app-shell-trailing-sidebar`、`data-thread-find-target='review'`、`data-testid='diff-preview-scroll'`，并以当前安装包只读源码核对 `role='tablist'`、`file-tree-container`、`.composer-diff-simple-line` 及 `--diffs-bg-addition/deletion`。运行时只移除右侧 trailing sidebar 的重复外框涂装；Files/Changes 共用透明外壳，标签栏透明并保留细线，文件树 host 使用其 `--trees-bg-override` 透出壁纸，review 滚动根保持透明，只有 diff 本体获得 78% 局部读底；增删行使用宿主 `--color-codex-diff-added/deleted` 以 24% 着色，未覆盖原生行细节。
- 2026-11-16 TDD：在现有 `startFixture` 的 Changes 场景补入 Files/Changes 标签、文件树 host、review 根和增删行代表。先红复现 review 局部读底与增删着色缺失，再以小范围运行时规则转绿；同时验证从聊天按钮的命中元素打开、Files 选中、返回 Changes 以及关闭。`npm test` 12/12 通过，`launcher/static-background.test.mjs` 3/3 通过。
- 2026-11-16 限制：本轮未连接或操作真实 Codex，未取得真实 Files/Changes 开合、鼠标标签切换、截图或录屏证据；上述两项真实操作门禁及第三项透明化限制复核保持未勾选。文件编辑器、浏览器/MCP guest 和其他内嵌 app 内部未改样式，继续使用宿主原生读底。`file-tree-container` 内部行状态和 FileDiff shadow DOM 的实际继承效果仅由已知 host/custom-property 契约和夹具覆盖，仍需后续同版真实视觉复核。
