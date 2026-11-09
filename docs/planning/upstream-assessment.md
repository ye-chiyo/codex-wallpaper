# 上游复用与宿主边界初查

日期：2026-11-10（Asia/Shanghai）。目标：为 Codex 移植的需求与后续技术验证提供依据。

检查版本：`elysia395/dsh-wallpaper-engine main@0c844f11fb8b2cd091931d603f316003f7cbf1dc`。证据来自 GitHub 只读源码检查，未运行项目或验证 Codex 接入；没有在本工作区克隆或下载上游。

## 结论

上游的壁纸播放与素材管理具有复用价值。主界面集成依赖 DSH 专有宿主服务和页面结构，需要为 Codex 重新适配；不能将安装上游插件视为完成移植。

| 观察                                                               | 移植含义                                                             | 源码证据                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 包声明依赖 DSH、Cordis、web runtime，并要求 Node.js >=22.12.0      | 现有发行包不能据此认定可直接安装到 Codex                             | [package.json](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/package.json#L148-L157)                                                                                                                                                                   |
| 宿主侧通过 `ctx.webServer` 提供壁纸 HTTP 路由和宿主服务            | 需要独立素材服务或等价宿主接线，路线尚未选择                         | [lib/index.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/lib/index.js#L167-L200)                                                                                                                                                                   |
| 客户端依赖 slots、theme、侧栏、快捷键等 DSH 能力                   | Codex 组件适配需要单独建立映射，不能直接复用 DSH 组件注册            | [src/client.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/client.js#L5324-L5326)、[src/sidebar-right.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/sidebar-right.js#L147-L181)       |
| 壁纸背景层与 scrim 通过 DSH CSS 变量及 body 属性控制               | 需要为 Codex 实际层级、明暗主题和各类组件重写样式适配                | [src/styles/base.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/styles/base.js#L26-L61)                                                                                                                                                         |
| Web 壁纸使用沙箱 iframe、loopback 供料与 postMessage 控制          | 需验证 Codex 的载荷限制、交互、资源访问及用户允许后的联网控制        | [HOW-IT-WORKS.md](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/docs/HOW-IT-WORKS.md#L69-L84)                                                                                                                                                          |
| 资源清理依赖 `ctx.effect`，涉及定时器、监听、iframe 和 React root  | 移植需重建启动/卸载与恢复机制；单纯复制播放器不覆盖长期运行要求      | [src/client.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/client.js#L5603-L5650)、[lib/host-boot.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/lib/host-boot.js#L183-L209)               |
| 宿主配置是真源，localStorage 为缓存/回退；启动后重建库存并恢复选择 | 可参考现有持久化迁移与恢复流程，但需要满足单机全局、多窗口一致的需求 | [src/persistence.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/persistence.js#L249-L318)                                                                                                                                                       |
| 实时层存在心跳、受压降帧和遮挡检测，媒体桥有进程监督               | 可参考节能与恢复设计，实际资源成本和 Codex 下表现须实测              | [src/live-layer/watch.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/live-layer/watch.js#L10-L40)、[src/occlusion.js](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/src/occlusion.js#L29-L65) |

## 复用候选

- WebWallGL 渲染适配与 Scene/Web/Video/Picture 媒体准备。
- 本地壁纸清单、壁纸选择和自动轮播。
- 设置 schema、持久化迁移和回退逻辑。

以上为静态分析的复用候选，不代表已经完成剥离、运行或兼容性测试。结构依据：[CODE-STRUCTURE.md](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/docs/CODE-STRUCTURE.md#L60-L67)。

## 许可边界

上游代码采用 [MIT 许可](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/LICENSE)，复用须保留相关声明。角色、字体和壁纸素材不自动随代码获得 MIT 授权，素材来源应分别核对，见 [素材来源说明](https://github.com/elysia395/dsh-wallpaper-engine/blob/0c844f11fb8b2cd091931d603f316003f7cbf1dc/assets/readme/SOURCES.md#L14-L17)。本轮未进行素材分发。

## 尚未证明

Codex 的可撤销主界面接入方法、原入口自动生效、更新后的可靠停用、多窗口同步、各类卡片/面板兼容、四类素材播放与联网控制、长期稳定性均需后续真实宿主验证。官方插件/MCP UI 的存在与 app.asar 的存在都不足以单独证明这些结果。
