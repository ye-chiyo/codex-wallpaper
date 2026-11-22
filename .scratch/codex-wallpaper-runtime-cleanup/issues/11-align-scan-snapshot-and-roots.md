# 11 统一扫描快照、允许根与交付复核

Status: ready-for-agent
Type: task
Blocked by: [10 复用设置控件同步与一次最终保存](./10-sync-settings-in-place.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 复用现有默认项目索引、签名和后台复核。让项目记录和允许根来自同一份扫描结果，核对主素材、预览和离线 Web 的真实路径和实际读取边界。需要更新已挂载目录时复用现有刷新机制。

## 验收标准

- [ ] 普通过期索引仍可先返回，后台复核后按现有语义更新项目和元数据。目录删除、根目录变更、复核失败和部分显式根参数的结果可观察，根目录与返回项目一致。
- [ ] 复核跨越删除或换根时，旧的目录元数据可以短暂存在，实际旧文件交付按当前允许根及真实路径、存在性和大小拒绝。已有路径边界与 2 MiB 预览、512 MiB Base64、1 GiB 视频 File 上限保留。
- [ ] 如触及页面目录刷新，已可用的材料选择、待保存字段和当前画面维持既有行为。跨快照竞态通过扩展现有素材库用例验证，无独立缓存框架。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 launcher/wallpaper-library.test.mjs launcher/wallpaper-host.test.mjs
node --test --test-concurrency=1 --test-name-pattern='library shell|cross-window settings|above 512 MiB|File is unavailable' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
