# 03: 清理、缓存和 IndexedDB 失败闭环

**What to build:** 让停用和清除页面数据在多个同源页面、慢响应和 IndexedDB 异常下仍可预测。清除必须通过跨页面确认完成，而不是依赖固定等待；成功后不能继续复用旧 Web 内容、旧失败状态或旧预览缓存。导入、移除和 reset 的存储失败必须给用户可见状态，并保留可继续工作的配置和素材。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 用跨页面确认/回执替代固定 250 毫秒 wait；未响应窗口不能造成无解释的误删或永久 block。
- [x] reset 成功路径清空运行时素材缓存、失败预览集合、失败素材集合、预览状态和待处理引用，再验证重新启用不沿用旧 Web 或旧错误。
- [x] IndexedDB 导入失败、移除失败、删除失败和 blocked 状态都有用户可见状态；失败时保留当前素材和配置。
- [x] 清除后的状态、设置、导入数和宿主状态均可观察，Codex 仍能继续工作。
- [x] 不新增第二套配置真源或通用跨页面事务框架。

## Acceptance evidence

- 慢窗口 reset 回归先红后绿。
- reset 后旧 Web 缓存、失败预览和旧运行时素材不复用。
- IndexedDB 失败回归显示状态并保留旧配置。
- 清除成功、重新启用和宿主继续可用均有一条完整用户路径证据。

## Comments

- 2026-11-23 红循环 1：`node --test --test-concurrency=1 --test-name-pattern="reset waits for a slow|reset timeout reports" .\launcher\static-background.test.mjs`，0/2 通过，约 6.1 秒。慢页面用例失败于 `peerAcknowledged=false`；超时用例在约 283ms 完成且 `resetStatus().warning` 为空，证明旧 250ms 等待没有回执或未响应计数。
- 2026-11-23 绿循环 1：同一命令 2/2 通过，约 4.4 秒。450ms 慢页面回执后才删除 IndexedDB；2 秒无回执场景等待默认 1500ms 后继续删除并记录“1 个窗口未响应”。
- 2026-11-23 红循环 2：临时关闭 reset 成功路径的 `clearCachedAssets` 后运行 `--test-name-pattern="reset clears runtime assets"`，测试失败；旧 `failedPreviewIds` 阻止 `preview-failed` 重新请求。
- 2026-11-23 绿循环 2：恢复 `cancelRuntimeWork(true)` 后同一测试通过，约 3.6 秒。旧 Web 不再生成 iframe，失败素材卡片不再显示旧“加载失败”，待处理和失败预览均重新请求。
- 2026-11-23 红循环 3：四个 IDB 失败用例先运行，导入、移除、删除分别失败于状态仍为旧画面文本；blocked 既有提示通过。删除失败用有效 `deleteDatabase` 抛错注入单独复现，测试在约 3.2 秒失败于未出现“清除失败”。
- 2026-11-23 绿循环 3：四个失败用例 4/4 通过，约 6.1 秒；最终 reset/失败定向回归 9/9 通过，约 17.4 秒。导入、移除和删除失败均显示状态，当前素材、config、导入数和 `hostReady` 保留；blocked 显示“清除受阻”并保留配置。
- 清除完整路径保留 `complete reset keeps the real host ready for reenable and workshop File delivery`，并新增 reset 后 `enable(false)` 可用、controls 仍可建立和宿主继续工作的断言。
- `pnpm.cmd test` 最终 82/82 通过，耗时约 115.9 秒。较早全量运行出现过既有 Edge/CDP timing 抖动，失败用例单独复跑通过；最终完整重跑无失败。
- `node --check` 对两个改动文件通过，`git diff --check` 通过。Prettier 对两个整文件的基线版本本身即不通过，按 spec 未对全文件批量重排。
- 未验证：真实 Codex 页面中的多窗口 reset 回执、真实退出/重开、用户视觉确认和长期稳定性。自动化使用真实 headless Edge、真实 BroadcastChannel 与真实 IndexedDB，但不替代真实 Codex E2E。
