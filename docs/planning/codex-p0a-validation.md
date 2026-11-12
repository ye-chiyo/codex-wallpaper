# Codex P0a 实测：Owl/MSIX CDP 能力与原入口

日期：2026-11-10，时区 Asia/Shanghai。范围：P0a 连接能力验证；未进入 P1、壁纸注入或完整实现。

## 结论

**当前版本的 CDP 能力已在独立进程中验证通过**：原安装路径下的 `ChatGPT.exe` 接受 loopback 调试参数，能发现 `app://-/index.html` 主界面，并通过其 WebSocket 成功响应只读 `Page.getFrameTree` 请求。

**原入口自动接入仍未通过**：不带参数的原注册入口热激活成功，之后当前工作主进程继续存活，未出现应用监听端口或调试参数。未做原入口冷启动；未安装自动接入器，因此不能宣称“点击原图标就会自动有壁纸/CDP”。这不是对所有未来接入方式的否定。

**当前工作中的 Codex 没有被关闭或重启**。其主 PID `23900` 的创建时间在前后相同，调试参数保持为空；实验进程按 PID + 创建时间隔离清理，最终无实验进程或端口残留。安装 ASAR 与 EXE 的 SHA-256 前后相同。

## 实测样本与约束

- AppX：`OpenAI.Codex_26.1103.4239.0_x64__2p2nqsd0c76g0`。
- 原注册 AUMID：`OpenAI.Codex_2p2nqsd0c76g0!App`。
- ASAR package.version：`26.1103.32239`；元数据构建类型 `prod`。
- 实验可执行文件：`C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.4239.0_x64__2p2nqsd0c76g0\app\ChatGPT.exe`；使用原文件，没有复制为 portable 版。
- 起始保护对象：主 PID `23900` 及已有应用进程；基线盘点 17 个同路径应用进程、0 个 TCP 监听端口。
- 所有已有 PID 及实验前其他 PID 均加入不可终止集合；退出只处理本次启动返回的进程及经父子关系识别的后代，并复核创建时间以防 PID 复用。
- 未更改 BUILD_FLAVOR、开发开关、WindowsApps ACL、安装资源、快捷方式、协议注册、开机启动或日常 Codex 配置。子进程环境中的构建覆盖与 Node 启动覆盖被移除，以包自身 prod 元数据运行。
- 未执行 Runtime.evaluate、DOM 操作、CSS 注入、壁纸播放或登录；查询目标时不保存页面标题、账户、cookie 或 storage。

## 启动隔离的源码依据

新增检查发现 `.vite/build/early-bootstrap-339-ce026819bf837ba7.js` 在字符位置约 `1042719` 调用 `app.setPath("userData", ...)`；其路径解析优先读取 `CODEX_ELECTRON_USER_DATA_PATH`，否则构造默认 Codex 路径。随后在约 `1043422` 进入单实例锁逻辑。

因此本次同时设置：

```text
--remote-debugging-address=127.0.0.1
--remote-debugging-port=<本轮空闲端口>
--user-data-dir=<本轮独立 profile>

CODEX_ELECTRON_USER_DATA_PATH=<同一个独立 profile>
CODEX_HOME=<本轮独立 Codex home>
```

环境覆盖仅存在于实验子进程；未对当前 shell、用户环境或当前工作进程作持久修改。仅传 `--user-data-dir` 不足以根据此源码保证 Electron/应用层 userData 也隔离，因此未采用该单一参数方案。

## 原注册入口观察

通过 `IApplicationActivationManager.ActivateApplication` 激活原 AUMID，参数为空，选项为 AO_NOERRORUI。未把实验 CDP 参数发送给原注册入口，以免已有实例接收这些参数并导航。

- 时间：`11:12:00 +08:00`。
- API 返回成功，返回激活 PID `14836`。
- 随后快照中没有新的常驻主实例，工作主 PID `23900` 保持同一创建时间；该返回值不能直接解释为主界面 PID。
- 之后同路径应用仍无 TCP 监听端口，主进程调试参数仍为空。

对应证据：[激活结果](../../.scratch/codex-cdp-p0a/run-20261110-1108/original-activation.json)、[激活后进程状态](../../.scratch/codex-cdp-p0a/run-20261110-1108/after-original-activation.json)。

该证据覆盖的是已运行应用的原注册入口热激活，不是用户物理点击图标的视频记录，也不是冷启动、CDP 参数经 AUMID 传递或自动壁纸加载验证。

## 独立 CDP 实验记录

