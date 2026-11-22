# 08 合并 File 与 Base64 成功后的素材登记

Status: ready-for-agent
Type: task
Blocked by: [07 合并停用与重置的共用资源清理](./07-share-lifecycle-cleanup.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 复用 `runtimeAssets` 和现有当前选择校验，合并 File、Base64 成功后共同的素材登记、状态更新和交接调用。各自保留大小、取消、对象释放和兼容语义。

## 验收标准

- [ ] 成功 File 表达式被实际解析，选择的输入元素完成 `DOM.setFileInputFiles`，浏览器观察到 Blob 成为当前画面，交接后没有临时输入。
- [ ] 小文件 File 对象缺失仍触发有界兼容回退，大于 512 MiB 的视频禁止完整 Base64，取消不启动回退，且所有旧结果仍遵守 03 的请求隔离。
- [ ] 可合并大文件正反例的夹具准备，各自保留实际 File、错误和回退结果。保留现有 Web 离线、Scene 和预览行为。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/wallpaper-host.test.mjs
node --test --test-concurrency=1 --test-name-pattern='CDP file input|changing selection|retries discarded|missing File input|above 512 MiB|File is unavailable|oversized video|failed first video' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
