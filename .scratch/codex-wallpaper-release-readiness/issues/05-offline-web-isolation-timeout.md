# 05: 离线 Web 隔离与加载超时

**What to build:** 让离线 Web 在真实 `iframe`/`srcdoc` 中保持“不执行脚本、不加载外链、失败可降级”。如果 iframe 永不触发 load，页面必须在有限时间内显示作者预览或静态降级，而不是永久停留在加载状态；旧画面和宿主操作不能被破坏。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 真实 iframe 中测试内联脚本、内联事件处理器和外部网络请求均不能执行或访问。
- [x] 为 iframe load 增加有限超时；超时后显示作者预览或静态降级，并保留旧画面。
- [x] Web 替换失败、取消和停用时释放 iframe，不保留重复 DOM、监听器或挂载根。
- [x] 复用现有 Web 沙箱和媒体提交路径，不新增万能网络隔离框架。
- [x] 现有 Web 预览降级和真实 iframe 用例继续通过。

## Acceptance evidence

- 真实 iframe 回归证明脚本未执行、外链未发生、超时进入 fallback。
- 失败、取消、停用后 iframe 和活动资源被清理。
- 旧画面保留或状态明确，不出现永久“加载中”。

## Comments

- 2026-11-23 决策：`launcher/client-runtime.mjs:2111` 的 iframe sandbox 从 `allow-scripts` 收紧为空 sandbox（`sandbox=""`），脚本、内联事件处理器、表单和同源访问全部禁止；CSP 的 `script-src 'none'` 与 `default-src 'none'` 保留为第二道防线。两处旧断言 `launcher/static-background.test.mjs:7655` 和 `:8579` 同步改为 `sandbox: ""`。
- 2026-11-23 红循环（隔离）：临时把 sandbox 改回 `allow-scripts` 并把 CSP 改为 `script-src 'unsafe-inline'`，运行 `node --test --test-concurrency=1 --test-name-pattern="offline Web blocks" launcher/static-background.test.mjs`，1 失败、约 4.1 秒。实际收到 `messages=[{data:"script-ran"},{data:"inline-load"}]`，证明用例能抓到真实脚本执行，而不是只比对固定字符串。
- 2026-11-23 绿循环（隔离）：恢复 `sandbox=""` 与 `script-src 'none'` 后，`messages=[]`，fixture 请求记录中没有 `/web-leak`（断言在 `:7659-7663`），说明内联脚本、内联事件处理器和外部请求均未发生。
- 2026-11-23 超时与清理：`showWeb` 在 `:2145` 设置 2000ms 超时；超时调用 `recoverFailedMedia(message, entry.previewDataUrl)`，保留旧画面并显示“Web 加载超时…保留当前画面”。`trackPending` 清理在 `:2114-2118` 清除 timeout、`onload`、`onerror` 并移除 staged 节点；用例断言超时后 `iframeCount=0`、`.media.staged=0`、`playerCount=0`、旧图片仍是同一节点。
- 2026-11-23 测试边界：超时用例通过改写 `HTMLIFrameElement.prototype.onload`（`:7601-7609`）让回调不触发，属于受控的浏览器 API 替身，不是真实挂起网络请求；它证明超时分支和清理路径，不证明真实 CDN 或本机服务永久挂起。真实挂起请求场景仍属未验证。
- 2026-11-23 组合回归：`--test-name-pattern="committed video degrades|offline Web blocks|real WebWallGL renders"` 3/3 通过，约 12.4 秒；全量 `pnpm.cmd test` 94/94、0 跳过，约 146.3 秒。
- 未验证：真实 Codex 页面内的 Web iframe 超时、CDP Network 级的真实外链拦截证据、真实挂起服务、长期运行。
