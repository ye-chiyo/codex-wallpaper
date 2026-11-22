# 01 主界面壁纸点击切换与首帧交接

Status: ready-for-agent
Type: task

按 [方案 A 规格](../spec.md) 实施。先在真实 Codex 定位前置视频的首帧交接失败，再修复交接并减少点击路径工作。

- [x] 用同一真实素材复现并定位首帧交接根因。
- [x] 验证仅悬停或按下无视频准备，以及确认点击使用既有 File 通路。
- [x] 通过有明确回归对象的现有浏览器和宿主测试。
- [ ] 采集真实 Codex 基线与候选的切换、输入、滚动、CPU、内存和录屏。
- [ ] 记录失败、取消、资源释放及用户视觉验收状态。

## Comments

- 用户批准方案 A，方案 B 待实测后决定。沿用现有两条验证路径。
- `pnpm test` 36/36。真实 Codex 中临时加载最终运行时 `fa6d27b1`，前置与尾置视频各通过 20/20。基线、候选、取消及录屏见 [方案 A 实机记录](../../codex-wallpaper-media-startup-performance/evidence/20261119-plan-a-results.md)。
- 完整候选需通过用户控制的专用入口重启加载。真实实例的 A→B→A 混合版本测试仍走了旧宿主的整段回退。新宿主的对应回归已通过，完整加载后的快速选择与交互复测仍需执行。50 ms 反馈、150 ms 过渡、严格冷切和用户视觉验收仍未完成。
- 已定位并修复普通聊天中设置页关系选择器的重复样式计算。两组真实 Chromium 呈现 p95 从 94.5／120.8 ms 降到 31.9／74.9 ms。保留 50 ms 反馈验收为待稳定达标，原画质下没有已验证的 200 ms 上限，方案 B 仍待定。见 [选中反馈复测](../../codex-wallpaper-media-startup-performance/evidence/20261119-plan-a-feedback-results.md)。
- 已修复四张报告素材：视频 File 通路扩至 1 GiB，512 MiB 只限制 Base64；超限或 File 失败提交预览；卡片状态与真实播放器一致。真实四素材均得到连续推进帧，`吊桥` 564 MB 使用 File，Base64 为 0。见 [四素材记录](../../codex-wallpaper-media-startup-performance/evidence/20261119-four-asset-file-limit.md)。
- 已将素材库复核移出点击关键路径，并用扫描签名判断后台重扫；File 交接改用 `objectId`，去掉重复 DOM 树查询。本机过期索引调用约 2 ms，File 交接约减少 19 ms。见 [缓存与交接记录](../../codex-wallpaper-media-startup-performance/evidence/20261119-cache-and-file-handoff.md)。
