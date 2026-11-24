# 09 人工 E2E 验收清单

**候选 SHA：** `ca0624351b721023313d30823d6a2add945ad4cf`  
**自动门禁：** `pnpm.cmd test:full` 已通过（Node 94/94，四个 PowerShell 套件全绿）  
**执行人：** __________ **日期：** __________

**验收结果：** 2026-11-25 用户确认通过；详细脱敏回执保留在用户本地。

> 只记录脱敏结果。不要提交聊天正文、账号、个人路径、PID 明细或完整回执 JSON。

## 0. 前置

- [ ] `git status` 干净，`git rev-parse HEAD` 等于上面的候选 SHA。
- [ ] 已保存所有 Codex 会话和未发送输入。
- [ ] 已完全退出 Codex（任务管理器里没有 `ChatGPT.exe` 主进程）。
- [ ] 日常壁纸配置已备份，或确认可恢复。

## 1. 冷启动与回执

启动方式（二选一，推荐 A）：

- A：桌面「Codex 壁纸」或 `launcher\Codex-Wallpaper.cmd`
- B：`powershell.exe -NoProfile -STA -File .\launcher\Start-CodexWallpaper.ps1`

- [ ] `%LOCALAPPDATA%\CodexWallpaper\P0b` 出现本次新生成的 `.json` 回执。
- [ ] `Outcome` = `wallpaper-ready`。
- [ ] `TargetVerified` = `true`。
- [ ] `Wallpaper.hostReady` = `true`。
- [ ] `Wallpaper.state` = `enabled`；若从停用状态启动则为 `disabled`，需注明。
- [ ] 主界面出现壁纸，没有第二层壁纸或重复控制条。

记录：Outcome __________　state __________　hostReady __________　TargetVerified __________　CompatibilityMode __________

## 2. 单实例与身份复用

- [ ] 再次运行同一入口，不新增第二个壁纸层、控制根或宿主。
- [ ] 第二次启动不出现 `ambiguous-main-page`，且不要求重新登录。
- [ ] 两次回执的 `Wallpaper.identity.runtimeHash` 和 `styleHash` 一致，或已记录变化原因。

## 3. 素材

每项按“选择 → 等待稳定 → 记录结果”执行。

- [ ] 图片：导入本地图片，切换成功；重开专用入口后仍保留。
- [ ] 视频：导入或选择视频，首帧后正常循环；记录静音和音量行为。
- [ ] Scene：选择代表性 Scene，首帧出现，帧率设置生效；不支持时出现预览降级。
- [ ] 离线 Web：选择本机 Web 项目，内容显示；脚本和外链不执行；加载超时出现预览或静态降级。

| 素材     | 实际结果 | 降级/失败原因 | 是否可接受 |
| -------- | -------- | ------------- | ---------- |
| 图片     |          |               |            |
| 视频     |          |               |            |
| Scene    |          |               |            |
| 离线 Web |          |               |            |

## 4. 交互与设置

- [ ] `Alt+Shift+S` 打开/关闭设置面板。
- [ ] `Alt+Shift+W` 停用/恢复壁纸。
- [ ] 修改任一外观值立即生效，重开后保留。
- [ ] 输入框、滚动、点击和右键菜单不被壁纸层遮挡。
- [ ] 切到其他窗口或最小化后视频/Scene 暂停，回到前台恢复。
- [ ] 同源第二个页面修改设置后，主页面同步且不重建壁纸卡片。

## 5. 停用、恢复与清理

- [ ] 点击「停用并清除本项目数据」，第一次点击进入确认态。
- [ ] 第二次点击后壁纸层、控制层和适配样式消失，Codex 仍可正常输入和切换会话。
- [ ] 重新启用后恢复上次素材；若已清除则回到默认状态。
- [ ] 清除后再次打开设置，导入数为 0，状态文案明确，不残留旧 Web 内容或“加载失败”标记。

## 6. 退出与重开

- [ ] 正常退出 Codex，监督进程和宿主一起退出，任务管理器无残留。
- [ ] 从原入口重新打开，原账号、已有聊天和原界面正常。
- [ ] 壁纸按上次偏好恢复；若已清除则保持默认。

## 7. 视觉确认（仅本人）

- [ ] 配色、排版、动画和截图观感由本人确认；agent 不参与此项。

## 8. 失败记录

| 步骤 | 现象 | 回执/状态值 | 可重试 | 阻塞发布 |
| ---- | ---- | ----------- | ------ | -------- |
|      |      |             |        |          |

## 9. 脱敏回执模板

先只提取需要的字段，避免整份 JSON 外泄：

```powershell
$r = Get-ChildItem "$env:LOCALAPPDATA\CodexWallpaper\P0b\*.json" |
  Sort-Object LastWriteTime | Select-Object -Last 1
$j = Get-Content $r.FullName -Raw | ConvertFrom-Json
[pscustomobject]@{
  Outcome = $j.Outcome
  TargetVerified = $j.TargetVerified
  State = $j.Wallpaper.state
  HostReady = $j.Wallpaper.hostReady
  RuntimeHash = $j.Wallpaper.identity.runtimeHash
  StyleHash = $j.Wallpaper.identity.styleHash
  HostReadyMs = $j.HostReadyMs
}
```

回填模板（不要加入 `MainPid`、`MainCreated`、`Port`、完整路径或账号）：

```json
{
  "candidateSha": "ca0624351b721023313d30823d6a2add945ad4cf",
  "outcome": "wallpaper-ready",
  "targetVerified": true,
  "compatibilityMode": "known",
  "hostReady": true,
  "wallpaperState": "enabled",
  "runtimeHash": "<runtimeHash>",
  "styleHash": "<styleHash>",
  "hostReadyMs": "<HostReadyMs>",
  "repeatLaunchReused": true,
  "media": {
    "image": "pass",
    "video": "pass",
    "scene": "pass",
    "web": "pass"
  },
  "hotkeys": { "settings": true, "toggle": true },
  "pauseWhenHidden": true,
  "disableRestore": true,
  "cleanup": true,
  "restart": true,
  "unverified": []
}
```

人读摘要：

```text
候选 SHA:
回执 Outcome / state / hostReady / TargetVerified:
runtimeHash / styleHash:
图片 / 视频 / Scene / Web:
Alt+Shift+S / Alt+Shift+W:
停用恢复 / 双确认清除 / 退出重开:
未完成或降级场景:
```
