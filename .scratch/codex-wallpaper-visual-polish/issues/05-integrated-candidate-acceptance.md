# 05: 同一候选的整体验收

**What to build:** 在实际加载的同一候选上汇总视觉、操作和切换证据，交由用户确认。沿用已确认的两层测试边界：现有行为夹具和真实 Codex 验收。

**Blocked by:** 02 · 聊天读底、工具与输入；03 · 文件与「变更」面板连续显示；04 · 壁纸控件与启停恢复。

**Status:** ready-for-human

- [ ] 在获准后的验收中核对专用实例的 Codex 版本、主界面目标和实际生效的候选版本；如需冷启动，由用户通过专用入口手动执行。临时样式、旧回执和工作树版本不代替实际加载。
- [ ] 用明亮、深色且涵盖细节复杂的代表性壁纸，覆盖明暗主题、常规与较窄窗口以及侧栏和右侧面板开合，亲自检查当前脱敏截图。记录可读性、壁纸清晰度、接缝、裁切、遮挡和未覆盖组合。
- [ ] 在同一候选中以真实操作确认顶部与窗口控制、输入及滚动、面板开合、素材切换和快捷键启停；不发送聊天、提交外部操作或关闭有未保存内容的标签。
- [ ] 用真实界面完成至少十轮「聊天 → 变更 → 返回」并亲自复看录屏，检查黑闪、亮暗跳变、默认背景或旧画面闪入及布局跳动。仅开合摘要面板不计轮次，静态截图或 DOM 计数不能代替录屏。
- [ ] 交付同版候选的脱敏证据和已知限制；分别记录源码实现、自动回归、实际加载、真实视觉、端到端与用户确认。无证据的项保持待验，长期稳定性仍独立跟踪。

## Comments

- 2026-11-16 初查：已核对专用会话标记、MSIX 26.1111.2228.0、日常 profile、环回监听归属和唯一精确主页面。旧运行时已启用，深色主题标题栏仍为 fixed。实际 CSS 与 a443f49 相同长度，只有两行不同：把 z-index: 1 移入标题栏排除分支；与本轮集成草稿不匹配。未改变页面、设置或素材。登录启动查询为 disabled。
- 2026-11-16 基线：现有 12 项 Node 测试通过，三个 PowerShell 测试文件通过。最终证据仍需重跑同一集成候选，不勾选真实门槛。
- 2026-11-16 11:45（Asia/Shanghai），源码/自动验收候选已固定为 `codex/wallpaper-visual-05` 的 `b27e257ef024f4e6a33e7e685c67132cc17467a8`。最终运行时为 `launcher/client-runtime.mjs`（blob `dc03fc30aaeeb832b5f15ccd118e724d6ec2f7c8`），共享夹具为 `launcher/static-background.test.mjs`（blob `f3eac271e59ee81439d407a4b5bc4efbad5117ab`）。`npm test` 12/12 通过；Windows PowerShell 分别执行 `profile-preflight.test.ps1`、`startup-entry.test.ps1`、`startup-roots.test.ps1` 均退出 0，覆盖 11、1、3 个通过场景；`git diff --check a443f49...HEAD` 通过。Prettier 3.9.10 检查上述两个代码文件和 `codex-wallpaper-visual-polish` 特性 Markdown（共 8 个文件）时，因该 Windows 检出使用 CRLF，默认 LF 检查会报告行尾差异；使用同一主工作树 `D:\AI\壁纸\node_modules\.bin\prettier.cmd` 加 `--check --end-of-line auto` 后全部通过。
- 2026-11-16 限制：本轮仅完成上述源码与自动夹具验收，独立审查仍针对 `b27e257`。未启动、读取或操作真实 Codex，未退出任何应用进程，未截图/录屏，未读取或修改真实页面、素材、配置、回执或 Startup；因此实际版本/主界面身份、候选实际生效、真实鼠标与键盘、明暗主题及多壁纸视觉、侧栏开合、十轮聊天/变更切换、快捷键启停恢复和用户确认均保持待验。若 `b27e257` 代码发生变化，本结论失效，需按本单重跑适用的源码、夹具和 PowerShell 验证。以下五项门禁均不勾选。
- 2026-11-16 用户冷启动：请先保存工作并完全退出 Codex，再在 Windows PowerShell 中从固定 worktree 执行：

  ```powershell
  Set-Location -LiteralPath 'D:\AI\codex-wallpaper-visual-05'
  .\launcher\Codex-Wallpaper.cmd
  ```
