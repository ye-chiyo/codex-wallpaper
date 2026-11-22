# Codex 本机安装包静态源码证据

日期：2026-11-10（Asia/Shanghai）。状态：只读静态研究，未修改应用、未重启、未开启调试、未执行注入或媒体播放。

## 样本身份与方法

- AppX：`OpenAI.Codex`，版本 `26.1103.4239.0`。
- ASAR package.version：`26.1103.32239`，与 AppX 版本分别记录。
- ASAR package.codexBuildFlavor：`prod`。构建解析代码还允许环境覆盖；此处记录的是包元数据，不通过读取私人日志猜测当前进程环境。
- 运行进程位置和 AppX 清单均指向 `app/ChatGPT.exe`。
- 资源声明 `runtimeName: "owl"`，主目录有 `chrome.dll` 和 `owl-shell-runtime.json`；不能假定等同于标准 Electron 发行版。
- ASAR SHA-256：`fb47d6491dc3006b708cb1e14de479b882bf50f88b7daa81818f154c253266aa`。
- 原文件：`C:\Program Files\WindowsApps\OpenAI.Codex_26.1103.4239.0_x64__2p2nqsd0c76g0\app\resources\app.asar`。
- 临时只读提取件、索引和 REA 结果位于 `C:\Users\614\AppData\Local\Temp\codex-wallpaper-research-20261110`；未把完整安装包源码或大型分析包放入仓库。
- 以下成员位置、散列、字符串片段来自普通 Python/PowerShell 只读检查；除专门的 REA 小节外，不声称是 REA 语义证明。
- 偏移采用 Python Unicode 字符索引，零起始、结束不含；ASAR member offset 则是归档数据区内的字节偏移。片段仅用于定位，不能证明运行时可达或实际 DOM 结构。

## E01：原始应用入口与文件权限

- `AppxManifest.xml` 中 `Application Id="App" Executable="app/ChatGPT.exe" EntryPoint="Windows.FullTrustApplication"`。
- 清单同时注册 `codex:` 协议、启动任务和文件关联；替换某个手工快捷方式不能证明这些原入口都会经过适配。
- `Get-Acl app/resources/app.asar` 显示 owner 为 SYSTEM，Users 为 ReadAndExecute，TrustedInstaller/SYSTEM 等具有 FullControl。未尝试写入或变更 ACL。
- 查询到的主进程命令行没有 `--remote-debugging-port`、`--remote-debugging-pipe` 或 `--inspect` 参数。这是本次查询结果，不能据此证明所有潜在调试通道均不存在。

## E02：启动入口

- ASAR member：`package.json`。
- Member SHA-256：`b093e6a34b77da9e5fa53d5924415f5611a28367d2ff297bb3d2ce2141688c00`。
- ASAR member offset：`22042202`；字符范围：`[143, 423)`。

```text
"main": ".vite/build/early-bootstrap.js",
  "imports": {
    "#private-cli/*": {
      "private-cli": "./src/private-cli/*.ts",
      "public-cli": "./src/private-cli-contracts/*.ts",
      "default": "./src/private-cli-contracts/*.ts"
    }
  },
  "scripts": {
    "compile": "no
```

## E03：开发参数入口受构建类型限制

- ASAR member：`.vite/build/early-bootstrap.js`。
- Member SHA-256：`130d12cbaa4335cd6f21c8d281b9706c6c25f5c8be455cef1c85f57cdd5613b4`。
- ASAR member offset：`8984545`；字符范围：`[279010, 279520)`。

