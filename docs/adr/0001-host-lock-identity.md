# 0001 宿主锁使用 PID 与进程创建时间共同判定

状态：已接受（2026-11-23）

## 背景

宿主锁原先只保存 PID。宿主异常退出后，Windows 可能把同一 PID 分配给新进程，
使旧锁看起来仍然有效并长期阻止专用启动。PowerShell 与 Node 也曾各自实现判定，
容易出现一侧复用、另一侧恢复的不一致结果。

## 决定

采用方案 A。锁文件改为带版本的 JSON：

```json
{
  "version": 1,
  "pid": 12345,
  "createdAt": "2026-11-23T02:03:04.5678901Z",
  "port": 54321
}
```

- `createdAt` 是锁所属宿主进程的创建时间，不是文件写入时间。
- 只有版本、端口和字段结构有效，PID 仍存在，且当前进程创建时间与
  `createdAt` 完全一致时，锁才判定为有效宿主。
- 锁缺失、JSON 或字段损坏、PID 不存在、创建时间不一致均为可恢复状态。
  启动方可以删除旧锁并原子创建新锁；进程存在但创建时间不可读取时失败关闭，
  不启动第二个宿主。
- `launcher/host-lock.mjs` 是唯一判定模块。Node 直接导入；PowerShell 通过
  `node launcher/host-lock.mjs check --port N` 调用同一实现并读取 JSON 结论。

## 结果

- PID 复用不再永久阻塞启动，锁内容也可直接诊断。
- 旧格式纯 PID 锁会被视为损坏并按可恢复路径清理，不保留第二套兼容判定。
- PowerShell 检查增加一次 Node 子进程调用；这是保持单一判定来源的明确代价。

## 参考

- 任务：`.scratch/codex-wallpaper-release-readiness/issues/06-host-lock-identity-pid-reuse.md`
- 规格：`.scratch/codex-wallpaper-release-readiness/spec.md`
