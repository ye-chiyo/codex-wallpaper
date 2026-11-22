# 07 合并停用与重置的共用资源清理

Status: ready-for-agent
Type: task
Blocked by: [06 删除已证实无用途的运行时代码](./06-remove-dead-runtime-code.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 仅合并停用与完整重置共有的待交付取消、播放器和 URL 释放、计时器、观察器及数据库句柄清理。保留独立的配置、持久化与重置协调。

## 验收标准

- [ ] 普通停用清除播放器、根层、临时 File 输入和待交付，重新启用恢复原选择和配置；跨窗口重置仍按原范围清理并可继续使用工坊。
- [ ] 重复停用、加载中停用、失败回滚及切走 Scene 复用同一资源清理结果，迟到事件无法复活。保留首帧前旧画面、轮播暂停和兼容回退。
- [ ] 停用与重置的公共步骤有两个真实调用点，各自保留的差异在批次报告中可追溯。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 --test-name-pattern='disable cancels|changing selection|reenabling during|browser startup|scene fit|static background is single|settings presets' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