```text
a=t.CODEX_ELECTRON_CHROMIUM_SWITCHES?.trim();if(e!==u.x.Dev||!a)return[];try{n=JSON.parse(a)}catch{throw Error("CODEX_ELECTRON_CHROMIUM_SWITCHES must be valid JSON")}if(null==n||"object"!=typeof n||Array.isArray(n))throw Error("CODEX_ELECTRON_CHROMIUM_SWITCHES must be a JSON object");return Object.entries(n).map(([e,t])=>{if(0===e.length)throw Error("CODEX_ELECTRON_CHROMIUM_SWITCHES contains an empty switch name");if(null!=t&&"string"!=typeof t)throw Error(`CODEX_ELECTRON_CHROMIUM_SWITCHES value for ${e}
```

## E04：DevTools 构建类型门控

- ASAR member：`.vite/build/early-bootstrap.js`。
- Member SHA-256：`130d12cbaa4335cd6f21c8d281b9706c6c25f5c8be455cef1c85f57cdd5613b4`。
- ASAR member offset：`8984545`；字符范围：`[275279, 275369)`。

```text
allowDevtools:e=>f.isInternal(e)}},36572(e,t,n){"use strict";var a=n(65734);n.d(t,{},{m:fu
```

## E05：主界面渲染器设置

- ASAR member：`.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js`。
- Member SHA-256：`3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a`。
- ASAR member offset：`678404`；字符范围：`[4769185, 4769755)`。

```text
getRendererPreferences(e,t){let r=eEv(e);return{preload:this.options.preloadPath,additionalArguments:!eEs(t)&&["primary","detached","avatarOverlay","screenOverlay"].includes(e)?["--force-fieldtrials=WebRTC-Sctp-Snap/Enabled/WebRTC-IceHandshakeDtls/Enabled/WebRTC-ForceDtls13/Enabled/"]:void 0,backgroundThrottling:"avatarOverlay"!==e&&"screenOverlay"!==e&&void 0,contextIsolation:!0,nodeIntegration:!1,spellcheck:!0,scrollBounce:"darwin"===process.platform&&"primary"===e,devTools:this.options.allowDevtools,...r?{webviewTag:!0}:{}}}async configureAppRenderer(e,t,n,i){l
```

## E06：标签页创建独立 WebContents

- ASAR member：`.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js`。
- Member SHA-256：`3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a`。
- ASAR member offset：`678404`；字符范围：`[4804835, 4805395)`。

```text
this.configureAppRenderer(e,n,"primary",t).then(()=>{if(!n.isDestroyed()&&!this.accountWindows.isCovered(n))return this.installWebContentsDiagnostics(e,"primary",n),this.options.onAppViewRegistered?.(e,n),this.sendMessageToWebContents(n,{type:"window-fullscreen-changed",isFullScreen:e.isFullScreen()}),this.loadAppRenderer(n,t,"tab",i)}).catch(e=>{this.topLevelTabs?.rendererFailed(n),eEc().warning("Could not initialize app tab",{safe:{},sensitive:{error:e}})}),r}getActiveWebContents(e){return this.topLevelTabs?.getActiveWebContents(e)??e.webContents}getPr
```

## E07：打包版页面加载

- ASAR member：`.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js`。
- Member SHA-256：`3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a`。
- ASAR member offset：`678404`；字符范围：`[4803184, 4804034)`。

```text
async loadAppRenderer(e,t,r,n=!1){let i=!0===this.options.allowMcpAppSandboxLocalDevelopment,s=(0,tp.Xt)(t);if(!en.app.isPackaged){let a=new URL(eEg());s!==tp.wE&&(a.pathname=new URL(s,a).pathname),t&&a.searchParams.set("initialRoute",t),i&&a.searchParams.set("mcpAppSandboxLocalDevelopment","1"),null!=r&&a.searchParams.set("desktopSurface",r),n&&a.searchParams.set("desktopSwitch","1"),await e.loadURL(a.toString());return}let a=(0,tp.c)(this.options.moduleDir),o=(0,ee.join)(a,s);if((0,ef.existsSync)(o))try{let s=new URL((0,tp.Rk)(t,{mcpAppSandboxLocalDevelopment:i}));null!=r&&s.searchParams.set("desktopSurface",r),n&&s.searchParams.set("desktopSwitch","1"),await e.loadURL(s.toString());return}catch(e){eEc().warning("Failed to load bundle at",{safe:{},sensitive:{documentPath:o,error:e}})}let l=`data:text/html;charset=utf-8,${encodeURICompon
```

## E08：渲染器主题和 IPC 桥

- ASAR member：`.vite/build/preload.js`。
- Member SHA-256：`29c60ab997daa6eef349e4e3e4d4a3474468265590a9301d0718b4b2c8ca18f4`。
- ASAR member offset：`10097316`；字符范围：`[5200, 5740)`。

```text
o.contextBridge.exposeInMainWorld("codexWindowType",c),o.contextBridge.exposeInMainWorld("electronBridge",{windowType:c,acknowledgeChunkedMessage:(e,t)=>{o.ipcRenderer.send("codex_desktop:chunked-message-ack",e,t)},getPreloadStartedAtMs:()=>a,sendMessageFromView:async e=>{await o.ipcRenderer.invoke("codex_desktop:message-from-view",e)},getPathForFile:e=>{let t=o.webUtils.getPathForFile(e);return t||null},startFileDrag:e=>!0===o.ipcRenderer.sendSync("codex_desktop:start-file-drag",e),startLinkDrag:e=>{o.ipcRenderer.send("codex_desktop:
```

## E09：主页面 CSP

- ASAR member：`webview/index.html`。
- Member SHA-256：`93401a7bcf17d85e445060004f1ae0352b3f84f823f8fb3891312b68bc59d10d`。
- ASAR member offset：`755672022`；字符范围：`[166, 2846)`。

```text
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' app: blob: data: https:; child-src 'self' blob: codex-sandbox://*.web-sandbox.oaiusercontent.com codex-sandbox://web-sandbox.oaiusercontent.com https://*.web-sandbox.oaiusercontent.com https://web-sandbox.oaiusercontent.com; frame-src 'self' blob: codex-sandbox://*.web-sandbox.oaiusercontent.com codex-sandbox://web-sandbox.oaiusercontent.com https://*.web-sandbox.oaiusercontent.com https://cdn.plaid.com https://cdn.platform.openai.com https://codepen.io https://docs.google.com/document/d/ https://docs.google.com/presentation/d/ https://docs.google.com/spreadsheets/d/ https://drive.google.com/file/d/ https://embed.apple-mapkit.com/v1/embed https://inquiry.withpersona.com https://mfe.prod.us-exp-api.experiancs.com https://mfe.uat.us-exp-api.experiancs.com https://player.vimeo.com/video/ https://web-sandbox.oaiusercontent.com https://www.google.com/maps https://www.google.com/maps/embed https://www.youtube.com; worker-src 'self' blob:; script-src 'self' 'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk=' 'wasm-unsafe-eval' https://cdn.plaid.com/link/v2/stable/link-initialize.js https://persistent.oaistatic.com/voice/silero-vad-v6/ort-wasm-simd-threaded.3101568d9c131ea89d4c693fbff3e0d0c3dcbcf1baa09fd871b86662a071bd1a.module.js; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self' app: blob: data: https:; connect-src 'self' blob: https://ab.chatgpt.com https://api.mapbox.com https://cdn.openai.com https://events.mapbox.com https://learn.chatgpt.com https://persistent.oaistatic.com https://production.plaid.com https://sandbox.plaid.com wss://*.api.openai.com/ws wss://*.api.openai.org/ws wss://chatgpt-staging.com/backend-api/pages/realtime-broker/ wss://chatgpt.com wss://ws.chatgpt-staging.com wss://ws.chatgpt.com;">
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChatGPT</title>
    <style>
      /* Dependency CSS can load before app.css, so establish Tailwind's layer order here. */
      @layer theme, base, components, utilities;

      :root {
        --startup-background: transparent;
        --startup-logo-shimmer-base: rgb(0 0 0 / 0.24);
        --startup-logo-shimmer-peak: rgb(255 255 255 / 0.48);
        --startup-logo-shimmer-soft: rgb(255 255 255 / 0.04);
        --startup-logo-shimmer-tail: rgb(255 255 255 / 0.08);
        --startup-logo-mask: url("/assets/openai-blossom-31ad67e73c52.svg");
      }

      :root[data-theme="dark"] {
        --startup-logo-shimmer-base: rgb(255 255 255 / 0.68);
      }

      @media (prefers-color-scheme: dark) {

```

## E10：主题表面 token

- ASAR member：`webview/assets/async/e77f816560c6.css`。
- Member SHA-256：`5ef0186201b63a1882a93c4a567040b80d167562656e39036dc8815657d925d6`。
- ASAR member offset：`580737776`；字符范围：`[14948, 15358)`。

```text
--color-token-side-bar-background:var(--app-color-background-surface-under);--color-token-bg-primary:var(--color-token-side-bar-background);--color-token-diff-surface:var(--color-token-main-surface-primary);--color-token-main-surface-primary:var(--app-color-background-surface);--color-token-bg-secondary:var(--color-token-bg-primary);--color-token-bg-tertiary:var(--color-token-bg-primary)}@supports (color:co
```

## E11：明暗主题选择器

- ASAR member：`webview/assets/async/e77f816560c6.css`。
- Member SHA-256：`5ef0186201b63a1882a93c4a567040b80d167562656e39036dc8815657d925d6`。
- ASAR member offset：`580737776`；字符范围：`[16478, 16708)`。

```text
:where([data-theme=light]){--theme-variant:light;color-scheme:light}:where([data-theme=dark]){--theme-variant:dark;color-scheme:dark}:where(:root),:where([data-theme]){--brand-gray-300:#afafaf;--brand-gray-500:#5d5d5d;--brand-slat
```

## E12：浮动左侧栏 DOM 与表面类

- ASAR member：`webview/assets/async/499225.6d2e47bea2.js`。
- Member SHA-256：`80f7a6b651f9f56ac97463123d72963c2a78570f6f0162c75d0d6d9d0a03f074`。
- ASAR member offset：`316442112`；字符范围：`[130971, 131321)`。

```text
"data-testid":"app-shell-floating-left-panel",className:(0,s.$)("flex h-full min-h-0 flex-col overflow-hidden bg-surface","content-surface"!==u&&"rounded-lg electron:elevation-prominent electron:[--elevation-prominent:var(--elevation-sidebar)] extension:shadow-[0.5px_0_0_0_var(--color-border),0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_
```

## E13：右侧面板标题栏 DOM

- ASAR member：`webview/assets/async/961657.97fdcc5e7d.js`。
- Member SHA-256：`5c908aacadffe3eb8226e2a8c5e35c4512a04ed598aafc8e653a2d56b9545efb`。
- ASAR member offset：`549554096`；字符范围：`[70196, 70466)`。

```text
"data-app-shell-main-titlebar":!0,"data-testid":"app-shell-header-context-menu-surface",className:t,style:n,children:[l,a,i,eh,ev,ex,o]}),J[170]=tb,J[171]=t,J[172]=n,J[173]=l,J[174]=a,J[175]=i,J[176]=eh,J[177]=ev,J[178]=ex,J[179]=o,J[180]=z):z=J[180],H=f&&!eY?(0,r.jsxs)
```

## E14：差异内容使用独立渲染组件

- ASAR member：`webview/assets/async/860717.54a5a14297.js`。
- Member SHA-256：`48e56d875428738bed4dfa06eee6b5fdd3e433938113ac521d2d6d36edc31d3f`。
- ASAR member offset：`494321998`；字符范围：`[13046, 13396)`。

```text
"data-testid":"diff-preview-scroll",children:(0,r.jsx)(u.FileDiff,{className:"composer-diff-simple-line relative overflow-clip [contain:content]",diffStyle:"unified",fileDiff:k.metadata,hunkSeparators:"simple",onPostRender:f})}),b[11]=k.metadata,b[12]=c):c=b[12],b[13]!==s||b[14]!==c?(h=(0,r.jsxs)(r.Fragment,{children:[s,c]}),b[13]=s,b[14]=c,b[15]=h
```

## E15：终端 canvas 表面

- ASAR member：`webview/assets/async/e7d08070dbfd.css`。
- Member SHA-256：`c0f48e94191a00c63d805f0b5dd8a6ae99b0edc3d62afeb631c324a3da8b21e5`。
- ASAR member offset：`582098323`；字符范围：`[591, 851)`。

```text
.xterm .xterm-screen{position:relative}.xterm .xterm-screen canvas{position:absolute;top:0;left:0}.xterm .xterm-scroll-area{visibility:hidden}.xterm-char-measure-element{visibility:hidden;line-height:normal;display:inline-block;position:absolute;top:0;left:-99
```

## E16：工具调用渲染分支

- ASAR member：`webview/assets/async/225284.63835849b6.js`。
- Member SHA-256：`6957f674f8a57d07870d7de357c9889f7201eabd6e4a5aac99eb2eddcd948b00`。
- ASAR member offset：`140563185`；字符范围：`[117276, 117656)`。

```text
case"mcp-tool-call":return(0,a.jsx)(_.m,{hostId:t.hostId,item:n,grouped:t.grouped,loadRemoteLogos:t.loadRemoteLogos,resolvedApps:t.resolvedApps});case"dynamic-tool-call":return(0,E.$9)(n)?.icon??(0,D.rF)(n)?.renderAgentActivityIcon?.(n,t.grouped)??(n.namespace===A.PD?(0,a.jsx)(L._,{"aria-hidden":!0,className:U}):null);case"auto-review-interruption-warning":return(0,a.jsx)(I.I,{
```

## E17：宿主已有休眠唤醒事件接线

- ASAR member：`.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js`。
- Member SHA-256：`3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a`。
- ASAR member offset：`678404`；字符范围：`[685530, 685890)`。

```text
addPowerMonitorListeners(),i.once("ready-to-show",()=>{this.showWindowIfReady(i)}),i.on("close",e=>{if(this.window===i){if(this.isNotchEnabled&&!this.isAppQuitting){e.preventDefault(),this.hide();return}this.cancelMomentum(),this.clearMovedWindowPersist(),this.unregisterNativeWindowDragTarget("closed"),this.persistWindowBounds(i)}}),i.on("move",()=>{if("darw
```

## E18：本地沙箱专用协议和权限处理

- ASAR member：`.vite/build/early-bootstrap-199-e3316cddb4ea6a6b.js`。
- Member SHA-256：`3202cb775ee05404d2b08f6dbb6fa3e524321da435564d8b2a7c6359ccdc6b0a`。
- ASAR member offset：`678404`；字符范围：`[4771574, 4772324)`。

```text
e.protocol.handle(cs,async e=>{let t=await async function(e){let t=c1(e);if(null==t)return null;let r=await c9(t,"force-cache");return r.ok||r.headers.has("Retry-After")?r:c9(t,"reload")}(e);return null==t?new Response(null,{status:404}):new Response(await t.arrayBuffer(),{headers:{"Content-Security-Policy":t.headers.get("Content-Security-Policy")??"","Content-Type":t.headers.get("Content-Type")??"application/octet-stream","Permissions-Policy":t.headers.get("Permissions-Policy")??"","X-Content-Type-Options":"nosniff"},status:t.status})}),e.setPermissionRequestHandler((e,t,n,i)=>{let s=r(e.id);null!=s&&dn(t,i.requestingUrl,s)||"clipboard-sanitized-write"===t&&null!=s&&cd(e.getURL())===s.origin&&cq(e)?n(!0):(cJ().info("mcp_app_sandbox.permiss
```

## REA 独立静态检查及局限

- 工具：`rea-agents@6.8.0`，使用本机已有 Node.js `24.22.1`，没有升级系统 Node 或修改 MCP 配置。
- 精选输入：`package.json`、`.vite/build/preload.js`、`webview/index.html`。未用 REA 对整个应用作完整语义分析。
- Parent Evidence：`ev_9fa48a62df9373a90792b808344051821642c955d1a865e898e4773953ec7dd4`。
- Summary Evidence：`ev_323af497b756057a52a3dda5ff47a8d484540ea402d41d4c6e031aee2a91f1bd`。
- 第一次分析按严格完整性策略停止：一个 unpacked 原生 addon 的实际散列与 ASAR 头声明不一致。按工具提供的 `record-and-continue` 路线重新只读分析，共记录 8 个原生伴随文件的完整性矛盾，保留为 observed-untrusted；不据此推断损坏、篡改或签名后处理的具体原因。
- 完整输出为临时目录中的 `rea-selected-evidence.json`。REA 报告关系覆盖不完整、动态表达式不可解析，以及 semantic unknown 上限等局限；结果不能证明真实启动、IPC 注册或长期运行成功。
- 本报告的主进程大块代码、前端 CSS 和 UI 标识证据来自独立的只读片段检查，不扩大 REA 的分析范围。

## 可复查范围与保留的未知

- 原应用包内容保持不变；研究文件写入仓库和临时目录。
- 未测试 WindowsApps 写权限、MSIX 对资源修改的启动/更新行为、Owl 的调试或 preload 外部加载兼容性。
- 未实际检验卡片/面板选择器、原入口自动运行、可见性暂停、休眠恢复、性能或卸载恢复。
- 在 `ChatGPT.exe` 中没有找到标准 Electron fuse marker；因此 fuse 状态未知，不能推断 NODE_OPTIONS 或 inspect 能力可用/不可用。
- 这些未验证项被纳入技术方案的分阶段验证门槛。
