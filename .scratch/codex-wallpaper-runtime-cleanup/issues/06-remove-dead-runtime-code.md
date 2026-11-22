# 06 删除已证实无用途的运行时代码

Status: ready-for-agent
Type: task
Blocked by: [05 完整重置后恢复可用的工坊素材宿主](./05-restore-host-after-reset.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 清理只写未读的旧帧统计和播放对象标记、无提供方的播放回调、入口条件已经排除的普通素材分支，以及虚拟布局重复的索引复制。保留既有探针使用的状态字段。
- 只有仓库与相关调用方均通过公共入口时，才收回实现函数的导出。逐项记录旧场景、调用关系及替代路径。

## 验收标准

- [ ] 每条删除有无调用或不可达的证据。场景对应的现有生命周期、回退和释放路径可定位。
- [ ] 实际首帧交接、旧画面保留、取消、隐藏恢复、原生 Scene、设置、兼容回退及独立诊断入口通过现有回归。
- [ ] 运行时指纹按现有机制生成和验证。保留 `measuredFps` 等探针消费的字段，保留所有旧证据与未跟踪探针。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/static-background.test.mjs launcher/mp4-layout.test.mjs
node --test .scratch/codex-wallpaper-performance-settings/baseline-probe.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