| 实验           | 时间（+08:00）    | 实验 PID / 端口   | 结果                                                                                            |
| -------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| 首次 discovery | 11:12:27–11:12:31 | `50184` / `49671` | CDP 可用，但首次快照仅有扩展 service_worker；未据此认定主界面通过，结束并清理                   |
| 主界面发现     | 11:14:54–11:14:59 | `50108` / `58548` | 在有界 25 秒观察窗口内发现 `type=page`、`app://-/index.html` 和 WebSocket 地址；实际约 5 秒完成 |
| 主界面协议请求 | 11:16:37–11:16:43 | `36536` / `54888` | 发现主界面后向其 WebSocket 发送 `Page.getFrameTree`，响应成功，确认 origin 为 `app://-`         |

三次 TCP 监听均为 `127.0.0.1`，拥有者为对应实验主 PID。请求前检查端口归属；实验结束后复核端口关闭。

第三次返回的协议版本信息：

```text
Browser: Chrome/157.0.8103.39
Protocol-Version: 1.3
V8-Version: 15.7.112.23
```

第三次只读请求结果摘要：

```json
{
  "method": "Page.getFrameTree",
  "frame": {
    "url_without_query": "app://-/index.html",
    "security_origin": "app://-"
  },
  "error": null
}
```

这证明独立 prod 进程中的主界面 CDP 传输可以响应命令；不证明页面脚本执行、样式兼容、登录会话兼容或持续播放能力。

对应完整证据：

- [首次实验](../../.scratch/codex-cdp-p0a/run-20261110-1108/isolated-result.json)。
- [主界面发现实验](../../.scratch/codex-cdp-p0a/run-20261110-1114/isolated-result.json)。
- [只读 WebSocket 请求实验](../../.scratch/codex-cdp-p0a/run-20261110-1116/isolated-result.json)。
- 每个实验目录另保留时间戳事件 JSONL、独立进程 stdout/stderr。Profile 文件清单仅保留前 80 个相对路径，不是完整文件总数；未读取其中的账户数据库内容。

## 恢复与缓存处置

- 三轮均只终止本轮拥有的进程；创建时间复核后，所有实验进程均已不存在。
- 端口 `49671`、`58548`、`54888` 均已关闭；最终日常应用仍无 TCP 监听端口。
- `11:18:50 +08:00` 最终核对：工作主 PID `23900` 为同一进程，调试参数未变；ASAR 与 EXE 散列均未变。[最终状态](../../.scratch/codex-cdp-p0a/run-20261110-1108/final-health.json)
- ASAR SHA-256：`fb47d6491dc3006b708cb1e14de479b882bf50f88b7daa81818f154c253266aa`。
- 递归删除本轮临时 profile 的命令被自动审批策略拒绝，返回 `blocked by policy`，没有提供更具体原因；该命令未执行。
- 改为保留缓存：经绝对路径边界校验，已将三轮 profile 和独立 CODEX_HOME 共 6 个目录移入专用临时目录 `C:\Users\614\AppData\Local\Temp\codex-wallpaper-p0a-20261110-1118`。源目录已不存在，目标目录存在；没有删除缓存，也没有把它们纳入仓库。[缓存保留记录](../../.scratch/codex-cdp-p0a/archive-result.json)

这里的恢复结论是“实验进程与端口清理完成，当前工作实例保持运行，安装资源未变”；没有对当前工作实例做退出重开，也没有测试产品级卸载。

## 验证状态与下一步

| 项目                                                  | 当前状态                     |
| ----------------------------------------------------- | ---------------------------- |
| 精确原安装 EXE + 独立 profile 的 CDP                  | 通过                         |
| 正确归属、loopback 监听、主界面 target 与只读 WS 请求 | 通过                         |
| 实验退出、端口关闭、保留当前工作实例                  | 通过；临时缓存已保留至 Temp  |
| 原注册入口热激活                                      | 已观察，未自动打开 CDP       |
| 原入口冷启动自动接入                                  | 未验证，不记为通过           |
| AUMID 传递 CDP 参数                                   | 未测试，避免影响当前工作会话 |
| 当前日常 profile/账户与独立实验 profile 兼容          | 未验证                       |
| P1 壁纸/样式注入、P2 组件适配、P3 持续运行            | 未执行                       |

下一阶段应聚焦 P0b：原入口如何在保留日常 profile 的条件下自动建立可撤销连接。此次确认了“受控启动连接可用”，没有解决“普通入口自动连接”；不进入完整播放器或管理界面实现。

探针代码保存在 [probe.py](../../.scratch/codex-cdp-p0a/probe.py)、[原入口激活脚本](../../.scratch/codex-cdp-p0a/activate-original.ps1) 和 [只读协议请求](../../.scratch/codex-cdp-p0a/list-targets.mjs)，用于复查本轮动作。重新运行会创建独立应用进程和 profile，应使用新的输出目录，不能将其视为只读分析脚本。
