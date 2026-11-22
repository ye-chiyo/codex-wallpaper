# 01 修复冷启动目标切换后的监督握手

Status: ready-for-agent
Type: task
Blocked by: 无

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 在现有 PowerShell 与 Node 握手、精确 CDP 目标发现和宿主挂载内处理 `verified` 后的瞬时目标丢失。沿用 25 秒启动总时限和原有回滚。
- 先记录现有夹具捕获到的失败，再完成本批修复。复用现有宿主协议夹具，对照 [启动与 File 交付任务](../../codex-wallpaper-media-startup-performance/issues/01-file-backed-media-and-startup-supervisor.md) 的真实失败记录。

## 验收标准

- [ ] 既有精确主目标在 `verified` 后断开，新精确主目标出现。入口与监督进程重新核验包、主进程、日常 profile、监听归属、目标和 frame 来源，最终只保留一个宿主，并交付首个工坊素材。
- [ ] 旧会话的连接、锁和本次部分挂载已回收。父端取消、复核拒绝、启动时限耗尽分别终止为明确阶段，保留原界面，不写成功标记。
- [ ] 成功回执记录已核验目标及宿主就绪，成功标记仅在保留阶段写入。现有版本不匹配、非主界面和重复实例保护继续通过。夹具结果用作本批验收，真实冷启动留给 12。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/read-only-probe.test.mjs launcher/wallpaper-host.test.mjs
node --test --test-concurrency=1 --test-name-pattern='supervisor|PowerShell|startup' launcher/static-background.test.mjs
powershell.exe -NoProfile -File ./launcher/profile-preflight.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-roots.test.ps1
powershell.exe -NoProfile -File ./launcher/startup-entry.test.ps1
node --test .scratch/codex-wallpaper-performance-settings/baseline-probe.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
