# 09: 最终候选真实 Codex E2E

**What to build:** 在最终集成 SHA 上由用户控制真实 Codex 实例，完成一次从专用入口冷启动到主界面壁纸、素材、设置、快捷键、停用恢复和双确认清理的完整验收。自动测试、headless Edge、fake CDP 和只读状态查询都不能替代本 ticket。

**Blocked by:** 08

**Status:** ready-for-human

**Human action:** 保存工作并完全退出当前 Codex；agent 不关闭、不重启、不连接当前实例。用户完成后提交脱敏回执和结果摘要。

- [x] 确认最终集成 SHA，并从专用入口完成真实冷启动；记录包版本、回执和候选运行时/样式身份。
- [x] 确认只有一层主界面壁纸、一个控制根和一份适配样式；重复启动复用实例，不新增宿主。
- [x] 在真实 Codex 中验证图片、视频、代表性 Scene 和离线 Web；记录原生渲染、预览降级或不支持的实际结果。
- [x] 验证 `Alt+Shift+S`、`Alt+Shift+W`、输入/滚动/点击、不可见暂停，以及设置和素材恢复。
- [x] 使用界面两次确认清除页内数据，确认壁纸层、控制层、导入素材和设置状态被清除；Codex 仍可用。
- [x] 正常退出后从原入口恢复，确认原账号、已有聊天和原界面正常；清理与退出只由用户安排。
- [x] 保存脱敏的 `Outcome`、`hostReady`、`state`、`TargetVerified`、运行时哈希、候选 SHA 和未完成场景；不提交聊天正文、账号信息或不必要路径。

## Acceptance evidence

- 最终 SHA 和真实启动回执。
- 用户可见的主界面壁纸、素材、快捷键、停用恢复、不可见暂停和清理结果。
- 单实例、单壁纸层、单宿主证据。
- 未完成或降级的真实场景明确列出；视觉审美仅由用户确认。

## Comments

- 2026-11-25：用户在真实 Codex 上按 `.scratch/codex-wallpaper-release-readiness/manual-e2e-checklist.md` 完成人工验收并确认全部通过。受测候选代码 SHA 为 `ca0624351b721023313d30823d6a2add945ad4cf`；该 SHA 上 `pnpm.cmd test:full` 已通过（Node 94/94，四个 PowerShell 套件全绿，182.9 秒）。
- 验收范围：专用入口冷启动、单壁纸层与单控制根、重复启动复用、图片/视频/Scene/离线 Web、`Alt+Shift+S`、`Alt+Shift+W`、输入与滚动、不可见暂停、设置和素材恢复、停用恢复、双确认清除、退出重开。
- 记录边界：详细脱敏回执（`Outcome`、`hostReady`、`state`、`TargetVerified`、运行时哈希、样式哈希）由用户保留在本地，未回传到仓库；agent 未读取回执、未操作真实 Codex、未做视觉判断。登录启动、长期稳定性和真实第二主窗口不在本次验收范围。
