import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { applyStaticBackground, evaluateInPage } from "./static-background.mjs";

const edge =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const rootId = "codex-wallpaper-p1";
const controlRootId = "codex-wallpaper-p1-controls";
const tinyMp4 =
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN0bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAp90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAQAAABAAAAAAIXbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABwm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMiBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADACg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABegAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAFAAAIAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAOGN0dHMAAAAAAAAABQAAAAEAABAAAAAAAQAAKAAAAAABAAAQAAAAAAEAAAAAAAAAAQAACAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAALEAAAADAAAAAwAAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAOkAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMgAAAAhmcmVlAAAC/G1kYXQAAAKtBgX//6ncRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIzIDA0ODBjYjAgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49NSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA9liIQAEv/+963fgU3DKz0AAAAIQZokbEP//uAAAAAIQZ5CeIIfq4EAAAAIAZ5hdEP/s4AAAAAIAZ5jakP/s4E=";

function encodeWebSocketText(value) {
  const body = Buffer.from(value);
  if (body.length < 126)
    return Buffer.concat([Buffer.from([0x81, body.length]), body]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(body.length, 2);
  return Buffer.concat([header, body]);
}

function takeWebSocketText(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 15;
  let length = buffer[1] & 127;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const masked = (buffer[1] & 128) !== 0;
  const maskOffset = offset;
  if (masked) offset += 4;
  const total = offset + length;
  if (buffer.length < total) return null;
  const mask = masked ? buffer.subarray(maskOffset, maskOffset + 4) : null;
  const payload = Buffer.from(buffer.subarray(offset, total));
  if (mask)
    payload.forEach((byte, index) => (payload[index] = byte ^ mask[index % 4]));
  return { opcode, text: payload.toString(), rest: buffer.subarray(total) };
}

async function startExactCdpFixture(t) {
  const id = "0123456789abcdef0123456789abcdef";
  const requests = [];
  const sockets = new Set();
  let hostSocket = null;
  const server = createServer((request, response) => {
    assert.equal(request.url, "/json/list");
    response.end(
      JSON.stringify([
        {
          id,
          type: "page",
          url: "app://-/index.html",
          webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/${id}`,
        },
      ])
    );
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    const accept = createHash("sha1")
      .update(
        request.headers["sec-websocket-key"] +
          "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
      )
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    let incoming = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      incoming = Buffer.concat([incoming, chunk]);
      let frame = takeWebSocketText(incoming);
      while (frame && frame.opcode === 1) {
        incoming = frame.rest;
        const command = JSON.parse(frame.text);
        requests.push(command);
        let result = {};
        if (command.method === "Runtime.evaluate") {
          const value =
            command.params.expression ===
            "globalThis.__codexWallpaperApi.configureHost()"
              ? { state: "enabled", hostReady: true }
              : { state: "disabled", backgroundLayers: 0 };
          result = { result: { value } };
        }
        if (command.method === "Runtime.addBinding") hostSocket = socket;
        socket.write(
          encodeWebSocketText(JSON.stringify({ id: command.id, result }))
        );
        frame = takeWebSocketText(incoming);
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise((resolve) => server.close(resolve));
  });
  return {
    port: server.address().port,
    requests,
    stopHost() {
      hostSocket?.write(
        encodeWebSocketText(
          JSON.stringify({
            method: "Runtime.bindingCalled",
            params: {
              name: "__codexWallpaperHostRequest",
              payload: JSON.stringify({ type: "stop" }),
            },
          })
        )
      );
    },
  };
}

async function startFixture() {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html>
      <html data-theme="dark">
      <title>wallpaper fixture</title>
      <style>
        :root {
          --app-color-background-surface: rgb(24 24 28);
          --app-color-background-surface-under: rgb(12 12 16);
          color-scheme: dark;
        }
        :root[data-theme="light"] {
          --app-color-background-surface: rgb(247 247 249);
          --app-color-background-surface-under: rgb(232 232 237);
          color-scheme: light;
        }
        body { margin: 0; min-height: 1200px; color: rgb(245 245 250); }
        :root[data-theme="light"] body { color: rgb(20 20 24); }
        [data-app-shell-page-surface] { background: var(--app-color-background-surface); }
        [data-app-shell-main-surface] { min-height: 100vh; background: transparent; }
        [data-testid="webmcp-tool-scroll"] { display: block; padding: 24px; }
        [data-testid="diff-preview-scroll"] { display: block; padding: 24px; }
        [data-composer-surface-variant] { display: block; padding: 24px; background: var(--app-color-background-surface); }
        .thread-scroll-footer-shell::before { content: ""; background-image: linear-gradient(transparent, var(--app-color-background-surface)); }
        .thread-scroll-footer-shell::after { content: ""; background-color: var(--app-color-background-surface); }
        .thread-footer-backdrop { position: absolute; bottom: 0; width: 80%; height: 80px; background: var(--app-color-background-surface-under); }
      </style>
      <div data-app-shell-workspace-row>
        <div data-app-shell-page-surface>
          <div data-app-shell-main-surface>
            <main>
            <article id="message" data-markdown-text-style="assistant-message">
              ${"Long assistant response ".repeat(40)}
            </article>
            <button id="open-changes" type="button">Open Changes</button>
            <section data-testid="webmcp-tool-scroll" class="bg-surface">
              <button id="tool-action" type="button">Toggle tool</button>
              <div id="tool-details">Tool details</div>
            </section>
            <div data-app-action-timeline-scroll>
            <div class="thread-scroll-footer-shell">
            <div data-thread-scroll-footer>
              <div class="thread-footer-backdrop bg-surface"></div>
              <div data-pip-obstacle="thread-footer-leading" class="bg-surface thread-footer-leading">Leading footer content</div>
              <div data-thread-composer-backdrop>
                <form class="bg-surface" data-composer-surface-variant="inline">
                  <textarea id="composer">Composer text</textarea>
                </form>
              </div>
            </div>
            </div>
            </div>
            </main>
          </div>
        </div>
        <aside data-app-shell-trailing-sidebar hidden><div class="h-full min-w-0"><header class="bg-surface-elevated-secondary"><span>Changes</span><button id="close-changes" type="button">Close</button></header><section data-testid="diff-preview-scroll" data-thread-find-target="review"><pre><code id="code">const visible = true;</code></pre></section></div></aside>
      </div>
      <aside data-app-shell-page-sidebar><button id="project-action">Project</button></aside>
      <div data-app-shell-pane-content-viewport><pre id="editor">editor</pre></div>
      <section role="dialog" id="settings-dialog"><button id="dialog-action">Dialog</button></section>
      </html>
      <script>
        const sidebar = document.querySelector('[data-app-shell-trailing-sidebar]');
        document.querySelector('#open-changes').addEventListener('click', () => { sidebar.hidden = false; });
        document.querySelector('#close-changes').addEventListener('click', () => { sidebar.hidden = true; });
      </script>`
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}

async function waitForPort(profile) {
  const file = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      return Number(port);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Edge did not expose CDP");
}

async function waitForPage(port, options) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const href = await evaluateInPage(port, "location.href", options);
    if (href === options.page) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Edge did not load the fixture page");
}

async function startBrowserFixture(t) {
  const fixture = await startFixture();
  const profile = await mkdtemp(join(tmpdir(), "codex-wallpaper-edge-"));
  const browser = spawn(
    edge,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--no-proxy-server",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      fixture.url,
    ],
    { stdio: "ignore" }
  );
  t.after(async () => {
    await new Promise((resolve) => {
      if (browser.exitCode !== null) resolve();
      else {
        browser.once("exit", resolve);
        browser.kill();
      }
    });
    await new Promise((resolve) => fixture.server.close(resolve));
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });
  return { fixture, port: await waitForPort(profile) };
}

test("persisted-disabled CLI starts the real host before a later enable", async (t) => {
  const fixture = await startExactCdpFixture(t);
  const child = spawn(
    process.execPath,
    [
      "--no-use-env-proxy",
      "launcher/static-background.mjs",
      String(fixture.port),
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const result = await new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error(`CLI timed out: ${stderr || stdout}`)),
      10_000
    );
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      try {
        const value = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
        clearTimeout(deadline);
        resolve(value);
      } catch {}
    });
    child.once("error", reject);
  });
  assert.equal(result.state, "enabled");
  assert.equal(result.hostReady, true);
  assert.equal(Number.isInteger(result.bridgePid), true);
  assert.ok(
    fixture.requests.some((request) => request.method === "Runtime.enable")
  );
  assert.ok(
    fixture.requests.some((request) => request.method === "Runtime.addBinding")
  );
  assert.ok(
    fixture.requests.some(
      (request) =>
        request.params?.expression ===
        "globalThis.__codexWallpaperApi.configureHost()"
    )
  );
  fixture.stopHost();
  child.kill();
});

test("static background is single, removable and persists disabled", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: {
      version: 1,
      library: [
        {
          id: "fixture-image",
          title: "Fixture Image",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E",
          assetDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E",
          reason: null,
        },
        {
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: `data:video/mp4;base64,${tinyMp4}`,
          reason: "asset-too-large-or-missing",
        },
        {
          id: "fixture-scene",
          title: "Fixture Scene",
          type: "scene",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: "data:application/octet-stream;base64,AA==",
          reason: "scene-native",
        },
        {
          id: "fixture-web",
          title: "Fixture Web",
          type: "web",
          playable: false,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: null,
          webHtml:
            "<!doctype html><style>body{margin:0;background:linear-gradient(45deg,#123,#abc)}</style>",
          reason: "web-offline",
        },
        {
          id: "fixture-web-fallback",
          title: "Fixture Web Fallback",
          type: "web",
          playable: false,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: null,
          webHtml: null,
          reason: "web-preview-fallback",
        },
        {
          id: "fixture-on-demand",
          title: "Fixture On Demand",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23fb923c'/%3E%3C/svg%3E",
          assetDataUrl: null,
          reason: "asset-not-loaded",
        },
        {
          id: "fixture-lazy",
          title: "Fixture Lazy",
          type: "image",
          playable: false,
          fallback: true,
          previewDataUrl: null,
          assetDataUrl: null,
          reason: "asset-not-loaded",
        },
      ],
    },
  };
  await waitForPage(port, options);

  assert.deepEqual(
    await evaluateInPage(
      port,
      "({ href: location.href, origin: location.origin, ready: document.readyState })",
      options
    ),
    {
      href: fixture.url,
      origin: new URL(fixture.url).origin,
      ready: "complete",
    }
  );
  await assert.rejects(
    applyStaticBackground(port, { ...options, page: `${fixture.url}other` }),
    /Main page not uniquely available/
  );
  await evaluateInPage(
    port,
    `(() => {
      globalThis.WebWallGL = {
        bytesSource: () => ({}),
        createScene: (host) => {
          const canvas = document.createElement("canvas");
          canvas.dataset.sceneCanvas = "";
          if (getComputedStyle(host).position === "static")
            host.style.position = "relative";
          canvas.style.cssText =
            "position:absolute;inset:0;width:100%;height:100%;display:block";
          host.append(canvas);
          return {
            load: () =>
              new Promise((resolve, reject) => {
                globalThis.__sceneResolve = () => {
                  globalThis.__sceneLoaded = true;
                  resolve();
                };
                globalThis.__sceneReject = reject;
              }),
            pause: () => {
              globalThis.__scenePaused = true;
            },
            resume: () => {
              globalThis.__sceneResumed = true;
            },
            setFps: (fps) => {
              globalThis.__sceneFps = fps;
            },
            setVolume: (volume) => {
              globalThis.__sceneVolume = volume;
            },
            destroy() {}
          };
        }
      };
    })()`,
    options
  );
  const initial = await applyStaticBackground(port, options);
  assert.equal(initial.state, "enabled");
  assert.equal(initial.backgroundLayers, 1);
  assert.equal(initial.styles, 1);
  assert.equal(initial.libraryCount, 7);
  assert.equal(initial.volume, 0);
  assert.equal(initial.fpsCap, 30);
  assert.equal(initial.visible, true);
  assert.ok(initial.controls >= 2);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `document.querySelector("#${controlRootId} [data-codex-wallpaper-settings]").click(),
       (() => {
         const panel = document.querySelector("#${controlRootId} [data-codex-wallpaper-panel]");
         return {
           open: panel.classList.contains("open"),
           cards: panel.querySelectorAll(".card").length
         };
       })()`,
      options
    ),
    { open: true, cards: 7 }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const state = await globalThis.__codexWallpaperApi.configureHost();
        const controls = document.getElementById("${controlRootId}");
        const webCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Web"
        );
        return {
          hostReady: state.hostReady,
          meta: webCard.querySelector("small")?.textContent
        };
      })()`,
      options
    ),
    { hostReady: true, meta: "web · 离线沙箱" }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        let hostRequests = 0;
        globalThis.__codexWallpaperHostRequest = (raw) => {
          const request = JSON.parse(raw);
          if (request.type === "load-asset") hostRequests += 1;
        };
        const controls = document.getElementById("${controlRootId}");
        const fallbackCard = [...controls.querySelectorAll(".card")].find(
          (card) =>
            card.querySelector("strong")?.textContent ===
            "Fixture Web Fallback"
        );
        fallbackCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          hostRequests,
          meta: fallbackCard.querySelector("small")?.textContent,
          preview:
            document.querySelector("#${rootId} .media img")?.naturalWidth > 0,
          status: controls.querySelector(".runtime-status")?.textContent
        };
      })()`,
      options
    ),
    {
      hostRequests: 0,
      meta: "web · 预览降级",
      preview: true,
      status: "Fixture Web Fallback · web-preview-fallback",
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const originalPlay = HTMLMediaElement.prototype.play;
        let playCalls = 0;
        HTMLMediaElement.prototype.play = () => {
          playCalls += 1;
          return playCalls === 1
            ? Promise.reject(new DOMException("Paused to save power", "NotAllowedError"))
            : Promise.resolve();
        };
        const controls = document.getElementById("${controlRootId}");
        const videoCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Video"
        );
        videoCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 40));
        const videoAfterRejectedPlay =
          document.querySelector("#${rootId} video") instanceof HTMLVideoElement;
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        await new Promise((resolve) => setTimeout(resolve, 40));
        const result = {
          videoAfterRejectedPlay,
          videoAfterVisible:
            document.querySelector("#${rootId} video") instanceof HTMLVideoElement,
          playCalls,
          status: controls.querySelector(".runtime-status")?.textContent
        };
        HTMLMediaElement.prototype.play = originalPlay;
        return result;
      })()`,
      options
    ),
    {
      videoAfterRejectedPlay: true,
      videoAfterVisible: true,
      playCalls: 2,
      status: "Fixture Video · video",
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const api = globalThis.__codexWallpaperApi;
        api.beginAssetTransfer({
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: false,
          previewDataUrl: null,
          assetDataUrl: null,
          assetUrl: null,
          webHtml: null,
          reason: null,
          mime: "video/mp4",
          size: ${Buffer.from(tinyMp4, "base64").length}
        });
        api.appendAssetTransferChunk("fixture-video", ${JSON.stringify(tinyMp4)});
        await api.finishAssetTransfer("fixture-video");
        await new Promise((resolve) => setTimeout(resolve, 40));
        const video = document.querySelector("#${rootId} video");
        return {
          playerCount: api.state().playerCount,
          blobUrl: video?.src.startsWith("blob:") ?? false
        };
      })()`,
      options
    ),
    { playerCount: 2, blobUrl: true }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const media = document.querySelector("#${rootId} .media");
        let mutations = 0;
        const observer = new MutationObserver(() => {
          mutations += 1;
        });
        observer.observe(media, { childList: true });
        globalThis.__codexWallpaperApi.receivePreview({
          id: "fixture-video",
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          fallback: true
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        observer.disconnect();
        return {
          mutations,
          playerCount: globalThis.__codexWallpaperApi.state().playerCount
        };
      })()`,
      options
    ),
    { mutations: 0, playerCount: 2 }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        globalThis.__codexWallpaperHostRequest = (raw) => {
          const request = JSON.parse(raw);
          if (request.type !== "load-asset") return;
          globalThis.__pendingLoadRequest = request;
        };
        const root = document.getElementById("${rootId}");
        globalThis.__codexWallpaperApi.receivePreview({
          id: "fixture-lazy",
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          fallback: true
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const controls = document.getElementById("${controlRootId}");
        const lazyCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Lazy"
        );
        const previewLoaded =
          lazyCard.querySelector(".thumb img") instanceof HTMLImageElement;
        lazyCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const imageCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Image"
        );
        imageCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const media = root.querySelector(".media");
        let mutations = 0;
        const observer = new MutationObserver(() => {
          mutations += 1;
        });
        observer.observe(media, { childList: true });
        globalThis.__codexWallpaperApi.receiveAsset({
          id: globalThis.__pendingLoadRequest.id,
          title: "Fixture Lazy",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23123456'/%3E%3C/svg%3E",
          reason: null
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        observer.disconnect();
        const image = media.querySelector("img");
        return {
          active: globalThis.__codexWallpaperApi.state().activeId,
          mutations,
          imageIsCurrentAsset: image?.src.includes("5d32b8") ?? false,
          previewLoaded
        };
      })()`,
      options
    ),
    {
      active: "fixture-image",
      mutations: 0,
      imageIsCurrentAsset: true,
      previewLoaded: true,
    }
  );
  assert.equal(
    await evaluateInPage(
      port,
      `(() => {
        globalThis.__codexWallpaperApi.receiveAssetError(
          "fixture-image",
          "fixture failure"
        );
        return document.querySelector("#${controlRootId} .runtime-status")
          ?.textContent;
      })()`,
      options
    ),
    "素材加载失败：fixture failure"
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const sceneCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Scene"
        );
        sceneCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const rejectOldScene = globalThis.__sceneReject;
        const imageCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Image"
        );
        imageCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        rejectOldScene(new Error("Scene superseded"));
        await new Promise((resolve) => setTimeout(resolve, 20));
        const image = root.querySelector("[data-codex-wallpaper-layer] img");
        return {
          activeId: globalThis.__codexWallpaperApi.state().activeId,
          imageIsCurrentAsset: image?.src.includes("5d32b8") ?? false
        };
      })()`,
      options
    ),
    { activeId: "fixture-image", imageIsCurrentAsset: true }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const sceneCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Scene"
        );
        sceneCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        globalThis.__sceneResolve();
        await new Promise((resolve) => setTimeout(resolve, 20));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        const ranges = controls.querySelectorAll(".range input");
        ranges[3].value = "15";
        ranges[3].dispatchEvent(new Event("input", { bubbles: true }));
        ranges[4].value = "40";
        ranges[4].dispatchEvent(new Event("input", { bubbles: true }));
        const canvas = root.querySelector("[data-scene-canvas]");
        const layer = root.querySelector("[data-codex-wallpaper-layer]");
        return {
          loaded: globalThis.__sceneLoaded,
          paused: globalThis.__scenePaused,
          resumed: globalThis.__sceneResumed,
          fps: globalThis.__sceneFps,
          volume: globalThis.__sceneVolume,
          canvasFillsLayer:
            canvas.getBoundingClientRect().height ===
              layer.getBoundingClientRect().height &&
            canvas.getBoundingClientRect().height > 0
        };
      })()`,
      options
    ),
    {
      loaded: true,
      paused: true,
      resumed: true,
      fps: 15,
      volume: 0.4,
      canvasFillsLayer: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const webCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Web"
        );
        webCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 40));
        const frame = root.querySelector("[data-codex-wallpaper-layer] iframe");
        return {
          sandbox: frame.getAttribute("sandbox"),
          offlineDocument: frame.srcdoc.includes("linear-gradient"),
          networkBlocked: frame.srcdoc.includes("default-src 'none'")
        };
      })()`,
      options
    ),
    {
      sandbox: "allow-scripts",
      offlineDocument: true,
      networkBlocked: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const imageCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Image"
        );
        imageCard.querySelector(".card-actions button").click();
        imageCard.querySelectorAll(".card-actions button")[1].click();
        imageCard.querySelectorAll(".card-actions button")[2].click();
        const opacity = controls.querySelectorAll(".range input")[2];
        opacity.value = "66";
        opacity.dispatchEvent(new Event("input", { bubbles: true }));
        const input = controls.querySelector(".import-row input");
        const transfer = new DataTransfer();
        transfer.items.add(
          new File(
            ["<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/>"],
            "Imported.svg",
            { type: "image/svg+xml" }
          )
        );
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (globalThis.__codexWallpaperApi.state().importedCount > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          imageVisible:
            root.querySelector("[data-codex-wallpaper-layer] img") instanceof
            HTMLImageElement,
          favorite: saved.favorites.length,
          playlist: saved.playlist.length,
          opacity: saved.settings.opacity,
          imported: globalThis.__codexWallpaperApi.state().importedCount,
          importedActive: saved.active.kind === "imported"
        };
      })()`,
      options
    ),
    {
      imageVisible: true,
      favorite: 1,
      playlist: 1,
      opacity: 66,
      imported: 1,
      importedActive: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const reset = controls.querySelector(".reset");
        reset.click();
        reset.click();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (globalThis.__codexWallpaperApi.state().importedCount === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          activeKind: saved.active.kind,
          imported: globalThis.__codexWallpaperApi.state().importedCount,
          state: globalThis.__codexWallpaperApi.state().state,
          root: document.querySelectorAll("#${rootId}, #${controlRootId}").length
        };
      })()`,
      options
    ),
    { activeKind: "builtin", imported: 0, state: "disabled", root: 0 }
  );
  await evaluateInPage(
    port,
    `(() => {
      const root = document.createElement("div");
      root.id = "${rootId}";
      root.dataset.stale = "";
      const controls = document.createElement("div");
      controls.id = "${controlRootId}";
      controls.dataset.stale = "";
      const style = document.createElement("style");
      style.id = "${rootId}-style";
      style.dataset.stale = "";
      document.documentElement.append(root, controls, style);
    })()`,
    options
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({
        root: document.querySelectorAll("#${rootId}").length,
        controls: document.querySelectorAll("#${controlRootId}").length,
        styles: document.querySelectorAll("#${rootId}-style").length,
        stale: document.querySelectorAll(
          "#${rootId}[data-stale], #${controlRootId}[data-stale], #${rootId}-style[data-stale]"
        ).length
      })`,
      options
    ),
    { root: 1, controls: 1, styles: 1, stale: 0 }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const root = document.getElementById("${rootId}");
        const background = root.querySelector("[data-codex-wallpaper-layer]");
        const media = root.querySelector(".media");
        const controls = document.getElementById("${controlRootId}");
        const toolbar = controls.querySelector(".toolbar");
        const toolbarRect = toolbar.getBoundingClientRect();
        const toolbarHit = document.elementFromPoint(
          toolbarRect.right - 8,
          toolbarRect.bottom - 8
        );
        const surface = document.querySelector("[data-app-shell-main-surface]");
        const tool = document.querySelector("#tool-action");
        const details = document.querySelector("#tool-details");
        const toolSurface = tool.closest("[data-testid='webmcp-tool-scroll']");
        const diffSurface = document.querySelector(
          "[data-thread-find-target='review']"
        );
        const changesCodeSurface = diffSurface.querySelector("pre");
        const codeSurface = document.querySelector("pre");
        const composerSurface = document.querySelector(
          "[data-composer-surface-variant]"
        );
        const footerBackdrop = document.querySelector(
          "[data-thread-scroll-footer] > .thread-footer-backdrop"
        );
        const footerShell = document.querySelector(".thread-scroll-footer-shell");
        const footerLeading = document.querySelector(
          "[data-pip-obstacle='thread-footer-leading']"
        );
        const leftPanel = document.querySelector("[data-app-shell-page-sidebar]");
        const rightPanel = document.querySelector(
          "[data-app-shell-trailing-sidebar]"
        );
        rightPanel.hidden = false;
        const pane = document.querySelector(
          "[data-app-shell-pane-content-viewport]"
        );
        const dialog = document.querySelector("#settings-dialog");
        const dialogAction = document.querySelector("#dialog-action");
        dialogAction.focus();
        const dialogHasFocus = document.activeElement === dialogAction;
        tool.addEventListener("click", () => {
          details.hidden = !details.hidden;
        });
        tool.scrollIntoView({ block: "center" });
        const rect = tool.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        const toolInitiallyHidden = details.hidden;
        hit.click();
        let toolToggleWorked = details.hidden !== toolInitiallyHidden;
        hit.click();
        toolToggleWorked &&= details.hidden === toolInitiallyHidden;
        const composer = document.querySelector("#composer");
        composer.focus();
        composer.setSelectionRange(0, 8);
        let keyboardWorked = false;
        composer.addEventListener("keydown", (event) => {
          keyboardWorked = event.key === "a";
        });
        composer.dispatchEvent(
          new KeyboardEvent("keydown", { key: "a", bubbles: true })
        );
        const range = document.createRange();
        range.selectNodeContents(document.querySelector("#message"));
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const streamed = document.createElement("p");
        streamed.id = "streamed-message";
        streamed.textContent = "Streamed response";
        document.querySelector("#message").append(streamed);
        streamed.scrollIntoView({ block: "center" });
        const readAlpha = (element) => {
          const value = getComputedStyle(element).backgroundColor;
          const match =
            value.match(/\\/\\s*([\\d.]+)\\s*\\)/) ||
            value.match(/,\\s*([\\d.]+)\\s*\\)$/);
          return match ? Number(match[1]) : 1;
        };
        const themeBases = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          return [
            surface,
            toolSurface,
            changesCodeSurface,
            codeSurface,
            composerSurface,
          ]
            .every(
              (element) =>
                getComputedStyle(element).backgroundColor !==
                "rgba(0, 0, 0, 0)"
            );
        });
        const themeFooterBackdrops = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          return getComputedStyle(footerBackdrop).backgroundColor ===
            "rgba(0, 0, 0, 0)" &&
            getComputedStyle(footerShell, "::before").backgroundImage === "none" &&
            getComputedStyle(footerShell, "::after").backgroundColor === "rgba(0, 0, 0, 0)";
        });
        const wallpaperVisibility = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          return {
            surfaceAlpha: readAlpha(surface),
            wallpaperOpacity: Number(getComputedStyle(media).opacity),
          };
        });
        return {
          surfaceAboveBackground:
            Number.parseInt(getComputedStyle(surface).zIndex, 10) >
            Number.parseInt(getComputedStyle(background).zIndex, 10),
          surfaceHasReadabilityBase:
            getComputedStyle(surface).backgroundColor !== "rgba(0, 0, 0, 0)",
          contentHasReadabilityBases: [
            toolSurface,
            changesCodeSurface,
            codeSurface,
            composerSurface
          ].every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
              "rgba(0, 0, 0, 0)"
          ),
          composerOuterPaintTransparent: themeFooterBackdrops.every(Boolean),
          footerLeadingHasReadabilityBase:
            getComputedStyle(footerLeading).backgroundColor !==
            "rgba(0, 0, 0, 0)",
          themesHaveReadabilityBases: themeBases.every(Boolean),
          wallpaperRemainsVisible:
            wallpaperVisibility.every(
              ({ surfaceAlpha, wallpaperOpacity }) =>
                surfaceAlpha >= 0.5 &&
                surfaceAlpha <= 0.68 &&
                wallpaperOpacity === 1
            ),
          panelSurfacesHaveReadability: [leftPanel, pane, dialog].every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
                "rgba(0, 0, 0, 0)" &&
              Number.parseInt(getComputedStyle(element).zIndex, 10) >= 1
          ),
          changesPanelKeepsWallpaper: readAlpha(rightPanel) === 0,
          changesScrollKeepsWallpaper: readAlpha(diffSurface) === 0,
          changesContentHasReadabilityBase:
            readAlpha(changesCodeSurface) > 0,
          changesBackgroundLayers: document.querySelectorAll(
            "#${rootId} [data-codex-wallpaper-layer]"
          ).length,
          changesRuntimeState: globalThis.__codexWallpaperApi.state().state,
          nonReviewPanelKeepsReadability: (() => {
            const target = diffSurface.dataset.threadFindTarget;
            delete diffSurface.dataset.threadFindTarget;
            const readable = readAlpha(rightPanel) > 0;
            diffSurface.dataset.threadFindTarget = target;
            return readable;
          })(),
          changesPanelClosed: (() => {
            rightPanel.hidden = true;
            return rightPanel.hidden;
          })(),
          dialogHasFocus,
          backgroundIgnoresPointers:
            getComputedStyle(background).pointerEvents === "none",
          wallpaperIsVisible:
            getComputedStyle(media).backgroundImage.includes("gradient") &&
            getComputedStyle(document.querySelector("[data-app-shell-page-surface]"))
              .backgroundColor === "rgba(0, 0, 0, 0)",
          toolbarIsAboveHost: toolbar.contains(toolbarHit),
          toolReceivesClick: hit === tool && toolToggleWorked,
          composerHasFocus: document.activeElement === composer,
          messageIsSelectable: selection.toString().startsWith("Long assistant response"),
          keyboardReachesComposer: keyboardWorked,
          pageScrolled: scrollY > 0,
          streamedMessageIsHitTestable:
            document.elementFromPoint(
              streamed.getBoundingClientRect().left + 1,
              streamed.getBoundingClientRect().top + 1
            ) === streamed
        };
      })()`,
      options
    ),
    {
      surfaceAboveBackground: true,
      surfaceHasReadabilityBase: true,
      contentHasReadabilityBases: true,
      composerOuterPaintTransparent: true,
      footerLeadingHasReadabilityBase: true,
      themesHaveReadabilityBases: true,
      wallpaperRemainsVisible: true,
      panelSurfacesHaveReadability: true,
      changesPanelKeepsWallpaper: true,
      changesScrollKeepsWallpaper: true,
      changesContentHasReadabilityBase: true,
      changesBackgroundLayers: 1,
      changesRuntimeState: "enabled",
      nonReviewPanelKeepsReadability: true,
      changesPanelClosed: true,
      dialogHasFocus: true,
      backgroundIgnoresPointers: true,
      wallpaperIsVisible: true,
      toolbarIsAboveHost: true,
      toolReceivesClick: true,
      composerHasFocus: true,
      messageIsSelectable: true,
      keyboardReachesComposer: true,
      pageScrolled: true,
      streamedMessageIsHitTestable: true,
    }
  );
  assert.equal(
    (await applyStaticBackground(port, options)).backgroundLayers,
    1
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const controls = document.getElementById("${controlRootId}");
        controls.querySelector("[data-codex-wallpaper-settings]").click();
        const card = [...controls.querySelectorAll(".card")].find(
          (item) => item.querySelector("strong")?.textContent === "Fixture Image"
        );
        card.querySelector(".card-actions button").click();
        const ranges = controls.querySelectorAll(".range input");
        for (const [input, value] of [
          [ranges[0], "42"],
          [ranges[1], "6"],
          [ranges[2], "73"],
          [ranges[3], "15"]
        ]) {
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = document.querySelector("#${rootId} .media img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const root = document.getElementById("${rootId}");
        const media = root.querySelector(".media");
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          selected: saved.active,
          settings: saved.settings,
          imageIsFixture: media.querySelector("img")?.src.includes("5d32b8"),
          playerCount: globalThis.__codexWallpaperApi.state().playerCount,
          opacity: root.querySelector("[data-codex-wallpaper-layer]").style.opacity,
          filter: media.style.filter
        };
      })()`,
      options
    ),
    {
      selected: { kind: "workshop", id: "fixture-image" },
      settings: {
        dim: 42,
        blur: 6,
        opacity: 73,
        fps: 15,
        volume: 0,
        rotationMinutes: 0,
      },
      imageIsFixture: true,
      playerCount: 0,
      opacity: "0.73",
      filter: "blur(6px)",
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        document.getElementById("open-changes").click();
        const sidebar = document.querySelector(
          "[data-app-shell-trailing-sidebar]"
        );
        const review = sidebar.querySelector(
          "[data-thread-find-target='review']"
        );
        const opened = {
          panel: !sidebar.hidden,
          panelAlpha: getComputedStyle(sidebar).backgroundColor,
          reviewAlpha: getComputedStyle(review).backgroundColor,
          code: review.querySelector("code")?.textContent,
          wallpaperLayers: document.querySelectorAll(
            "#${rootId} [data-codex-wallpaper-layer]"
          ).length,
          imageIsFixture: document.querySelector("#${rootId} .media img")
            ?.src.includes("5d32b8")
        };
        document.getElementById("close-changes").click();
        return { ...opened, closed: sidebar.hidden };
      })()`,
      options
    ),
    {
      panel: true,
      panelAlpha: "rgba(0, 0, 0, 0)",
      reviewAlpha: "rgba(0, 0, 0, 0)",
      code: "const visible = true;",
      wallpaperLayers: 1,
      imageIsFixture: true,
      closed: true,
    }
  );
  await evaluateInPage(
    port,
    `document.body.append(document.getElementById("${controlRootId}").cloneNode(true))`,
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        [...document.querySelectorAll("#${controlRootId}")]
          .find((element) => element.parentElement === document.documentElement)
          .querySelector(".toolbar [data-codex-wallpaper-toggle]")
          .click();
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          state: globalThis.__codexWallpaperApi.state(),
          savedEnabled: saved.enabled,
          savedActive: saved.active,
          savedSettings: saved.settings,
          roots: document.querySelectorAll(
            "#${rootId}, #${controlRootId}, #${rootId}-style"
          ).length
        };
      })()`,
      options
    ),
    {
      state: {
        state: "disabled",
        backgroundLayers: 0,
        controls: 0,
        styles: 0,
        activeKind: "workshop",
        activeId: "fixture-image",
        libraryCount: 7,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
      },
      savedEnabled: false,
      savedActive: { kind: "workshop", id: "fixture-image" },
      savedSettings: {
        dim: 42,
        blur: 6,
        opacity: 73,
        fps: 15,
        volume: 0,
        rotationMinutes: 0,
      },
      roots: 0,
    }
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = document.querySelector("#${rootId} .media img");
          if (
            globalThis.__codexWallpaperApi.state().state === "enabled" &&
            image?.complete &&
            image.naturalWidth > 0
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        const media = root.querySelector(".media");
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          state: globalThis.__codexWallpaperApi.state(),
          roots: {
            wallpaper: document.querySelectorAll("#${rootId}").length,
            controls: document.querySelectorAll("#${controlRootId}").length,
            styles: document.querySelectorAll("#${rootId}-style").length
          },
          imageIsFixture: media.querySelector("img")?.src.includes("5d32b8"),
          opacity: root.querySelector("[data-codex-wallpaper-layer]").style.opacity,
          filter: media.style.filter,
          settingsInputs: [...controls.querySelectorAll(".range input")]
            .slice(0, 5)
            .map((input) => Number(input.value)),
          savedActive: saved.active,
          savedEnabled: saved.enabled
        };
      })()`,
      options
    ),
    {
      state: {
        state: "enabled",
        backgroundLayers: 1,
        controls: 25,
        styles: 1,
        activeKind: "workshop",
        activeId: "fixture-image",
        libraryCount: 7,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
      },
      roots: { wallpaper: 1, controls: 1, styles: 1 },
      imageIsFixture: true,
      opacity: "0.73",
      filter: "blur(6px)",
      settingsInputs: [42, 6, 73, 15, 0],
      savedActive: { kind: "workshop", id: "fixture-image" },
      savedEnabled: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const value = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        value.enabled = false;
        value.active = { kind: "workshop", id: "fixture-on-demand" };
        globalThis.__testHostRequests = [];
        globalThis.__codexWallpaperHostRequest = (raw) => {
          const request = JSON.parse(raw);
          if (request.type === "load-asset")
            globalThis.__testHostRequests.push(request);
        };
        const next = JSON.stringify(value);
        localStorage.setItem("codex-wallpaper-p1-config", next);
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            newValue: next,
            storageArea: localStorage
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      })()`,
      options
    ),
    true
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({ root: document.querySelectorAll("#${rootId}, #${controlRootId}").length, styles: document.querySelectorAll("#${rootId}-style").length })`,
      options
    ),
    { root: 0, styles: 0 }
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (globalThis.__testHostRequests.length > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const root = document.getElementById("${rootId}");
        const previewShown = root.querySelector(".media img")?.src.includes(
          "fb923c"
        );
        const request = globalThis.__testHostRequests[0];
        globalThis.__codexWallpaperApi.receiveAsset({
          id: "fixture-on-demand",
          title: "Fixture On Demand",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl: null,
          assetDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%2322c55e'/%3E%3C/svg%3E",
          assetUrl: null,
          webHtml: null,
          reason: null
        });
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = root.querySelector(".media img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return {
          request,
          previewShown,
          assetShown: root.querySelector(".media img")?.src.includes("22c55e"),
          state: globalThis.__codexWallpaperApi.state()
        };
      })()`,
      options
    ),
    {
      request: { type: "load-asset", id: "fixture-on-demand" },
      previewShown: true,
      assetShown: true,
      state: {
        state: "enabled",
        backgroundLayers: 1,
        controls: 25,
        styles: 1,
        activeKind: "workshop",
        activeId: "fixture-on-demand",
        libraryCount: 7,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
      },
    }
  );
});
