# 08: 统一 Node + PowerShell 测试门禁

**What to build:** 提供一个明确的聚合测试入口，按 Windows CI 的顺序实际运行 Node 全量套件和四个 PowerShell 启动器套件。开发者不能只运行 Node 就误以为启动器边界已经验证；Edge、`ffmpeg.exe` 和 COM 的条件跳过必须可见，且不能计为通过。

**Blocked by:** 01, 02, 03, 04, 05, 06, 07

**Status:** ready-for-agent

- [x] 增加聚合测试入口，实际运行 Node 全量测试和四个 PowerShell 启动器套件。
- [x] 保留 Node-only 入口的兼容性，并让 README/发布检查指向完整入口。
- [x] Edge 路径、`ffmpeg.exe`、PowerShell COM 缺失时显式输出跳过/阻塞，不把跳过当成通过。
- [x] 聚合入口返回正确 exit code，失败时能定位到具体套件。
- [x] 当前变更文件通过 Prettier，`git diff --check` 通过；不批量改写无关历史文件。

## Acceptance evidence

- 聚合入口和单独 Node/PowerShell 入口各有一次成功运行。
- 输出包含 Node 与四个 PowerShell 套件的实际结果。
- 条件依赖缺失时有明确跳过/阻塞文本。
- 完整门禁在最终集成 SHA 上通过，测试结束后工作区没有意外生成文件。

## Comments

- 2026-11-23 入口实现：`package.json` 新增 `test:full: node launcher/run-full-tests.mjs`；`launcher/run-full-tests.mjs` 串行运行 `pnpm.cmd test` 加 `desktop-entry`、`profile-preflight`、`startup-entry`、`startup-roots` 四个套件，逐项打印 `PASS/FAIL`、耗时与 exit code，并输出总计耗时。
- 2026-11-23 红循环 1：实现前运行 `pnpm.cmd test:full`，得到 `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "test:full" not found`，exit 1。证明旧仓库没有聚合入口。
- 2026-11-23 红循环 2：把聚合套件临时替换为 `cmd.exe /d /s /c exit 3`，运行 `node launcher/run-full-tests.mjs`，输出 `FAIL failure-path-probe 0.0s - exit 3`、`Full test gate failed: failure-path-probe`，exit 1。证明失败会点名具体套件并返回非零。
- 2026-11-23 绿循环：`pnpm.cmd test:full` exit 0，总计 188.1 秒（外层 189.3 秒）。依赖探测：Edge `OK`、`ffmpeg OK - native startup preview enabled`、PowerShell COM `OK`。套件结果：Node 142.2 秒、94/94 通过、0 跳过；desktop-entry 11.2 秒；profile-preflight 23.1 秒；startup-entry 5.5 秒；startup-roots 6.0 秒。
- 2026-11-23 条件依赖语义：Edge 缺失时输出 `BLOCKED` 并 exit 2，不运行任何套件；`ffmpeg` 缺失时输出 `SKIP` 并继续，原生启动预览回退静态帧；PowerShell COM 不可用时输出 `SKIP` 并继续，由启动器套件报告自身结果。本机三项均可用，因此 `BLOCKED`/`SKIP` 分支只做了代码级检查，未实际触发。
- 2026-11-23 入口文档：`README.md`、`README.en.md`、`README.ja.md` 第 102 行均改为 `pnpm.cmd test:full`，并注明 `pnpm.cmd test` 只覆盖 Node 套件。`.github/workflows/windows-tests.yml` 将原来的 Node 与 PowerShell 两个步骤合并为单个 `pnpm.cmd test:full` 步骤，CI 与本地使用同一入口。
- 2026-11-23 Prettier：`launcher/client-runtime.mjs` 与 `launcher/static-background.test.mjs` 已在 T03 提交时由 pre-commit 的 Prettier 统一格式化；当前两文件、`launcher/run-full-tests.mjs`、`package.json`、三份 README 和 workflow 均通过 `prettier --check`。格式化集中在本次变更文件，没有批量改写无关历史文件。
- 2026-11-23 未验证：workflow 尚未推送，GitHub `windows-latest` 上的新聚合入口没有运行记录；条件依赖缺失分支未在本机实际触发；最终集成 SHA 上的门禁结果见提交后的复跑记录。
