# 04 补齐 Scene 的 Blob 与渲染器释放

Status: ready-for-agent
Type: task
Blocked by: [03 隔离迟到的 File 结果并守住首帧交接](./03-isolate-late-file-results.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 把 Scene 的候选及当前 Blob URL 接回现有交接和释放流程。在现有浏览器生命周期用例中观察资源取得、提交与释放。

## 验收标准

- [ ] 切走已提交的 Scene、取消尚未交接的 Scene、加载失败、停用及重置均能释放对应 URL 和渲染器；仍在显示的旧 Scene 资源保留到有效交接结束。
- [ ] Scene 原生渲染、画面适配、隐藏暂停和恢复继续工作。加载失败保留旧画面，无旧画面时仍使用作者预览或内置背景。
- [ ] 多次放弃或重选后，已经退休的 Blob URL 与渲染器无法再被使用，且没有残留暂存节点或晚到的提交。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 --test-name-pattern='scene fit|playback profiles|wallpaper library shell|disable cancels|static background is single' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
