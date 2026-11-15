# 05: 完成统一候选业务链路验收

**What to build:** 对完成上述修复的同一候选版本执行完整业务闭环和交付审查：登录 Windows 后自动进入专用 Codex，打开已有聊天，选择素材并调整设置，在聊天与变更页之间切换，使用按钮和快捷键停用、恢复，退出重开后恢复上次状态，最后完成代码质量与视觉验收。

**Blocked by:** 01 · 适配当前 Codex 更新并恢复壁纸；02 · 登录 Windows 后自动进入专用 Codex 并恢复壁纸；03 · 聊天与变更页保持同一壁纸；04 · 输入区底衬与界面组件视觉收口。

**Status:** ready-for-human

- [x] 自动测试覆盖当前版本启动、页面承载、素材切换、输入区层级、启停恢复和启动失败边界；每个保留测试都能对应本次已复现问题或必要协议边界。
- [x] 完整 fixture 链路按“注入 → 选择已知素材 → 调整设置 → 打开真实结构 Changes 侧栏 → 返回 → 按钮停用 → 快捷键恢复”执行，验证已知画面、保存设置、单个背景根层、控制根层、样式根层和播放器资源计数。
- [ ] 真实候选完成一次重启或注销重登、已有聊天、四类代表素材、明暗主题、输入与工具卡片、聊天与变更页连续切换以及停用恢复。
- [ ] 交付前亲自完成截图或录屏视觉检查；源码、自动测试、候选部署和真实运行结果分别记录，不把测试通过等同于真实业务跑通。
- [ ] 代码审查确认没有为两个页面复制播放器、素材协议或配置状态；共享能力优先复用现有运行时、页面注入、素材请求和配置读取。
- [ ] 代码审查确认没有无限重试、平行守护进程、只为形式化增加的转发层或近期需求无法证明价值的抽象。
- [x] 测试审查保留计算样式、命中测试、公开运行时状态和宿主协议断言；不按完整生产 CSS 文本、私有变量或内部调用次数判定用户结果。fixture 注入点和 Scene/媒体替身用于制造异步、可见性与失败状态，不作为真实宿主通过凭据。
- [x] 检查变更集中没有受保护安装文件、P0 实验目录、聊天正文、账号凭据或不相关内容；P0 实验目录继续保持未跟踪且不提交。
- [x] 完成完整 Node 测试、PowerShell 启动器检查、Prettier 和 `git diff --check`：Node 11/11、profile-preflight 11/11、startup-roots 3/3、startup-entry 通过、格式与 diff 检查通过。
- [ ] 双轴代码审查由主集成流程执行；本工作树不预先宣称审查通过。
- [x] 最终记录继续明确：原入口自动接入未完成，联网 Web 隔离未证明，8 小时基础验收和 7 天日常观察尚未完成。

## Automated evidence

| Suite                                                                            | Regression or protocol covered                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read-only-probe.test.mjs`                                                       | Exact `app://-/index.html` selection, loopback endpoint ownership, query-routed/auxiliary rejection, `Page.getFrameTree`-only preflight and fail-closed origin checks (01).                                                                        |
| `profile-preflight.test.ps1`, `startup-roots.test.ps1`, `startup-entry.test.ps1` | Expected package/version/daily profile, transient/ambiguous roots, receipt reuse identity, and idempotent ownership-safe per-user Startup entry (01–02).                                                                                           |
| `wallpaper-library.test.mjs`                                                     | Four WE classifications, path privacy, preview/media budgets, scene asset preparation and offline Web isolation boundary.                                                                                                                          |
| `wallpaper-host.test.mjs`                                                        | No reachable CDP and Runtime initialization failure both close sockets and release the host lock.                                                                                                                                                  |
| `static-background.test.mjs`                                                     | Single-folder injection/uninstall, selected asset continuity, settings, real-anchor Changes visibility, composer/tool interaction and visibility, button/hotkey recovery, LoadImage/storage cleanup, and on-demand asset/preview/player lifecycle. |

The browser fixture and the real after-login media-host bind are separate evidence layers. The CLI starts `wallpaper-host` for every explicit enable request, including a persisted-disabled start, so a later hotkey has the binding path for on-demand material; no production page override or detached URL allowlist was added. This host-start condition and the fixture visual/result remain automation evidence only. Real host binding, detached page identity, account/chat continuity and reboot behavior remain user gates.

## Evidence boundary

- Fixture evidence: current headless Edge path above; it cannot prove real Codex host binding or detached target identity.
- Historic visual corroboration: sanitized review-sidebar and composer crops/recording retained outside the repository; they show the earlier regression but are not fresh candidate acceptance.
- Candidate available locally: source, runtime and tests exist in this isolated worktree; no candidate was activated against the user's running Codex.
- Unresolved 03 gate: packaged source and historic frames support the review-sidebar fixture, but no fresh live evidence identifies the Changes page as the broad browser `detached-window` target. Do not allowlist it or record that gate as passed.
- Real user gates: existing chat/account, four material types, themes and interactions, 10 Changes switches, disable/hotkey recovery, persisted-disabled on-demand recovery, logout/reboot, receipt identity, original-entry bounds, 8 hours and 7 days remain unverified.

## Comments

- 2026-11-15 Standards disposition: Startup switches now run as public launcher processes against a temporary copy whose sole substitution is the pre-existing OS Startup-folder lookup; the real folder and registry are untouched. Set/status/remove share the same description-based ownership result, and failed enable preserves foreign shortcut bytes. The inline marker guard now requires an immediately captured zero Node exit code plus `Wallpaper.state` of `enabled` or `disabled`, and the unattended receipt retains `Mode`; the unused marker `Version` is removed. The public launcher/protocol fixtures cover the boundary without a test-only wrapper; writing the full success marker after a real wallpaper injection remains a live gate.
- 2026-11-15 Standards disposition: the persisted-disabled static-background CLI path now runs against an exact-target mocked protocol while starting the real `wallpaper-host` dispatch, and the browser fixture re-enables a selected on-demand workshop asset, observes its load request, shows preview, and applies the delivered image. The footer rule preserves the proven transparency correction and excludes the installed-source `[data-pip-obstacle='thread-footer-leading']` branch with adjacent readability coverage. Issue 01 and 02 dated progress now sits under each ticket’s trailing `## Comments`; issue and README cleanup are included in this correction.
- 2026-11-15 Spec disposition: the two P1 live gates remain pending exactly as reported: detached Changes page identity is not allowed by static or historic evidence, and real restart/login, account/chat, visual, hotkey, and receipt acceptance has not run. The P2 same-name shortcut ownership issue is corrected and covered through public Startup behavior. Persisted-disabled on-demand re-enable is covered in the existing browser fixture, while the real host bind and real workshop-material request remain part of the pending live gate. No real Codex launch/attach/restart, live Startup registration, or P0 path access was performed.
