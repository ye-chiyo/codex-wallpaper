# 02 限制 MP4 布局解析并验证原 File 回退

Status: ready-for-agent
Type: task
Blocked by: [01 修复冷启动目标切换后的监督握手](./01-recover-startup-handoff.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 收紧现有 `prepareMp4VirtualLayout` 对盒长度、偏移表结构及实际媒体数据范围的检查，并用已有布局和宿主测试验证拒绝后的原 File 路径。保留兼容素材的原有分段结果。

## 验收标准

- [ ] 畸形或不前进的扩展长度、越界偏移和改动涉及的非法 `stco/co64` 表在有限读取内拒绝。覆盖改动涉及的 `co64` 或盒头宽度分支。
- [ ] 普通前置保持原 File，兼容尾置仅移动小型 `moov` 并校正偏移，媒体数据 slice 字节完整。保留 4 MiB `moov`、2 MiB 表总预算及单表 100,000 项上限。
- [ ] 布局被拒绝后，宿主仍使用现有原 File 交付，File 大小与 Base64 上限保持有效。通过协议结果和实际读取边界验证。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/mp4-layout.test.mjs
node --test --test-concurrency=1 --test-name-pattern='CDP file input|above 512 MiB|File is unavailable' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
