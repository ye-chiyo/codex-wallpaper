# 02: 单主窗口边界与歧义回归

**What to build:** 把当前发布候选明确收敛为一个经过验证的 Codex 主窗口。精确主页面继续通过现有目标核验接入；第二个同 URL 主页面必须失败关闭，而不是被误当成可并行的壁纸目标。同源设置事件只说明已注入页面之间的配置同步，不承诺第二个主窗口自动出现壁纸。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 用户文档、候选记录和架构说明明确写明当前只支持一个已验证主窗口。
- [x] 只接受精确的 `app://-/index.html` 主页面；查询路由辅助页、任意 `app://` 页面和错误 WebSocket 端点继续被拒绝。
- [x] 两个精确主页面存在时返回可诊断的 ambiguous/失败关闭结果；监督器不注入壁纸、不挂载宿主、不创建第二个运行时。
- [x] 隐藏 iframe 的 `storage` 回归保留为设置事件测试，但名称和证据不得声称它验证了真实跨窗口壁纸。
- [x] 若非单主窗口支持是后续独立需求，另立任务，不在本 ticket 中扩展注入范围。

## Acceptance evidence

- 只读目标选择、唯一性、origin、查询路由和 WebSocket 回归通过。
- 双精确 target 的失败关闭测试有明确输出，没有新增宿主锁或壁纸层。
- 文档和验收记录不再声称当前候选已完成真实多窗口壁纸。

## Comments

- 2026-11-23：红循环新增监督器双精确 target 夹具，要求输出 `ambiguous-main-page`、零页面会话、零宿主连接和不存在宿主锁。旧实现返回泛化的 `main-page-unavailable`，测试按预期失败。
- 2026-11-23：绿循环让 `read-only-probe.mjs` 给重复精确主页面错误附加 `ambiguous-main-page` code，监督器在握手阶段映射为同名诊断后失败关闭。
- `node --test --test-concurrency=1 .\launcher\read-only-probe.test.mjs`：7/7 通过；覆盖重复精确主页、查询路由、非 Codex origin、错误 WebSocket 端点，以及双主页面在协议访问前失败。
- `node --test --test-concurrency=1 --test-name-pattern="ambiguous main-page|same-origin storage event" .\launcher\static-background.test.mjs`：3/3 通过。双精确 target 未建立页面会话或宿主连接；两个隐藏 iframe 用例只验证同源 storage 设置事件。
- `pnpm.cmd test`：75/75 通过。四个 PowerShell 启动器套件也全部通过。
- 三语 README、启动器说明、候选记录、发布说明和架构文档已统一为“单主窗口、双精确 target 失败关闭、storage 仅同步已注入页面设置”。真实第二窗口自动注入明确留给独立任务。
- 未验证：真实 Codex 上的第二主窗口行为不在本 ticket 范围；真实 E2E、登录启动和视觉确认仍未完成。
