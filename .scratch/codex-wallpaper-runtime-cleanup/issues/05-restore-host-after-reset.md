# 05 完整重置后恢复可用的工坊素材宿主

Status: ready-for-agent
Type: task
Blocked by: [04 补齐 Scene 的 Blob 与渲染器释放](./04-release-scene-blob.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 修复完整重置后仍可启用但工坊素材请求失去宿主的问题。使用隔离配置和导入素材，保留普通停用与完整重置各自的语义。

## 验收标准

- [ ] 双确认后按现有范围清除导入数据和设置，跨窗口完成协调，以停用的默认状态收尾。失败路径保留明确提示并避免宣称已经清除。
- [ ] 随后通过已有热键重新启用并选择工坊素材，完成真实宿主协议下的 File 交付及页面提交。已失去宿主的实例不会被入口报告为已就绪的复用实例。
- [ ] 普通停用再启用仍恢复原选择和设置。把原先只检查绑定调用的持久化停用用例改为验证 disabled → 热键启用 → 工坊 File，保留旧诊断 CLI 接线的可观察结果。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 --test-name-pattern='persisted-disabled|static background is single|settings presets|browser startup|startup rolls back' launcher/static-background.test.mjs
node --test --test-concurrency=1 launcher/wallpaper-host.test.mjs
powershell.exe -NoProfile -File ./launcher/profile-preflight.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-roots.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-entry.test.ps1
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
