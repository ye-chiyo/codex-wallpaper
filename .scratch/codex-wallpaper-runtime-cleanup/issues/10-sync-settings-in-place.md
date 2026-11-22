# 10 复用设置控件同步与一次最终保存

Status: ready-for-agent
Type: task
Blocked by: [09 收敛卡片查找与可见预览更新](./09-update-cards-and-previews-in-place.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 用现有设置和媒体能力同步减少纯状态变化后的控件重建。保留现有格式、验证、预设、跨窗口合并和各自的持久化时机。

## 验收标准

- [ ] 打开、编辑、关闭、重开保留最终值。连续滑杆预览按现有要求合并保存；有待保存字段时执行停用，只写入一次含最终字段和停用状态的配置。
- [ ] 跨窗口修改仍合并当前待保存字段；普通设置变更保留当前画面和卡片节点，真实活动素材变更仍切换。场景专属能力和控件继续准确显示。
- [ ] 设置导入导出、旧格式迁移、预设及分组重置通过已有用例。完整清除流程继续满足 05 的边界。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 --test-name-pattern='continuous slider|cross-window|settings presets|playback profiles|appearance controls|scene fit|opening and closing|static background is single' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
