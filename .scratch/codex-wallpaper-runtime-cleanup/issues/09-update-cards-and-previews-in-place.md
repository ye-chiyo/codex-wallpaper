# 09 收敛卡片查找与可见预览更新

Status: ready-for-agent
Type: task
Blocked by: [08 合并 File 与 Base64 成功后的素材登记](./08-share-asset-completion.md)

依据 [主规范](../spec.md)。依赖完成后才进入本批，保持现有工作树、用户文件和证据。

## 范围

- 让单项卡片查找与预览回填复用现有查找函数，查单项时按 kind 读取已有目录。可见预览路径只有在已有夹具证明各触发等价后才合并。

## 验收标准

- [ ] 首次打开前完整卡片为 0，首次打开完整可用，关闭重开保留卡片节点；点击和轮播仅更新相关状态。
- [ ] 首次打开、筛选、切回壁纸库、滚动均可请求并显示可见预览。失败预览显示可用占位，筛选和预览不会重载实际当前画面。
- [ ] 悬停和仅按下均无主视频 File 交付、解码或候选播放器。已有收藏、轮播和导入素材卡片仍可操作。

## 验证命令

从项目根目录执行。先运行定向用例，再运行完整 Node 套件，记录退出状态与原始输出。

```powershell
node --test --test-concurrency=1 --test-name-pattern='opening and closing the mounted panel|library shell|video card waits|rotation requests|cross-window settings' launcher/static-background.test.mjs
pnpm test
```

本批用隔离夹具验证。真实入口、实际画面与性能状态由 [12 实机验收](./12-verify-same-candidate-live.md) 记录。

## Comments
