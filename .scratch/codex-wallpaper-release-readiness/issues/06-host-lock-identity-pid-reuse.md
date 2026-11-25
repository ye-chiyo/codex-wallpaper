# 06: 宿主锁身份与 PID 复用

**What to build:** 让宿主锁的可观察行为与架构和发布说明一致。旧 PID 被其他进程复用或宿主已经退出时，新的专用启动不能被永久误判为“宿主仍在”；如果保留只检查 PID 寿命，则必须明确修正文档和验收声明。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

- [x] 选择并记录宿主锁策略：记录 PID 与进程创建时间并校验二者，或明确改为只检查 PID 寿命。
- [x] 增加 PID 复用、过期锁、无锁启动和正常持锁回归；每个 case 都验证是否允许启动和是否清理锁。
- [x] PowerShell 与 Node 使用同一套可观察判定，避免一侧判定有效、另一侧判定失效。
- [x] 旧宿主退出、端口被其他进程占用和错误锁内容都有可诊断结果。
- [x] 不修改真实 Codex profile、账号或聊天数据。

## Acceptance evidence

- 锁相关回归全部通过。
- 架构/发布说明与实际判定一致。
- 复用和恢复路径没有新增第二个宿主或静默绕过。

## Comments

- 2026-11-23：选择方案 A。`launcher/host-lock.mjs` 是唯一判定模块，锁格式为 `{ version, pid, createdAt, port }`，其中 `createdAt` 是宿主进程创建时间。Node 直接导入，PowerShell 通过 `node launcher/host-lock.mjs check --port N` 读取同一结论。决定记录在 `docs/adr/0001-host-lock-identity.md`。
- 红测：实现前 Node 因缺少 `host-lock.mjs` 失败；`startup-roots` 因仍按纯 PID 读取 JSON 锁，在有效锁处得到 `Expected True; observed False`。
- 绿测：`launcher/host-lock.test.mjs` 7/7，覆盖 PID 复用、过期锁、原宿主退出、无锁启动/释放、正常持锁拒绝第二宿主、损坏锁恢复和端口非 CDP 诊断；`wallpaper-host.test.mjs` 4/4；`startup-roots.test.ps1` 4/4，并逐项比较 PowerShell 与 CLI 的 `held/stale/missing/corrupt` 结论；`profile-preflight.test.ps1` 15/15。
- 完整 `pnpm.cmd test` 91/91，通过、0 失败、0 跳过。`docs/architecture.md`、`launcher/README.md`、发布说明和候选记录已同步。
- 未启动或连接真实 Codex，未读取或修改真实 profile、账号和聊天数据。未在真实 Windows 宿主上复现 PID 复用；独立崩溃恢复仍需人工环境。
