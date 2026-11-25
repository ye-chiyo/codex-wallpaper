# 01: 统一 Codex 版本支持契约

**What to build:** 让用户看到的兼容性说明与启动器实际行为一致：已登记精确版本走快速路径，可信未登记版本进入主界面探测，未知或身份异常版本保持原界面。当前候选需要明确覆盖 `OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0`，不能继续只在内部文档中承认它。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] 明确并记录唯一兼容策略，区分精确哈希快速路径和可信未登记版本探测，不允许用文档扩大或缩小实际核验范围。
- [x] 将当前已登记的 `26.1117.4957.0` 包和对应可执行文件摘要同步到用户文档、候选记录和发布说明；历史快照继续标为历史，不迁移成当前 HEAD 的真实 E2E。
- [x] 启动器预检覆盖 4957、可信未登记、摘要漂移、未注册应用、错误签名、profile 缺失和多主进程等失败边界。
- [x] 用只读状态查询证明当前安装的 4957 被识别为已知兼容模式；不连接、不启动、不注入当前实例。
- [x] 验收记录明确写出“版本契约通过不等于真实 Codex E2E 通过”。

## Acceptance evidence

- 4957 的只读状态查询输出。
- 启动器预检全部通过，且输出包含上述兼容与拒绝 case。
- 文档检索不再存在与实际支持范围冲突的用户指引。
- 变更文档通过格式检查；不修改无关历史记录。

## Comments

- 2026-11-23：红循环将 `profile-preflight.test.ps1` 的当前夹具切到 4957，并断言已登记包 EXE 摘要漂移必须在接入前拒绝；旧实现进入 `probe`，测试按预期失败。
- 2026-11-23：绿循环在 `Start-CodexWallpaper.ps1` 中区分“已登记摘要不符”和“可信未登记版本”。前者现在返回 `executable-or-app-registration-mismatch` 并保持原界面，后者仍进入兼容探测。
- `powershell.exe -NoProfile -File .\launcher\profile-preflight.test.ps1`：15/15 通过，覆盖 package query failure、4957 known、摘要漂移拒绝、可信未登记 probe、错误签名、错误包身份、应用登记缺失、profile 缺失、多主进程和实例复用。
- `powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1`：只读输出 `Package: OpenAI.Codex_26.1117.4957.0_x64__2p2nqsd0c76g0`、`CompatibilityMode: known`；未启动、关闭、连接或注入 Codex。
- Prettier 对三语 README、启动器说明、候选记录、发布说明和架构文档检查通过；`git diff --check` 通过。
- 未验证：真实 Codex E2E、登录启动、真实主界面冷启动和视觉确认。版本契约通过不等于真实 Codex E2E 通过。
