# 03 隔离迟到的 File 结果并守住首帧交接

Status: ready-for-agent
Type: task
Blocked by: [02 限制 MP4 布局解析并验证原 File 回退](./02-bound-mp4-layout.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 在现有选择代次、File token 和宿主请求交接中修复旧结果回写。扩展现有取消、重选和首帧用例；等待超时仅在确认真实交付挂起路径后纳入。

## 验收标准

- [ ] 在 A→B→C、A→B→A 中让旧请求的成功、取消或失败晚于新请求到达。仅最后一次选择能提交或写出对应错误，旧请求不清除新请求状态、不触发完整 Base64。
- [ ] File 交付仍使用有效 objectId，保留失败时释放引用、小文件兼容回退和大文件禁止完整 Base64。停用清除待处理 File 输入，迟到结果无法复活画面。
- [ ] 首帧早到且数据不足时保留同一旧节点，后续有效帧才提交，新节点离开暂存层。中途取消和隐藏后恢复经过现有浏览器用例覆盖，配置与原画质保持。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/wallpaper-host.test.mjs
node --test --test-concurrency=1 --test-name-pattern='changing selection|retries discarded|reenabling during|disable cancels|failed first video|missing File input|above 512 MiB|static background is single' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
