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
import { callMainPage, openMainPageSession } from "./read-only-probe.mjs";

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

async function startHtmlFixture(html) {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}

async function startFixture() {
  return startHtmlFixture(
    `<!doctype html>
      <html data-theme="dark">
      <title>wallpaper fixture</title>
      <style>
        :root {
          --app-color-background-surface: rgb(24 24 28);
          --app-color-background-surface-under: rgb(12 12 16);
          --app-color-text-foreground: rgb(245 245 250);
          --color-codex-diff-added: rgb(55 180 105);
          --color-codex-diff-deleted: rgb(225 82 96);
          --color-text-secondary: rgb(255 255 255 / .65);
          --color-text-tertiary: rgb(255 255 255 / .5);
          color-scheme: dark;
        }
        :root[data-theme="light"] {
          --app-color-background-surface: rgb(247 247 249);
          --app-color-background-surface-under: rgb(232 232 237);
          --app-color-text-foreground: rgb(20 20 24);
          --color-codex-diff-added: rgb(20 135 70);
          --color-codex-diff-deleted: rgb(180 45 58);
          --color-text-secondary: rgb(0 0 0 / .65);
          --color-text-tertiary: rgb(0 0 0 / .5);
          color-scheme: light;
        }
        body { margin: 0; min-height: 1200px; color: rgb(245 245 250); }
        :root[data-theme="light"] body { color: rgb(20 20 24); }
        [data-app-shell-page-surface] { background: var(--app-color-background-surface); }
        [data-app-shell-main-surface] { min-height: 100vh; background: transparent; }
        [data-browser-sidebar-webview] { opacity: .001; }
        @layer host { [data-app-shell-titlebar] { position: fixed; top: 0; height: 36px; } }
        .muted-chrome { color: var(--color-text-tertiary); }
        [data-testid="webmcp-tool-scroll"], [data-summary-panel-variant] { display: block; padding: 8px; }
        #user-markdown-action { border: 0; background: transparent; }
        pre { padding: 12px; }
        [data-testid="diff-preview-scroll"] { display: block; padding: 24px; }
        #changes-panel [data-line-type] { display: block; min-height: 1lh; }
        #changes-panel [data-line-type="change-deletion"] { background-color: var(--diffs-bg-deletion, transparent); }
        #changes-panel [data-line-type="change-addition"] { background-color: var(--diffs-bg-addition, transparent); }
        [data-composer-surface-variant] { display: block; padding: 24px; background: var(--app-color-background-surface); }
        .thread-scroll-footer-shell::before { content: ""; background-image: linear-gradient(transparent, var(--app-color-background-surface)); }
        .thread-scroll-footer-shell::after { content: ""; background-color: var(--app-color-background-surface); }
        .thread-footer-backdrop { position: absolute; bottom: 0; width: 80%; height: 80px; background: var(--app-color-background-surface-under); pointer-events: none; }
      </style>
      <div data-app-shell-workspace-row>
        <div data-app-shell-page-surface data-app-shell-frame data-app-shell-page-sidebar>
          <div id="app-menu"><div role="menubar"><button class="muted-chrome">View</button></div></div>
          <div data-app-shell-main-surface>
            <main>
            <div data-app-shell-main-content-top-fade>
            <div id="thread-top-fade" aria-hidden="true" style="position: absolute; pointer-events: none; background-image: linear-gradient(var(--app-color-background-surface), transparent);"></div>
            <article id="message" data-markdown-text-style="assistant-message">
              <span>${"Long assistant response ".repeat(40)}</span>
              <p id="ordinary-status" class="bg-surface">Ordinary assistant status</p>
              <pre id="chat-code"><code>const chatCode = true;</code></pre>
            </article>
            <div id="user-message" data-user-message-bubble>
              User message
              <button id="user-markdown-action" class="rounded-md bg-transparent" type="button" aria-expanded="false">User markdown action</button>
            </div>
            <button id="open-changes" type="button">Open Changes</button>
            <div data-app-action-timeline-scroll>
            <div data-local-conversation-item-target-ids="fixture-activity-item">
              <div class="outline-none">
                <div class="min-w-0 text-size-chat relative overflow-visible py-0">
                  <div class="flex min-w-0 flex-col">
                    <div id="ordinary-activity-header" class="group/activity-header relative inline-flex min-w-0 max-w-full self-start items-center gap-1 p-0 text-start">
                      <button id="ordinary-activity-action" class="absolute inset-0 cursor-interaction rounded-md bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 focus-visible:outline-none focus-visible:ring-inset" type="button" aria-expanded="false">Toggle activity</button>
                      <span id="ordinary-activity-icon" aria-hidden="true">◆</span>
                      <span class="inline-flex min-w-0 gap-2 items-center shrink truncate text-size-chat pointer-events-none relative">
                        <span class="min-w-0 flex-1 truncate">
                          <span id="ordinary-activity-text" class="block min-w-0 max-w-full flex-1 truncate">${"Long ordinary execution explanation ".repeat(18)}</span>
                        </span>
                      </span>
                      <span aria-hidden="true">›</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <section data-testid="webmcp-tool-scroll" class="bg-surface">
              <button id="tool-action" class="rounded-md bg-transparent" type="button" aria-expanded="false">Toggle tool</button>
              <div id="tool-details">Tool details</div>
            </section>
            <div data-turn-key="fixture-tool-turn">
              <div>
                <div>
                  <div data-local-conversation-item-target-ids="fixture-tool-item">
                    <div>
                      <div>
                        <div>
                          <div id="legacy-tool-row" class="relative min-w-0 gap-1">
                            <button class="rounded-md bg-transparent" type="button" aria-expanded="false">Legacy timeline tool</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <section data-summary-panel-variant class="bg-surface">Summary row</section>
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
            </div>
            </main>
            <header data-app-shell-titlebar>Chat toolbar</header>
          </div>
        </div>
        <aside data-app-shell-trailing-sidebar hidden><div class="h-full min-w-0"><header><div role="tablist" aria-label="Workspace panels"><button id="changes-tab" role="tab" aria-selected="true">Changes</button><button id="files-tab" role="tab" aria-selected="false">Files</button></div><button id="close-changes" type="button">Close</button></header><section id="files-panel" hidden><file-tree-container>src</file-tree-container></section><section id="changes-panel" data-testid="diff-preview-scroll" data-thread-find-target="review"><div class="composer-diff-simple-line"><pre><code id="code"><span id="deletion-line" data-line-type="change-deletion" aria-label="Deleted line"></span><span id="addition-line" data-line-type="change-addition" aria-label="Added line"></span>const visible = true;</code></pre></div></section></div></aside>
      </div>
      <aside data-app-shell-page-sidebar>
        <nav data-app-navigation-rail><button data-sidebar-destination class="muted-chrome">Home</button></nav>
        <div data-slate-sidebar-content><button id="project-action" class="muted-chrome">Project</button></div>
      </aside>
      <div data-app-shell-pane-content-viewport><pre id="editor">editor</pre></div>
      <div data-browser-sidebar-webview hidden><webview></webview></div>
      <section role="dialog" id="settings-dialog"><button id="dialog-action">Dialog</button></section>
      </html>
      <script>
        const sidebar = document.querySelector('[data-app-shell-trailing-sidebar]');
        document.querySelector('#open-changes').addEventListener('click', () => { sidebar.hidden = false; });
        document.querySelector('#close-changes').addEventListener('click', () => { sidebar.hidden = true; });
        const changesTab = document.querySelector('#changes-tab');
        const filesTab = document.querySelector('#files-tab');
        const changesPanel = document.querySelector('#changes-panel');
        const filesPanel = document.querySelector('#files-panel');
        const selectPanel = (changes) => {
          changesTab.setAttribute('aria-selected', String(changes));
          filesTab.setAttribute('aria-selected', String(!changes));
          changesPanel.hidden = !changes;
          filesPanel.hidden = changes;
        };
        changesTab.addEventListener('click', () => selectPanel(true));
        filesTab.addEventListener('click', () => selectPanel(false));
      </script>`
  );
}

async function startChromeFixture() {
  return startHtmlFixture(
    `<!doctype html>
      <html data-theme="dark">
      <title>Codex window chrome fixture</title>
      <style>
        :root {
          --app-color-background-surface: rgb(24 24 28);
          --app-color-background-surface-under: rgb(12 12 16);
          --app-color-text-foreground: rgb(245 245 250);
          --color-text-secondary: rgb(255 255 255 / .65);
          --color-text-tertiary: rgb(255 255 255 / .5);
          color-scheme: dark;
        }
        :root[data-theme="light"] {
          --app-color-background-surface: rgb(247 247 249);
          --app-color-background-surface-under: rgb(232 232 237);
          --app-color-text-foreground: rgb(20 20 24);
          --color-text-secondary: rgb(0 0 0 / .65);
          --color-text-tertiary: rgb(0 0 0 / .5);
          color-scheme: light;
        }
        body { margin: 0; height: 100vh; background: rgb(70 30 90); color: var(--app-color-text-foreground); }
        [data-app-shell-workspace-row] {
          height: 100vh;
        }
        [data-app-shell-frame] {
          position: relative;
          display: grid;
          grid-template-columns: 52px 188px minmax(0, 1fr);
          width: 100%;
          height: 100%;
          min-height: 0;
          padding-top: 36px;
          box-sizing: border-box;
          background: var(--app-color-background-surface);
        }
        #app-menu { position: absolute; inset: 0 0 auto; z-index: 30; height: 36px; }
        [data-app-navigation-rail], [data-slate-sidebar-content] {
          padding: 12px 8px;
        }
        [data-app-navigation-rail] { grid-column: 1; grid-row: 1; }
        [data-slate-sidebar-content] { grid-column: 2; grid-row: 1; }
        [data-app-shell-main-surface] {
          grid-column: 3;
          grid-row: 1;
          min-width: 0;
          background: var(--app-color-background-surface);
        }
        .content { padding: 72px 24px 24px; }
        .muted-chrome { color: var(--color-text-tertiary); }
        @layer host {
          [data-app-shell-titlebar] {
            position: fixed;
            top: 36px;
            right: 0;
            left: 240px;
            z-index: 30;
            display: flex;
            align-items: center;
            gap: 8px;
            height: 52px;
            padding: 0 12px;
            pointer-events: none;
            -webkit-app-region: drag;
          }
          [data-app-shell-titlebar] button {
            position: relative;
            pointer-events: auto;
            -webkit-app-region: no-drag;
          }
        }
        [role="menu"] { position: absolute; top: 36px; left: 12px; padding: 6px; }
        [hidden] { display: none !important; }
      </style>
      <div data-app-shell-workspace-row>
        <div data-app-shell-frame data-app-shell-page-surface data-app-shell-page-sidebar>
          <div id="app-menu">
            <div role="menubar"><button id="view-menu" class="muted-chrome">View</button></div>
            <div id="view-options" role="menu" hidden>View options</div>
          </div>
          <nav data-app-navigation-rail><button id="home-action" class="muted-chrome">Home</button></nav>
          <div data-slate-sidebar-content><button id="project-action" class="muted-chrome">Project</button></div>
          <main data-app-shell-main-surface>
            <div class="content">Chat canvas</div>
          </main>
          <header data-app-shell-titlebar>
            <button id="chat-title">Current chat</button>
          </header>
        </div>
      </div>
      <script>
        document.querySelector("#view-menu").addEventListener("click", () => {
          document.querySelector("#view-options").hidden = false;
        });
        document.querySelector("#chat-title").addEventListener("click", (event) => {
          event.currentTarget.dataset.clicked = "true";
          document.querySelector("#view-options").hidden = true;
        });
      </script>
      </html>`
  );
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

async function startBrowserFixture(t, fixture = null) {
  fixture ??= await startFixture();
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

async function clickAtElementCenter(port, options, selector) {
  const target = await evaluateInPage(
    port,
    `(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      const rect = control.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, receivesClick: hit === control || control.contains(hit) };
    })()`,
    options
  );
  for (const type of ["mousePressed", "mouseReleased"]) {
    await callMainPage(
      port,
      "Input.dispatchMouseEvent",
      { type, x: target.x, y: target.y, button: "left", clickCount: 1 },
      options.page,
      true
    );
  }
  return target.receivesClick;
}

test("window chrome keeps wallpaper sharp and native titlebar interactive", async (t) => {
  const fixture = await startChromeFixture();
  const { port } = await startBrowserFixture(t, fixture);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: { version: 1, library: [] },
  };
  const readTitlebar = `(() => {
    const bar = document.querySelector("[data-app-shell-titlebar]");
    const style = getComputedStyle(bar);
    return [style.position, style.zIndex, style.getPropertyValue("-webkit-app-region"),
      getComputedStyle(bar.firstElementChild).getPropertyValue("-webkit-app-region"),
      bar.getBoundingClientRect().toJSON()];
  })()`;
  await waitForPage(port, options);
  const nativeTitlebar = await evaluateInPage(port, readTitlebar, options);
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(port, readTitlebar, options),
    nativeTitlebar
  );

  await clickAtElementCenter(port, options, "#view-menu");
  assert.equal(
    await evaluateInPage(
      port,
      '!document.querySelector("#view-options").hidden',
      options
    ),
    true
  );
  await clickAtElementCenter(port, options, "#chat-title");
  assert.equal(
    await evaluateInPage(
      port,
      'document.querySelector("#chat-title").dataset.clicked === "true"',
      options
    ),
    true
  );

  const chrome = await evaluateInPage(
    port,
    `(() => {
    const frame = document.querySelector("[data-app-shell-frame]");
    const surrounds = frame.querySelectorAll(
      "#app-menu, [data-app-shell-titlebar], [data-app-navigation-rail], [data-slate-sidebar-content]"
    );
    function sample(theme) {
      document.documentElement.dataset.theme = theme;
      const paint = getComputedStyle(frame).backgroundColor;
      const alpha = Number(paint.match(/\\/\\s*([\\d.]+)\\s*\\)/)?.[1]);
      return {
        paint,
        wallpaperThroughFrame: alpha > 0 && alpha < 1,
        noOverpaint: [...surrounds].every(element => {
          const style = getComputedStyle(element);
          return style.backgroundColor === "rgba(0, 0, 0, 0)" &&
            style.backdropFilter === "none";
        })
      };
    }
    return ["dark", "light"].map(sample);
  })()`,
    options
  );
  assert.notEqual(
    chrome[0].paint,
    chrome[1].paint,
    "material follows the host theme"
  );
  assert.ok(
    chrome.every(
      ({ wallpaperThroughFrame, noOverpaint }) =>
        wallpaperThroughFrame && noOverpaint
    ),
    "shared tint stays translucent and sharp"
  );
});

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

test("failed first video shows its preview instead of a blank background", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: {
      version: 1,
      library: [
        {
          id: "fixture-broken-video",
          title: "Fixture Broken Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23fb923c'/%3E%3C/svg%3E",
          assetDataUrl: "data:video/mp4;base64,AA==",
          reason: "video-preview-fallback",
        },
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-broken-video" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fps: 30,
          volume: 0,
          rotationMinutes: 0
        }
      })
    )`,
    options
  );
  assert.equal((await applyStaticBackground(port, options)).state, "enabled");
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const media = root.querySelector(".media:not(.staged)");
        return {
          previewShown: media
            ?.querySelector("img")
            ?.src.includes("fb923c"),
          mediaCount: root.querySelectorAll(".media:not(.staged)").length,
          playerCount: globalThis.__codexWallpaperApi.state().playerCount,
          status: controls.querySelector(".runtime-status")?.textContent
        };
      })()`,
      options
    ),
    {
      previewShown: true,
      mediaCount: 1,
      playerCount: 0,
      status: "视频加载失败，已使用预览",
    }
  );
});

test("disable cancels a staged video before its first frame can commit", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: {
      version: 1,
      library: [
        {
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: `data:video/mp4;base64,${tinyMp4}`,
          reason: null,
        },
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `(() => {
      localStorage.setItem(
        "codex-wallpaper-p1-config",
        JSON.stringify({
          enabled: true,
          active: { kind: "workshop", id: "fixture-video" },
          favorites: [],
          playlist: [],
          settings: { dim: 18, blur: 0, opacity: 100, fps: 30, volume: 0, rotationMinutes: 0 }
        })
      );
      globalThis.__t02OriginalFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      globalThis.__t02OriginalCancelFrameCallback =
        HTMLVideoElement.prototype.cancelVideoFrameCallback;
      globalThis.__t02PendingFrame = null;
      HTMLVideoElement.prototype.requestVideoFrameCallback = (callback) => {
        globalThis.__t02PendingFrame = callback;
        return 1;
      };
      HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
    })()`,
    options
  );
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (typeof globalThis.__t02PendingFrame === "function") break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const stagedBefore = root.querySelectorAll(".media.staged").length;
        const pendingFrame = globalThis.__t02PendingFrame;
        await globalThis.__codexWallpaperApi.disable();
        pendingFrame?.(performance.now(), {});
        await new Promise((resolve) => setTimeout(resolve, 50));
        const state = globalThis.__codexWallpaperApi.state();
        const result = {
          stagedBefore,
          state: state.state,
          root: document.querySelectorAll("#${rootId}").length,
          mediaAfter: document.querySelectorAll(
            "#${rootId} [data-codex-wallpaper-layer] .media"
          ).length,
          videoAfter: document.querySelectorAll("#${rootId} video").length,
          playerCount: state.playerCount
        };
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          globalThis.__t02OriginalFrameCallback;
        HTMLVideoElement.prototype.cancelVideoFrameCallback =
          globalThis.__t02OriginalCancelFrameCallback;
        return result;
      })()`,
      options
    ),
    {
      stagedBefore: 1,
      state: "disabled",
      root: 0,
      mediaAfter: 0,
      videoAfter: 0,
      playerCount: 0,
    }
  );
});

test("continuous slider input previews immediately and persists the settled value once", async (t) => {
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
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fps: 30,
          volume: 0,
          rotationMinutes: 0
        }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);

  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        controls.querySelector("[data-codex-wallpaper-settings]").click();
        controls.querySelector(
          "[data-panel-region='appearance']"
        ).open = true;
        const opacity = [...controls.querySelectorAll(".range")].find(
          (range) => range.querySelector("span")?.textContent === "不透明度"
        ).querySelector("input");
        const originalSetItem = Storage.prototype.setItem;
        let configWrites = 0;
        Storage.prototype.setItem = function (key, value) {
          if (key === "codex-wallpaper-p1-config") configWrites += 1;
          return originalSetItem.call(this, key, value);
        };
        opacity.focus();
        for (let value = 21; value <= 50; value += 1) {
          opacity.value = String(value);
          opacity.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const previewBeforeSettle =
          root.querySelector("[data-codex-wallpaper-layer]").style.opacity;
        const savedBeforeSettle = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        opacity.blur();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const writesAfterBlur = configWrites;
        const savedAfterBlur = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        controls.querySelector("[data-codex-wallpaper-panel] header button").click();
        controls.querySelector("[data-codex-wallpaper-settings]").click();
        const reopenedOpacity = [...controls.querySelectorAll(".range")]
          .find(
            (range) => range.querySelector("span")?.textContent === "不透明度"
          )
          .querySelector("input").value;
        const pendingLocal = [...controls.querySelectorAll(".range")]
          .find(
            (range) => range.querySelector("span")?.textContent === "不透明度"
          )
          .querySelector("input");
        pendingLocal.focus();
        pendingLocal.value = "40";
        pendingLocal.dispatchEvent(new Event("input", { bubbles: true }));
        const localBeforeRemote = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        const beforeRemoteEvent = localStorage.getItem(
          "codex-wallpaper-p1-config"
        );
        const remoteDuringLocalEdit = JSON.stringify({
          ...JSON.parse(beforeRemoteEvent),
          settings: {
            ...JSON.parse(beforeRemoteEvent).settings,
            opacity: 65,
            volume: 80
          }
        });
        localStorage.setItem(
          "codex-wallpaper-p1-config",
          remoteDuringLocalEdit
        );
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            oldValue: beforeRemoteEvent,
            newValue: remoteDuringLocalEdit,
            storageArea: localStorage
          })
        );
        const afterCombinedSave = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        const displayedVolume = [...controls.querySelectorAll(".range")]
          .find((range) => range.querySelector("span")?.textContent === "音量")
          .querySelector("input").value;
        const displayedOpacityAfterCombinedSave = pendingLocal.value;
        const stateVolumeAfterCombinedSave =
          globalThis.__codexWallpaperApi.state().volume;
        const remoteAfterLocalSettled = JSON.stringify({
          ...JSON.parse(remoteDuringLocalEdit),
          settings: {
            ...JSON.parse(remoteDuringLocalEdit).settings,
            opacity: 80,
            volume: 60
          }
        });
        localStorage.setItem(
          "codex-wallpaper-p1-config",
          remoteAfterLocalSettled
        );
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            oldValue: remoteDuringLocalEdit,
            newValue: remoteAfterLocalSettled,
            storageArea: localStorage
          })
        );
        const remoteApplied = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        const remoteVolumeApplied = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.volume;
        Storage.prototype.setItem = originalSetItem;
        return {
          previewBeforeSettle,
          savedBeforeSettle,
          writesAfterBlur,
          savedAfterBlur,
          reopenedOpacity,
          localBeforeRemote,
          localOpacityAfterCombinedSave: afterCombinedSave.settings.opacity,
          remoteVolumeAfterCombinedSave: afterCombinedSave.settings.volume,
          displayedOpacityAfterCombinedSave,
          displayedVolumeAfterCombinedSave: displayedVolume,
          stateVolumeAfterCombinedSave,
          remoteApplied,
          remoteVolumeApplied,
          displayedAfterRemote: pendingLocal.value
        };
      })()`,
      options
    ),
    {
      previewBeforeSettle: "0.5",
      savedBeforeSettle: 100,
      writesAfterBlur: 1,
      savedAfterBlur: 50,
      reopenedOpacity: "50",
      localBeforeRemote: 50,
      localOpacityAfterCombinedSave: 40,
      remoteVolumeAfterCombinedSave: 80,
      displayedOpacityAfterCombinedSave: "40",
      displayedVolumeAfterCombinedSave: "80",
      stateVolumeAfterCombinedSave: 80,
      remoteApplied: 80,
      remoteVolumeApplied: 60,
      displayedAfterRemote: "80",
    }
  );
});

test("cross-window settings update in place without rebuilding cards or media", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: {
      version: 1,
      library: [
        {
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: `data:video/mp4;base64,${tinyMp4}`,
          reason: null,
        },
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
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `(() => {
      localStorage.setItem(
        "codex-wallpaper-p1-config",
        JSON.stringify({
          enabled: true,
          active: { kind: "workshop", id: "fixture-video" },
          favorites: [],
          playlist: [],
          settings: {
            dim: 18,
            blur: 0,
            opacity: 100,
            fps: 30,
            volume: 0,
            rotationMinutes: 0
          }
        })
      );
      const original = HTMLVideoElement.prototype.requestVideoFrameCallback;
      globalThis.__t03OriginalFrameCallback = original;
      globalThis.__t03PendingFrame = null;
      HTMLVideoElement.prototype.requestVideoFrameCallback = (callback) => {
        globalThis.__t03PendingFrame = callback;
        return 1;
      };
    })()`,
    options
  );
  await applyStaticBackground(port, options);

  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const controls = document.getElementById("${controlRootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const stagedVideo = root.querySelector(".media.staged video");
          if (
            typeof globalThis.__t03PendingFrame === "function" &&
            stagedVideo?.readyState >= 2
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        globalThis.__t03PendingFrame?.(performance.now(), {});
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (root.querySelector(".media:not(.staged) video")) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        controls.querySelector("[data-codex-wallpaper-settings]").click();
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
        panel.querySelector("[data-panel-region='playback']").open = true;
        const settings = controls.querySelector(".settings-grid");
        const cards = [...controls.querySelectorAll(".card")];
        const media = root.querySelector(".media");
        const volume = [...controls.querySelectorAll(".range")].find(
          (range) => range.querySelector("span")?.textContent === "音量"
        ).querySelector("input");
        volume.focus();
        panel.scrollTop = 60;
        let cardAdds = 0;
        let mediaMutations = 0;
        const cardObserver = new MutationObserver((records) => {
          cardAdds += records.reduce(
            (count, record) => count + record.addedNodes.length,
            0
          );
        });
        const mediaObserver = new MutationObserver((records) => {
          mediaMutations += records.reduce(
            (count, record) => count + record.addedNodes.length,
            0
          );
        });
        cardObserver.observe(panel.querySelector(".wallpaper-list"), {
          childList: true
        });
        mediaObserver.observe(root.querySelector("[data-codex-wallpaper-layer]"), {
          childList: true,
          subtree: true
        });
        const previous = localStorage.getItem("codex-wallpaper-p1-config");
        const next = JSON.stringify({
          ...JSON.parse(previous),
          favorites: [{ kind: "workshop", id: "fixture-video" }],
          playlist: [
            { kind: "workshop", id: "fixture-video" },
            { kind: "workshop", id: "fixture-image" }
          ],
          settings: {
            dim: 42,
            blur: 6,
            opacity: 73,
            fps: 15,
            volume: 40,
            rotationMinutes: 0
          }
        });
        localStorage.setItem("codex-wallpaper-p1-config", next);
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            oldValue: previous,
            newValue: next,
            storageArea: localStorage
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        cardObserver.disconnect();
        mediaObserver.disconnect();
        const video = root.querySelector(".media:not(.staged) video");
        const result = {
          cardsSame:
            cards.length === controls.querySelectorAll(".card").length &&
            cards.every((card, index) =>
              card === controls.querySelectorAll(".card")[index]),
          cardAdds,
          mediaSame: media === root.querySelector(".media"),
          mediaMutations,
          staged: root.querySelectorAll(".media.staged").length,
          opacity:
            root.querySelector("[data-codex-wallpaper-layer]").style.opacity,
          filter: media.style.filter,
          videoVolume: video?.volume,
          videoMuted: video?.muted,
          panelOpen: panel.classList.contains("open"),
          panelScrollTop: panel.scrollTop,
          volumeFocused: document.activeElement === volume,
          settingsSame:
            settings === controls.querySelector(".settings-grid"),
          favoritePressed: controls
            .querySelector(
              ".card[data-entry-id='fixture-video'] [data-entry-action='favorite']"
            )
            .getAttribute("aria-pressed"),
          queueLabel: controls
            .querySelector(
              ".card[data-entry-id='fixture-video'] [data-entry-action='queue']"
            ).textContent,
          playlistSummary:
            controls.querySelector(".playlist-summary").textContent,
          stateFps: globalThis.__codexWallpaperApi.state().fpsCap,
          profile: controls.querySelector("[data-playback-profile]").value,
          opacityValue: [...controls.querySelectorAll(".range")]
            .find(
              (range) => range.querySelector("span")?.textContent === "不透明度"
            )
            .querySelector("input").value
        };
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          globalThis.__t03OriginalFrameCallback;
        return result;
      })()`,
      options
    ),
    {
      cardsSame: true,
      cardAdds: 0,
      mediaSame: true,
      mediaMutations: 0,
      staged: 0,
      opacity: "0.73",
      filter: "blur(6px)",
      videoVolume: 0.4,
      videoMuted: false,
      panelOpen: true,
      panelScrollTop: 60,
      volumeFocused: true,
      settingsSame: true,
      favoritePressed: "true",
      queueLabel: "移除轮播",
      playlistSummary: "轮播：Fixture Video · Fixture Image",
      stateFps: 15,
      profile: "custom",
      opacityValue: "73",
    }
  );
});

test("cross-window asset identity change still reloads the wallpaper", async (t) => {
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
          id: "fixture-image-next",
          title: "Fixture Image Next",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23123456'/%3E%3C/svg%3E",
          assetDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23123456'/%3E%3C/svg%3E",
          reason: null,
        },
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fps: 30,
          volume: 0,
          rotationMinutes: 0
        }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);

  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.src.includes("5d32b8") && image.complete) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const oldImage = root.querySelector(".media:not(.staged) img");
        const previous = localStorage.getItem("codex-wallpaper-p1-config");
        const next = JSON.stringify({
          ...JSON.parse(previous),
          active: { kind: "workshop", id: "fixture-image-next" }
        });
        localStorage.setItem("codex-wallpaper-p1-config", next);
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            oldValue: previous,
            newValue: next,
            storageArea: localStorage
          })
        );
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.src.includes("123456") && image.complete) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const nextImage = root.querySelector(".media:not(.staged) img");
        return {
          imageReplaced: oldImage !== nextImage,
          nextImageVisible: nextImage?.src.includes("123456") ?? false,
          staged: root.querySelectorAll(".media.staged").length,
          active: globalThis.__codexWallpaperApi.state().activeId
        };
      })()`,
      options
    ),
    {
      imageReplaced: true,
      nextImageVisible: true,
      staged: 0,
      active: "fixture-image-next",
    }
  );
});

test("opening and closing the mounted panel does not rebuild wallpaper cards", async (t) => {
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
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const controls = document.getElementById("${controlRootId}");
        const button = controls.querySelector("[data-codex-wallpaper-settings]");
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
        const list = panel.querySelector(".wallpaper-list");
        const cards = [...list.querySelectorAll(".card")];
        let addedCards = 0;
        const observer = new MutationObserver((records) => {
          addedCards += records.reduce(
            (count, record) =>
              count +
              [...record.addedNodes].filter((node) =>
                node.matches?.(".card")).length,
            0
          );
        });
        observer.observe(list, { childList: true });
        button.click();
        const opened = panel.classList.contains("open");
        button.click();
        const closed = !panel.classList.contains("open");
        button.click();
        const reopened = panel.classList.contains("open");
        await new Promise((resolve) => setTimeout(resolve, 20));
        observer.disconnect();
        return {
          opened,
          closed,
          reopened,
          sameCards:
            cards.length === list.querySelectorAll(".card").length &&
            cards.every((card, index) =>
              card === list.querySelectorAll(".card")[index]),
          addedCards
        };
      })()`,
      options
    ),
    {
      opened: true,
      closed: true,
      reopened: true,
      sameCards: true,
      addedCards: 0,
    }
  );
});

test("wallpaper library shell combines filters without reloading the current media", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
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
          previewDataUrl: preview,
          assetDataUrl: preview,
          reason: null,
        },
        {
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl: preview,
          assetDataUrl: null,
          reason: null,
        },
        {
          id: "fixture-scene",
          title: "Fixture Scene",
          type: "scene",
          playable: true,
          fallback: true,
          previewDataUrl: preview,
          assetDataUrl: "data:application/octet-stream;base64,AA==",
          reason: "scene-native",
        },
        {
          id: "fixture-web-fallback",
          title: "Fixture Web Fallback",
          type: "web",
          playable: false,
          fallback: true,
          previewDataUrl: preview,
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
          previewDataUrl: preview,
          assetDataUrl: null,
          reason: "asset-not-loaded",
        },
        {
          id: "fixture-on-demand-next",
          title: "Fixture On Demand Next",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl: preview,
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
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fps: 30,
          volume: 0,
          rotationMinutes: 0
        }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);

  const result = await evaluateInPage(
    port,
    `(async () => {
      const controls = document.getElementById("${controlRootId}");
      const root = document.getElementById("${rootId}");
      const hostRequests = [];
      globalThis.__codexWallpaperHostRequest = (raw) => {
        hostRequests.push(JSON.parse(raw));
      };
      controls.querySelector("[data-codex-wallpaper-settings]").click();
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.style.maxHeight = "220px";
      const media = root.querySelector("[data-codex-wallpaper-layer] .media");
      let stableMediaChild = null;
      let mediaMutations = 0;
      const observer = new MutationObserver((records) => {
        mediaMutations += records.length;
      });
      observer.observe(media, { childList: true, subtree: true });

      const regionNames = [...panel.querySelectorAll("[data-panel-region]")].map(
        (region) => region.dataset.panelRegion
      );
      const search = panel.querySelector("[data-library-search]");
      const type = panel.querySelector("[data-library-type]");
      const favorites = panel.querySelector("[data-library-favorites]");

      search.value = "fixture image";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 80));
      search.value = "lazy";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      panel
        .querySelector(".card[data-entry-id='fixture-lazy']")
        .scrollIntoView({ block: "center" });
      let lazyPreviewRequested = false;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        lazyPreviewRequested = hostRequests.some(
          (request) =>
            request.type === "load-preview" && request.id === "fixture-lazy"
        );
        if (lazyPreviewRequested) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));

      const imageCard = panel.querySelector(
        ".card[data-entry-id='fixture-image']"
      );
      imageCard
        .querySelector("[data-entry-action='favorite']")
        .click();
      imageCard.querySelector("[data-entry-action='queue']").click();

      search.value = "fixture";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      type.value = "image";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      favorites.click();
      const visibleTitles = [...panel.querySelectorAll(".card")]
        .filter((card) => !card.hidden)
        .map((card) => card.querySelector("strong").textContent);
      const resultText = panel.querySelector("[data-library-result]").textContent;

      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      type.value = "all";
      type.dispatchEvent(new Event("change", { bubbles: true }));
      favorites.click();
      const cardStatus = (id) =>
        panel
          .querySelector(\`.card[data-entry-id="\${id}"] [data-card-status]\`)
          ?.textContent;
      const statuses = {
        scene: cardStatus("fixture-scene"),
        webFallback: cardStatus("fixture-web-fallback"),
        onDemand: cardStatus("fixture-on-demand")
      };

      const fileInput = panel.querySelector(".import-row input");
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(
          ["<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/>"],
          "Imported Sunset.svg",
          { type: "image/svg+xml" }
        )
      );
      fileInput.files = transfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (globalThis.__codexWallpaperApi.state().importedCount > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      search.value = "sunset";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      const importedFilterVisible = [...panel.querySelectorAll(".card")]
        .filter((card) => !card.hidden)
        .some(
          (card) => card.querySelector("strong")?.textContent ===
            "Imported Sunset.svg"
        );
      search.value = "";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      panel
        .querySelector(
          ".card[data-entry-id='fixture-on-demand'] [data-entry-action='use']"
        )
        .click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const loadingStatus = cardStatus("fixture-on-demand");
      globalThis.__codexWallpaperApi.receiveAsset({
        id: "fixture-on-demand",
        title: "Fixture On Demand",
        type: "image",
        playable: true,
        fallback: false,
        previewDataUrl:
          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
        assetDataUrl:
          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23fb923c'/%3E%3C/svg%3E",
        reason: null
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const loadedStatus = cardStatus("fixture-on-demand");
      panel
        .querySelector(
          ".card[data-entry-id='fixture-on-demand-next'] [data-entry-action='use']"
        )
        .click();
      await new Promise((resolve) => setTimeout(resolve, 25));
      const newerLoadingStatus = cardStatus("fixture-on-demand-next");
      globalThis.__codexWallpaperApi.receiveAssetError(
        "fixture-on-demand",
        "old request failed"
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      const newerAfterOldFailure = cardStatus("fixture-on-demand-next");
      globalThis.__codexWallpaperApi.receiveAssetError(
        "fixture-on-demand-next",
        "new request failed"
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      const failedStatus = cardStatus("fixture-on-demand-next");
      panel
        .querySelector(".card[data-entry-id='fixture-image'] [data-entry-action='use']")
        .click();
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const image = root.querySelector(".media:not(.staged) img");
        if (image?.src.includes("5d32b8") && globalThis.__codexWallpaperApi.state().activeId === "fixture-image")
          break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      stableMediaChild = media.firstElementChild;
      mediaMutations = 0;

      const cards = [...panel.querySelectorAll(".card")];
      panel.style.width = "280px";
      panel.style.maxHeight = "320px";
      search.focus();
      const keyboardReachable =
        document.activeElement === search &&
        search.tabIndex >= 0 &&
        type.tabIndex >= 0 &&
        favorites.tabIndex >= 0;
      panel.scrollTop = panel.scrollHeight;
      const scrollable =
        getComputedStyle(panel).overflowY === "auto" &&
        panel.scrollHeight > panel.clientHeight &&
        panel.scrollTop > 0;

      const close = panel.querySelector("header button");
      close.click();
      controls.querySelector("[data-codex-wallpaper-settings]").click();
      const reopenedImageCard = panel.querySelector(
        ".card[data-entry-id='fixture-image']"
      );
      observer.disconnect();
      return {
        regionNames,
        visibleTitles,
        resultText,
        statuses,
        importedFilterVisible,
        lazyPreviewRequested,
        loadingStatus,
        loadedStatus,
        newerLoadingStatus,
        newerAfterOldFailure,
        failedStatus,
        keyboardReachable,
        scrollable,
        reopened: panel.classList.contains("open"),
        sameCards: cards.every(
          (card, index) => card === panel.querySelectorAll(".card")[index]
        ),
        sameMediaChild: media.firstElementChild === stableMediaChild,
        mediaMutations,
        favoriteRetained:
          reopenedImageCard
            .querySelector("[data-entry-action='favorite']")
            .getAttribute("aria-pressed") === "true",
        queueRetained:
          reopenedImageCard
            .querySelector("[data-entry-action='queue']")
            .getAttribute("aria-pressed") === "true"
      };
    })()`,
    options
  );

  assert.deepEqual(result, {
    regionNames: ["library", "playback", "appearance", "recovery"],
    visibleTitles: ["Fixture Image"],
    resultText: "显示 1 / 7 项",
    statuses: {
      scene: "scene · 原生渲染",
      webFallback: "web · 预览降级",
      onDemand: "image · 按需加载",
    },
    importedFilterVisible: true,
    lazyPreviewRequested: true,
    loadingStatus: "image · 加载中",
    loadedStatus: "image · 原生显示",
    newerLoadingStatus: "image · 加载中",
    newerAfterOldFailure: "image · 加载中",
    failedStatus: "image · 加载失败",
    keyboardReachable: true,
    scrollable: true,
    reopened: true,
    sameCards: true,
    sameMediaChild: true,
    mediaMutations: 0,
    favoriteRetained: true,
    queueRetained: true,
  });
});

test("playback profiles and capability controls apply without replacing media", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
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
          previewDataUrl: image,
          assetDataUrl: image,
          reason: null,
        },
        {
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl: image,
          assetDataUrl: `data:video/mp4;base64,${tinyMp4}`,
          reason: null,
        },
        {
          id: "fixture-scene",
          title: "Fixture Scene",
          type: "scene",
          playable: true,
          fallback: true,
          previewDataUrl: image,
          assetDataUrl: "data:application/octet-stream;base64,AA==",
          reason: "scene-native",
        },
        {
          id: "fixture-web",
          title: "Fixture Web",
          type: "web",
          playable: false,
          fallback: true,
          previewDataUrl: image,
          assetDataUrl: null,
          webHtml:
            "<!doctype html><style>body{margin:0;background:linear-gradient(45deg,#123,#abc)}</style>",
          reason: "web-offline",
        },
      ],
    },
  };
  await waitForPage(port, options);
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fps: 30,
          volume: 60,
          muted: true,
          rotationMinutes: 0,
          performanceProfile: "balanced",
          pauseWhenHidden: true
        }
      })
    )`,
    options
  );
  await evaluateInPage(
    port,
    `(() => {
      globalThis.WebWallGL = {
        bytesSource: () => ({}),
        createScene: (host, options) => {
          globalThis.__t05SceneFps = options.fps;
          const canvas = document.createElement("canvas");
          canvas.dataset.sceneCanvas = "";
          host.append(canvas);
          return {
            load: () => {
              globalThis.__t05SceneLoaded = true;
              return Promise.resolve();
            },
            pause: () => {
              globalThis.__t05ScenePaused = true;
            },
            resume: () => {
              globalThis.__t05SceneResumed = true;
            },
            setFps: (fps) => {
              globalThis.__t05SceneFps = fps;
            },
            setVolume: (volume) => {
              globalThis.__t05SceneVolume = volume;
            },
            destroy() {}
          };
        }
      };
    })()`,
    options
  );
  await applyStaticBackground(port, options);

  const result = await evaluateInPage(
    port,
    `(async () => {
      const root = document.getElementById("${rootId}");
      const controls = document.getElementById("${controlRootId}");
      controls.querySelector("[data-codex-wallpaper-settings]").click();
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.querySelector("[data-panel-region='playback']").open = true;

      const initial = {
        profile: panel.querySelector("[data-playback-profile]").value,
        summary: panel.querySelector("[data-performance-summary]").textContent,
        capability: panel.querySelector("[data-playback-capability]").textContent,
        fpsControl: Boolean(panel.querySelector("[data-setting='fps']"))
      };

      const selectMedia = async (id, ready) => {
        panel
          .querySelector(\`.card[data-entry-id="\${id}"] [data-entry-action='use']\`)
          .click();
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (ready()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error(\`Timed out selecting \${id}\`);
      };

      await selectMedia(
        "fixture-video",
        () => Boolean(root.querySelector(".media:not(.staged) video"))
      );
      const videoMedia = root.querySelector(".media:not(.staged)");
      const video = videoMedia.querySelector("video");
      const volume = panel.querySelector("[data-setting='volume']");
      volume.value = "45";
      volume.dispatchEvent(new Event("input", { bubbles: true }));
      volume.dispatchEvent(new Event("change", { bubbles: true }));
      const mute = panel.querySelector("[data-setting='muted']");
      const unmutedByVolume =
        mute.checked === false && video.muted === false && video.volume === 0.45;
      mute.click();
      const muteRoundTrip = video.muted === true && video.volume === 0;
      mute.click();
      const videoControls = {
        volume: video.volume,
        muted: video.muted,
        unmutedByVolume,
        muteRoundTrip,
        fpsControl: Boolean(panel.querySelector("[data-setting='fps']")),
        capability: panel.querySelector("[data-playback-capability]").textContent
      };

      const profile = panel.querySelector("[data-playback-profile]");
      profile.value = "performance";
      profile.dispatchEvent(new Event("change", { bubbles: true }));
      const priority = {
        stateFps: globalThis.__codexWallpaperApi.state().fpsCap,
        profile: panel.querySelector("[data-playback-profile]").value,
        summary: panel.querySelector("[data-performance-summary]").textContent,
        mediaSame: root.querySelector(".media:not(.staged)") === videoMedia
      };

      await selectMedia(
        "fixture-scene",
        () => Boolean(root.querySelector(".media:not(.staged) .scene-host.ready"))
      );
      const sceneFpsFromProfile = globalThis.__t05SceneFps;
      const fps = panel.querySelector("[data-setting='fps']");
      fps.value = "30";
      fps.dispatchEvent(new Event("input", { bubbles: true }));
      fps.dispatchEvent(new Event("change", { bubbles: true }));
      const custom = {
        profile: panel.querySelector("[data-playback-profile]").value,
        fps: fps.value,
        sceneFps: globalThis.__t05SceneFps,
        summary: panel.querySelector("[data-performance-summary]").textContent
      };

      globalThis.__t05ScenePaused = false;
      globalThis.__t05SceneResumed = false;
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
      const pauseEnabled = {
        paused: globalThis.__t05ScenePaused,
        resumed: globalThis.__t05SceneResumed
      };

      const hiddenPause = panel.querySelector("[data-setting='pauseWhenHidden']");
      hiddenPause.click();
      globalThis.__t05ScenePaused = false;
      globalThis.__t05SceneResumed = false;
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
      const pauseDisabled = {
        paused: globalThis.__t05ScenePaused,
        resumed: globalThis.__t05SceneResumed
      };

      await selectMedia(
        "fixture-image",
        () => Boolean(root.querySelector(".media:not(.staged) img"))
      );
      const imageCapability = {
        fpsControl: Boolean(panel.querySelector("[data-setting='fps']")),
        text: panel.querySelector("[data-playback-capability]").textContent
      };

      await selectMedia(
        "fixture-web",
        () => Boolean(root.querySelector(".media:not(.staged) iframe"))
      );
      const webCapability =
        panel.querySelector("[data-playback-capability]").textContent;

      await selectMedia(
        "fixture-image",
        () => Boolean(root.querySelector(".media:not(.staged) img"))
      );
      const syncedMedia = root.querySelector(".media:not(.staged)");
      const previous = localStorage.getItem("codex-wallpaper-p1-config");
      const next = JSON.stringify({
        ...JSON.parse(previous),
        settings: {
          ...JSON.parse(previous).settings,
          fps: 15,
          volume: 35,
          muted: false,
          performanceProfile: "performance",
          pauseWhenHidden: true
        }
      });
      localStorage.setItem("codex-wallpaper-p1-config", next);
      dispatchEvent(
        new StorageEvent("storage", {
          key: "codex-wallpaper-p1-config",
          oldValue: previous,
          newValue: next,
          storageArea: localStorage
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      const crossWindow = {
        mediaSame: root.querySelector(".media:not(.staged)") === syncedMedia,
        profile: panel.querySelector("[data-playback-profile]").value,
        volume: panel.querySelector("[data-setting='volume']").value,
        muted: panel.querySelector("[data-setting='muted']").checked,
        pauseWhenHidden: panel.querySelector(
          "[data-setting='pauseWhenHidden']"
        ).checked
      };

      panel.querySelector("header button").click();
      controls.querySelector("[data-codex-wallpaper-settings]").click();
      const saved = JSON.parse(
        localStorage.getItem("codex-wallpaper-p1-config")
      ).settings;
      const reopened = {
        profile: panel.querySelector("[data-playback-profile]").value,
        fps: panel.querySelector("[data-setting='fps']")?.value ?? null,
        volume: panel.querySelector("[data-setting='volume']").value,
        saved: {
          fps: saved.fps,
          volume: saved.volume,
          muted: saved.muted,
          performanceProfile: saved.performanceProfile,
          pauseWhenHidden: saved.pauseWhenHidden
        }
      };
      return {
        initial,
        videoControls,
        priority,
        sceneFpsFromProfile,
        custom,
        pauseEnabled,
        pauseDisabled,
        imageCapability,
        webCapability,
        crossWindow,
        reopened
      };
    })()`,
    options
  );

  assert.deepEqual(result, {
    initial: {
      profile: "balanced",
      summary: "参数：Scene 上限 30 FPS · 不可见时暂停",
      capability: "图片稳定显示后不持续绘制；帧率不适用。",
      fpsControl: false,
    },
    videoControls: {
      volume: 0.45,
      muted: false,
      unmutedByVolume: true,
      muteRoundTrip: true,
      fpsControl: false,
      capability:
        "视频按源文件解码并直接合成；性能档限制 Scene 上限，不伪造视频绘制帧率。",
    },
    priority: {
      stateFps: 15,
      profile: "performance",
      summary: "参数：Scene 上限 15 FPS · 不可见时暂停",
      mediaSame: true,
    },
    sceneFpsFromProfile: 15,
    custom: {
      profile: "custom",
      fps: "30",
      sceneFps: 30,
      summary: "参数：Scene 上限 30 FPS · 不可见时暂停",
    },
    pauseEnabled: { paused: true, resumed: true },
    pauseDisabled: { paused: false, resumed: true },
    imageCapability: {
      fpsControl: false,
      text: "图片稳定显示后不持续绘制；帧率不适用。",
    },
    webCapability: "Web iframe 内部帧率和暂停无法由父页面可靠控制。",
    crossWindow: {
      mediaSame: true,
      profile: "performance",
      volume: "35",
      muted: false,
      pauseWhenHidden: true,
    },
    reopened: {
      profile: "performance",
      fps: null,
      volume: "35",
      saved: {
        fps: 15,
        volume: 35,
        muted: false,
        performanceProfile: "performance",
        pauseWhenHidden: true,
      },
    },
  });
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
  const pressAltShiftW = async () => {
    for (const type of ["rawKeyDown", "keyUp"]) {
      await callMainPage(
        port,
        "Input.dispatchKeyEvent",
        {
          type,
          key: "W",
          code: "KeyW",
          windowsVirtualKeyCode: 87,
          nativeVirtualKeyCode: 87,
          modifiers: 9,
        },
        options.page,
        true
      );
    }
  };
  const waitForWallpaperImage = () =>
    evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = document.querySelector(
            "#${rootId} .media:not(.staged) img"
          );
          if (
            globalThis.__codexWallpaperApi.state().state === "enabled" &&
            image?.complete &&
            image.naturalWidth > 0
          )
            return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      })()`,
      options
    );

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
        const panel = document.querySelector(
          "#${controlRootId} [data-codex-wallpaper-panel]"
        );
        const card = [...panel.querySelectorAll(".card")].find(
          (item) => item.querySelector("strong")?.textContent === "Fixture Lazy"
        );
        const settings = panel.querySelector(".settings-grid").firstElementChild;
        panel.scrollTop = 80;
        await globalThis.__codexWallpaperApi.receivePreview({
          id: "fixture-lazy",
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          fallback: true
        });
        return {
          sameCard:
            [...panel.querySelectorAll(".card")].find(
              (item) => item.querySelector("strong")?.textContent === "Fixture Lazy"
            ) === card,
          sameSettings: panel.querySelector(".settings-grid").firstElementChild === settings,
          previewAttached: Boolean(card.querySelector(".thumb img")),
          placeholderRemaining: Boolean(card.querySelector(".thumb[data-preview-id]")),
          scrollTop: panel.scrollTop
        };
      })()`,
      options
    ),
    {
      sameCard: true,
      sameSettings: true,
      previewAttached: true,
      placeholderRemaining: false,
      scrollTop: 80,
    }
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
          meta: controls
            .querySelector(
              ".card[data-entry-id='fixture-web-fallback'] [data-card-status]"
            )?.textContent,
          preview:
            document.querySelector(
              "#${rootId} .media:not(.staged) img"
            )?.naturalWidth > 0,
          status: controls.querySelector(".runtime-status")?.textContent
        };
      })()`,
      options
    ),
    {
      hostRequests: 0,
      meta: "web · 预览降级",
      preview: true,
      status: "Fixture Web Fallback · Web 预览降级",
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
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = root.querySelector(".media img");
          if (
            image?.complete &&
            image.naturalWidth > 0 &&
            !image.closest(".media.staged")
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const oldImage = root.querySelector(".media img");
        const originalFrameCallback =
          HTMLVideoElement.prototype.requestVideoFrameCallback;
        let videoFrameCallback = null;
        HTMLVideoElement.prototype.requestVideoFrameCallback = (callback) => {
          videoFrameCallback = () => callback(performance.now(), {});
          return 1;
        };
        const videoCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Video"
        );
        videoCard.querySelector(".card-actions button").click();
        for (
          let attempt = 0;
          attempt < 40 &&
          (typeof videoFrameCallback !== "function" ||
            root.querySelector(".media video")?.readyState < 2);
          attempt += 1
        ) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const beforeFrame = {
          callbackAvailable: typeof videoFrameCallback === "function",
          oldFrameStillVisible: root.querySelector(".media img") === oldImage,
          fullWindowPreview: Boolean(
            root.querySelector(".media-preview")
          )
        };
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        let drawLoopFrames = 0;
        window.requestAnimationFrame = (callback) => {
          drawLoopFrames += 1;
          return originalRequestAnimationFrame(callback);
        };
        videoFrameCallback?.();
        await new Promise((resolve) => setTimeout(resolve, 120));
        window.requestAnimationFrame = originalRequestAnimationFrame;
        const canvas = root.querySelector(".media canvas");
        const video = root.querySelector(".media:not(.staged) video");
        const afterFrame = {
          oldFrameReleased: !oldImage.isConnected,
          previewGone: !root.querySelector(".media-preview"),
          videoVisible:
            video?.getBoundingClientRect().width ===
              root.querySelector(".media").clientWidth &&
            video?.getBoundingClientRect().height ===
              root.querySelector(".media").clientHeight,
          directVideo: !canvas,
          drawLoopFrames,
          objectFit: video ? getComputedStyle(video).objectFit : null,
          playerCount: globalThis.__codexWallpaperApi.state().playerCount
        };
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          originalFrameCallback;
        return { beforeFrame, afterFrame };
      })()`,
      options
    ),
    {
      beforeFrame: {
        callbackAvailable: true,
        oldFrameStillVisible: true,
        fullWindowPreview: false,
      },
      afterFrame: {
        oldFrameReleased: true,
        previewGone: true,
        videoVisible: true,
        directVideo: true,
        drawLoopFrames: 0,
        objectFit: "cover",
        playerCount: 1,
      },
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
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = root.querySelector(".media img");
          if (
            image?.src.includes("5d32b8") &&
            image.complete &&
            !image.closest(".media.staged")
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const oldImage = root.querySelector(".media img");
        globalThis.__codexWallpaperApi.receiveAsset({
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: "data:video/mp4;base64,AAAA",
          reason: null
        });
        const videoCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Video"
        );
        videoCard.querySelector(".card-actions button").click();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (
            controls
              .querySelector(".runtime-status")
              ?.textContent.includes("视频加载失败")
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const result = {
          oldFrameRetained: root.querySelector(".media img") === oldImage,
          previewShown: Boolean(root.querySelector(".media-preview")),
          status: controls.querySelector(".runtime-status")?.textContent
        };
        globalThis.__codexWallpaperApi.receiveAsset({
          id: "fixture-video",
          title: "Fixture Video",
          type: "video",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: "data:video/mp4;base64,${tinyMp4}",
          reason: null
        });
        imageCard.querySelector(".card-actions button").click();
        return result;
      })()`,
      options
    ),
    {
      oldFrameRetained: true,
      previewShown: false,
      status: "视频加载失败，已保留当前画面",
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
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (
            document.querySelector(
              "#${rootId} .media:not(.staged) video"
            )
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const videoAfterRejectedPlay =
          document.querySelector("#${rootId} video") instanceof HTMLVideoElement;
        const originalRequestAnimationFrame = window.requestAnimationFrame;
        let drawLoopFrames = 0;
        window.requestAnimationFrame = (callback) => {
          drawLoopFrames += 1;
          return originalRequestAnimationFrame(callback);
        };
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
        await new Promise((resolve) => setTimeout(resolve, 80));
        window.requestAnimationFrame = originalRequestAnimationFrame;
        const result = {
          videoAfterRejectedPlay,
          videoAfterVisible:
            document.querySelector("#${rootId} video") instanceof HTMLVideoElement,
          playCalls,
          drawLoopFrames,
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
      drawLoopFrames: 0,
      status: "Fixture Video · 视频",
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
        for (let attempt = 0; attempt < 160; attempt += 1) {
          const activeVideo = document.querySelector(
            "#${rootId} .media:not(.staged) video"
          );
          if (
            api.state().playerCount === 1 &&
            activeVideo?.src.startsWith("blob:")
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const video = document.querySelector(
          "#${rootId} .media:not(.staged) video"
        );
        return {
          playerCount: api.state().playerCount,
          blobUrl: video?.src.startsWith("blob:") ?? false
        };
      })()`,
      options
    ),
    { playerCount: 1, blobUrl: true }
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
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        const originalFrameCallback =
          HTMLVideoElement.prototype.requestVideoFrameCallback;
        HTMLVideoElement.prototype.requestVideoFrameCallback = () => 1;
        const videoCard = [...controls.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Video"
        );
        videoCard.querySelector(".card-actions button").click();
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (root.querySelector(".media:not(.staged) video")) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const result = {
          activeVideo: Boolean(root.querySelector(".media:not(.staged) video")),
          staged: root.querySelectorAll(".media.staged").length,
          preview: Boolean(root.querySelector(".media-preview"))
        };
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          originalFrameCallback;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return result;
      })()`,
      options
    ),
    { activeVideo: true, staged: 0, preview: false }
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
    { mutations: 0, playerCount: 1 }
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
        const oldImage = root.querySelector(".media img");
        const heldWhileSceneLoads =
          oldImage?.src.includes("5d32b8") &&
          !root.querySelector(".media-preview");
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
          heldWhileSceneLoads,
          imageIsCurrentAsset: image?.src.includes("5d32b8") ?? false,
          mediaCount: root.querySelectorAll(".media:not(.staged)").length,
          staged: root.querySelectorAll(".media.staged").length
        };
      })()`,
      options
    ),
    {
      activeId: "fixture-image",
      heldWhileSceneLoads: true,
      imageIsCurrentAsset: true,
      mediaCount: 1,
      staged: 0,
    }
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
        const fps = controls.querySelector("[data-setting='fps']");
        const volume = controls.querySelector("[data-setting='volume']");
        fps.value = "15";
        fps.dispatchEvent(new Event("input", { bubbles: true }));
        volume.value = "40";
        volume.dispatchEvent(new Event("input", { bubbles: true }));
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
          fillsWallpaperLayer:
            frame.getBoundingClientRect().width === frame.parentElement.clientWidth &&
            frame.getBoundingClientRect().height === frame.parentElement.clientHeight,
          sandbox: frame.getAttribute("sandbox"),
          offlineDocument: frame.srcdoc.includes("linear-gradient"),
          networkBlocked: frame.srcdoc.includes("default-src 'none'")
        };
      })()`,
      options
    ),
    {
      fillsWallpaperLayer: true,
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
        const opacity = controls.querySelector("[data-setting='opacity']");
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
  const { composerIdleShadow, ...chatResults } = await evaluateInPage(
    port,
    `(() => {
        const root = document.getElementById("${rootId}");
        const background = root.querySelector("[data-codex-wallpaper-layer]");
        const media = root.querySelector(".media");
        const controls = document.getElementById("${controlRootId}");
        const toolbar = controls.querySelector(".toolbar");
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
        const toolbarRect = toolbar.getBoundingClientRect();
        const toolbarHit = document.elementFromPoint(
          toolbarRect.right - 8,
          toolbarRect.bottom - 8
        );
        const surface = document.querySelector("[data-app-shell-main-surface]");
        const frame = document.querySelector("[data-app-shell-frame]");
        const ordinaryStatus = document.querySelector("#ordinary-status");
        const ordinaryActivity = document.querySelector("#ordinary-activity-header");
        const ordinaryActivityAction = document.querySelector(
          "#ordinary-activity-action"
        );
        const userMessage = document.querySelector("#user-message");
        const userMarkdownAction = document.querySelector("#user-markdown-action");
        const tool = document.querySelector("#tool-action");
        const details = document.querySelector("#tool-details");
        const toolSurface = tool.closest("[data-testid='webmcp-tool-scroll']");
        const summarySurface = document.querySelector(
          "[data-summary-panel-variant]"
        );
        const diffSurface = document.querySelector(
          "[data-thread-find-target='review']"
        );
        const changesCodeSurface = diffSurface.querySelector("pre");
        const codeSurface = document.querySelector("#chat-code");
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
        const openChanges = document.querySelector("#open-changes");
        openChanges.scrollIntoView({ block: "center" });
        const openChangesRect = openChanges.getBoundingClientRect();
        const openChangesHit = document.elementFromPoint(
          openChangesRect.left + openChangesRect.width / 2,
          openChangesRect.top + openChangesRect.height / 2
        );
        openChangesHit.click();
        const changesOpened = !rightPanel.hidden;
        const workspaceTabs = rightPanel.querySelector('[role="tablist"]');
        const changesTab = rightPanel.querySelector("#changes-tab");
        const filesTab = rightPanel.querySelector("#files-tab");
        const filesPanel = rightPanel.querySelector("#files-panel");
        const fileTree = rightPanel.querySelector("file-tree-container");
        const diffPaintSurface = diffSurface.querySelector(
          ".composer-diff-simple-line"
        );
        const additionLine = diffSurface.querySelector(
          "[data-line-type='change-addition']"
        );
        const deletionLine = diffSurface.querySelector(
          "[data-line-type='change-deletion']"
        );
        const toolReadabilitySurfaces = [
          toolSurface,
          summarySurface,
        ];
        const changesReadabilitySurfaces = [
          diffPaintSurface,
        ];
        const readabilitySurfaces = [
          ...toolReadabilitySurfaces,
          ...changesReadabilitySurfaces,
          codeSurface,
          composerSurface,
        ];
        const clickTab = (tab) => tab.click();
        clickTab(filesTab);
        const filesTabSelected =
          filesTab.getAttribute("aria-selected") === "true" &&
          !filesPanel.hidden &&
          diffSurface.hidden;
        clickTab(changesTab);
        const changesTabRestored =
          changesTab.getAttribute("aria-selected") === "true" &&
          filesPanel.hidden &&
          !diffSurface.hidden;
        const pane = document.querySelector(
          "[data-app-shell-pane-content-viewport]"
        );
        const dialog = document.querySelector("#settings-dialog");
        const popper = document.createElement("div");
        popper.dataset.radixPopperContentWrapper = "";
        const menu = document.createElement("div");
        menu.setAttribute("role", "menu");
        popper.append(menu);
        document.body.append(popper);
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
        ordinaryActivityAction.scrollIntoView({ block: "center" });
        ordinaryActivityAction.focus();
        const ordinaryActivityActionRect =
          ordinaryActivityAction.getBoundingClientRect();
        const ordinaryActivityActionHit = document.elementFromPoint(
          ordinaryActivityActionRect.left +
            ordinaryActivityActionRect.width / 2,
          ordinaryActivityActionRect.top +
            ordinaryActivityActionRect.height / 2
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
        const readAlpha = (element, property = "backgroundColor") => {
          const value = getComputedStyle(element)[property];
          const match =
            value.match(/\\/\\s*([\\d.]+)\\s*\\)/) ||
            value.match(/,\\s*([\\d.]+)\\s*\\)$/);
          return match ? Number(match[1]) : 1;
        };
        const themeBases = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          return [
            surface,
            ...readabilitySurfaces,
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
        const fade = document.querySelector("#thread-top-fade");
        const pixel = document.createElement("canvas").getContext("2d");
        const fadeIsTranslucent = () => {
          const gradient = getComputedStyle(fade).backgroundImage;
          const color = gradient.match(/^linear-gradient\\(((?:rgba?|color)\\([^)]*\\))/)?.[1];
          if (!color || !CSS.supports("color", color)) return false;
          pixel.clearRect(0, 0, 1, 1);
          pixel.fillStyle = color;
          pixel.fillRect(0, 0, 1, 1);
          const alpha = pixel.getImageData(0, 0, 1, 1).data[3];
          return alpha > 0 && alpha < 255;
        };
        const wallpaperVisibility = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          const surfaceAlpha = readAlpha(surface);
          const frameAlpha = readAlpha(frame);
          return {
            theme,
            frameAlpha,
            surfaceAlpha,
            compositeAlpha: 1 - (1 - frameAlpha) * (1 - surfaceAlpha),
            wallpaperOpacity: Number(getComputedStyle(media).opacity),
            translucentTopFade: fadeIsTranslucent(),
          };
        });
        return {
          translucentTopFade: wallpaperVisibility.every(({ translucentTopFade }) => translucentTopFade),
          mainWallpaperHasNoExtraBlur: getComputedStyle(surface).backdropFilter === "none",
          paneHasNoForcedBlur:
            getComputedStyle(pane).backdropFilter === "none",
          frameCarriesPageSidebarAnchor:
            frame.hasAttribute("data-app-shell-page-sidebar"),
          surfaceAboveBackground:
            Number.parseInt(getComputedStyle(surface).zIndex, 10) >
            Number.parseInt(getComputedStyle(background).zIndex, 10),
          surfaceHasReadabilityBase:
            getComputedStyle(surface).backgroundColor !== "rgba(0, 0, 0, 0)",
          contentHasReadabilityBases: readabilitySurfaces.every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
              "rgba(0, 0, 0, 0)"
          ),
          composerOuterPaintTransparent: themeFooterBackdrops.every(Boolean),
          footerLeadingHasReadabilityBase:
            getComputedStyle(footerLeading).backgroundColor !==
            "rgba(0, 0, 0, 0)",
          ordinaryChatSharesCanvas: [ordinaryStatus, userMessage].every(
            (element) => readAlpha(element) === 0
          ),
          ordinaryActivityHasNoCard:
            readAlpha(ordinaryActivity) === 0 &&
            getComputedStyle(ordinaryActivity).boxShadow === "none" &&
            getComputedStyle(ordinaryActivity).borderRadius === "0px",
          ordinaryActivityKeepsNativeInteraction:
            document.activeElement === ordinaryActivityAction &&
            ordinaryActivity.contains(ordinaryActivityActionHit) &&
            ordinaryActivityAction.getAttribute("aria-expanded") === "false",
          userMarkdownKeepsNativeState:
            userMarkdownAction.getAttribute("aria-expanded") === "false" &&
            readAlpha(userMarkdownAction) === 0,
          themesHaveReadabilityBases: themeBases.every(Boolean),
          wallpaperRemainsVisible:
            wallpaperVisibility.every(
              ({ compositeAlpha, frameAlpha, wallpaperOpacity }) =>
                compositeAlpha > frameAlpha &&
                compositeAlpha < 1 &&
                wallpaperOpacity === 1
            ),
          panelSurfacesHaveReadability: [leftPanel, pane, dialog].every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
                "rgba(0, 0, 0, 0)"
          ),
          browserSurfaceIsOpaque: (() => {
            const host = document.querySelector("[data-browser-sidebar-webview]");
            const webview = host.querySelector("webview");
            const read = () => [host, webview].map((node) => getComputedStyle(node).backgroundColor).join(" / ");
            const light = read();
            document.documentElement.dataset.theme = "dark";
            const dark = read();
            document.documentElement.dataset.theme = "light";
            return getComputedStyle(host).opacity === "1" &&
              light === "rgb(232, 232, 237) / rgb(232, 232, 237)" &&
              dark === "rgb(12, 12, 16) / rgb(12, 12, 16)";
          })(),
          wallpaperControlsUseSharedPalette:
            getComputedStyle(toolbar).backgroundColor ===
              getComputedStyle(dialog).backgroundColor &&
            getComputedStyle(panel).backgroundColor ===
              getComputedStyle(dialog).backgroundColor,
          wallpaperControlsHaveNoExtraBlur:
            getComputedStyle(toolbar).backdropFilter === "none" &&
            getComputedStyle(panel).backdropFilter === "none",
          menuPaintsOnlyVisibleContent:
            getComputedStyle(popper).backgroundColor ===
              "rgba(0, 0, 0, 0)" &&
            getComputedStyle(menu).backgroundColor ===
              getComputedStyle(dialog).backgroundColor,
          dialogKeepsHostPosition:
            getComputedStyle(dialog).position === "static" &&
            getComputedStyle(dialog).zIndex === "auto",
          changesOpened,
          changesPanelKeepsWallpaper: readAlpha(rightPanel) === 0,
          changesScrollKeepsWallpaper: readAlpha(diffSurface) === 0,
          changesTabsKeepWallpaper: readAlpha(workspaceTabs) === 0,
          changesFileTreeKeepsWallpaper: readAlpha(fileTree) === 0,
          filesTabSelected,
          changesTabRestored,
          changesContentHasReadabilityBase: readAlpha(diffPaintSurface) > 0,
          changesDiffCodeStaysTransparent: readAlpha(changesCodeSurface) === 0,
          changesSignalsRemainDistinct:
            readAlpha(additionLine) > 0 &&
            readAlpha(deletionLine) > 0 &&
            getComputedStyle(additionLine).backgroundColor !==
              getComputedStyle(deletionLine).backgroundColor,
          changesBackgroundLayers: document.querySelectorAll(
            "#${rootId} [data-codex-wallpaper-layer]"
          ).length,
          changesRuntimeState: globalThis.__codexWallpaperApi.state().state,
          changesPanelClosed: (() => {
            rightPanel.hidden = true;
            return rightPanel.hidden;
          })(),
          dialogHasFocus,
          backgroundIgnoresPointers:
            getComputedStyle(background).pointerEvents === "none",
          wallpaperMediaVisible:
            getComputedStyle(media).backgroundImage.includes("gradient") &&
            getComputedStyle(media).opacity === "1",
          toolbarIsAboveHost: toolbar.contains(toolbarHit),
          toolReceivesClick: hit === tool && toolToggleWorked,
          composerIdleShadow: getComputedStyle(composerSurface).boxShadow,
          messageIsSelectable: selection.toString().startsWith("Long assistant response"),
          pageScrolled: scrollY > 0,
          streamedMessageIsHitTestable:
            document.elementFromPoint(
              streamed.getBoundingClientRect().left + 1,
              streamed.getBoundingClientRect().top + 1
            ) === streamed
        };
      })()`,
    options
  );
  assert.deepEqual(chatResults, {
    translucentTopFade: true,
    mainWallpaperHasNoExtraBlur: true,
    paneHasNoForcedBlur: true,
    frameCarriesPageSidebarAnchor: true,
    surfaceAboveBackground: true,
    surfaceHasReadabilityBase: true,
    contentHasReadabilityBases: true,
    composerOuterPaintTransparent: true,
    footerLeadingHasReadabilityBase: true,
    ordinaryChatSharesCanvas: true,
    ordinaryActivityHasNoCard: true,
    ordinaryActivityKeepsNativeInteraction: true,
    userMarkdownKeepsNativeState: true,
    themesHaveReadabilityBases: true,
    wallpaperRemainsVisible: true,
    panelSurfacesHaveReadability: true,
    browserSurfaceIsOpaque: true,
    wallpaperControlsUseSharedPalette: true,
    wallpaperControlsHaveNoExtraBlur: true,
    menuPaintsOnlyVisibleContent: true,
    dialogKeepsHostPosition: true,
    changesOpened: true,
    changesPanelKeepsWallpaper: true,
    changesScrollKeepsWallpaper: true,
    changesTabsKeepWallpaper: true,
    changesFileTreeKeepsWallpaper: true,
    filesTabSelected: true,
    changesTabRestored: true,
    changesContentHasReadabilityBase: true,
    changesDiffCodeStaysTransparent: true,
    changesSignalsRemainDistinct: true,
    changesBackgroundLayers: 1,
    changesRuntimeState: "enabled",
    changesPanelClosed: true,
    dialogHasFocus: true,
    backgroundIgnoresPointers: true,
    wallpaperMediaVisible: true,
    toolbarIsAboveHost: true,
    toolReceivesClick: true,
    messageIsSelectable: true,
    pageScrolled: true,
    streamedMessageIsHitTestable: true,
  });
  await evaluateInPage(
    port,
    'document.querySelector("#composer").scrollIntoView({ block: "center" })',
    options
  );
  const composerReceivesClick = await clickAtElementCenter(
    port,
    options,
    "#composer"
  );
  await callMainPage(
    port,
    "Input.insertText",
    { text: " from CDP" },
    options.page,
    true
  );
  assert.deepEqual(
    {
      composerReceivesClick,
      ...(await evaluateInPage(
        port,
        `({
        composerHasFocus: document.activeElement === document.querySelector("#composer"),
        composerAcceptedText: document.querySelector("#composer").value.includes("from CDP"),
        composerFocusStyleChanged:
          getComputedStyle(document.querySelector("[data-composer-surface-variant]")).boxShadow !==
          ${JSON.stringify(composerIdleShadow)},
        userMarkdownKeepsNativeState:
          document.querySelector("#user-markdown-action").getAttribute("aria-expanded") === "false"
      })`,
        options
      )),
    },
    {
      composerReceivesClick: true,
      composerHasFocus: true,
      composerAcceptedText: true,
      composerFocusStyleChanged: true,
      userMarkdownKeepsNativeState: true,
    }
  );
  const metrics = await openMainPageSession(port, options.page, true);
  t.after(() => metrics.close());
  await metrics.send("Emulation.setDeviceMetricsOverride", {
    width: 1707,
    height: 1066,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluateInPage(
    port,
    `(() => {
      document.querySelector("[data-composer-surface-variant]").style.cssText =
        "position:fixed;z-index:10;right:108px;bottom:20px;width:736px;height:98px;box-sizing:border-box";
      document.querySelector("[data-app-shell-pane-content-viewport]").hidden = true;
      document.querySelector("#${controlRootId} .toolbar").style.cssText =
        "position-anchor:none;right:14px;left:auto;bottom:14px";
    })()`,
    options
  );
  const settingsButton = `#${controlRootId} [data-codex-wallpaper-settings]`;
  await evaluateInPage(
    port,
    `(() => {
      document.querySelector("#${controlRootId} [data-codex-wallpaper-settings]").click();
    })()`,
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const panel = document.querySelector("#${controlRootId} .panel.open");
        const c = document.querySelector("[data-composer-surface-variant]").getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        return { visible: p.top >= 0 && p.right <= innerWidth, clear: p.bottom <= c.top - 3 };
      })()`,
      options
    ),
    { visible: true, clear: true }
  );
  await evaluateInPage(
    port,
    `(() => {
      document.querySelector("#${controlRootId} [data-codex-wallpaper-settings]").click();
    })()`,
    options
  );
  assert.equal(
    await evaluateInPage(
      port,
      `!document.querySelector("#${controlRootId} .panel").classList.contains("open")`,
      options
    ),
    true
  );
  await evaluateInPage(
    port,
    `document.querySelector("#${controlRootId} .toolbar").removeAttribute("style")`,
    options
  );
  await metrics.send("Emulation.setDeviceMetricsOverride", {
    width: 1290,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluateInPage(
    port,
    `(() => {
      const composer = document.querySelector("[data-composer-surface-variant]");
      composer.style.cssText = "position:fixed;right:108px;bottom:20px;width:736px;height:98px;box-sizing:border-box";
      const action = document.createElement("button");
      action.id = "fixture-composer-action";
      action.type = "button";
      action.textContent = "Mic";
      action.style.cssText = "position:absolute;right:8px;bottom:8px;width:28px;height:28px";
      action.onclick = () => action.toggleAttribute("data-clicked");
      composer.append(action);
    })()`,
    options
  );
  const narrowComposerReceivesClick = await clickAtElementCenter(
    port,
    options,
    "#fixture-composer-action"
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const action = document.querySelector("#fixture-composer-action");
        const center = action.getBoundingClientRect();
        const hit = document.elementFromPoint(
          center.left + center.width / 2,
          center.top + center.height / 2
        );
        return {
          receivesClick: ${narrowComposerReceivesClick},
          hitTag: hit?.tagName || null,
          hitInsideAction: hit === action || action.contains(hit),
          panelOpen: document
            .querySelector("#${controlRootId} .panel")
            .classList.contains("open")
        };
      })()`,
      options
    ),
    {
      receivesClick: true,
      hitTag: "BUTTON",
      hitInsideAction: true,
      panelOpen: false,
    }
  );
  assert.equal(
    await evaluateInPage(
      port,
      'document.querySelector("#fixture-composer-action").hasAttribute("data-clicked")',
      options
    ),
    true
  );
  await evaluateInPage(
    port,
    `(() => {
      const button = document.querySelector(${JSON.stringify(settingsButton)});
      globalThis.__t03SettingsClicks = 0;
      button.addEventListener("click", () => {
        globalThis.__t03SettingsClicks += 1;
      });
    })()`,
    options
  );
  assert.equal(await clickAtElementCenter(port, options, settingsButton), true);
  await evaluateInPage(
    port,
    `(() => {
      const panel = document.querySelector("#${controlRootId} .panel");
      panel.classList.remove("open");
      globalThis.__t03SettingsClicks = 0;
      document.querySelector(${JSON.stringify(settingsButton)}).click();
    })()`,
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const panel = document.querySelector("#${controlRootId} .panel.open");
        const c = document.querySelector("[data-composer-surface-variant]").getBoundingClientRect();
        const p = panel?.getBoundingClientRect();
        return {
          clicks: globalThis.__t03SettingsClicks,
          visible: Boolean(p && p.top >= 0 && p.right <= innerWidth),
          clear: Boolean(p && p.bottom < c.top)
        };
      })()`,
      options
    ),
    { clicks: 1, visible: true, clear: true }
  );
  await clickAtElementCenter(port, options, settingsButton);
  await evaluateInPage(
    port,
    `(() => {
      document.querySelector("#fixture-composer-action").remove();
      document.querySelector("[data-composer-surface-variant]").removeAttribute("style");
      document.querySelector("[data-app-shell-pane-content-viewport]").hidden = false;
    })()`,
    options
  );
  await metrics.send("Emulation.clearDeviceMetricsOverride");
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
        for (const [input, value] of [
          [controls.querySelector("[data-setting='dim']"), "42"],
          [controls.querySelector("[data-setting='blur']"), "6"],
          [controls.querySelector("[data-setting='opacity']"), "73"]
        ]) {
          input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        [...controls.querySelectorAll(".card")]
          .find(
            (item) =>
              item.querySelector("strong")?.textContent === "Fixture Scene"
          )
          .querySelector(".card-actions button")
          .click();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (controls.querySelector("[data-setting='fps']")) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const fps = controls.querySelector("[data-setting='fps']");
        fps.value = "15";
        fps.dispatchEvent(new Event("input", { bubbles: true }));
        fps.dispatchEvent(new Event("change", { bubbles: true }));
        [...controls.querySelectorAll(".card")]
          .find(
            (item) =>
              item.querySelector("strong")?.textContent === "Fixture Image"
          )
          .querySelector(".card-actions button")
          .click();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const image = document.querySelector(
            "#${rootId} .media:not(.staged) img"
          );
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const root = document.getElementById("${rootId}");
        const media = root.querySelector(".media:not(.staged)");
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        const selectedCard = [...controls.querySelectorAll(".card")].find(
          (item) => item.querySelector("strong")?.textContent === "Fixture Image"
        );
        const selectedActions = selectedCard.querySelectorAll(".card-actions button");
        return {
          selected: saved.active,
          settings: saved.settings,
          selectedCard: selectedCard.dataset.selected,
          selectedActions: [...selectedActions].map((button) =>
            button.getAttribute("aria-pressed")
          ),
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
        muted: true,
        rotationMinutes: 0,
        performanceProfile: "custom",
        pauseWhenHidden: true,
      },
      selectedCard: "true",
      selectedActions: ["true", "false", "false"],
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
        const titlebar = document.querySelector("[data-app-shell-titlebar]");
        const opened = {
          titlebarRemainsFixed: getComputedStyle(titlebar).position === "fixed",
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
      titlebarRemainsFixed: true,
      panel: true,
      panelAlpha: "rgba(0, 0, 0, 0)",
      reviewAlpha: "rgba(0, 0, 0, 0)",
      code: "const visible = true;",
      wallpaperLayers: 1,
      imageIsFixture: true,
      closed: true,
    }
  );
  const themeMaterialExpression = `(() => {
      const controls = document.getElementById("${controlRootId}");
      const root = document.documentElement;
      return ["dark", "light"].map((theme) => {
        root.dataset.theme = theme;
        return {
          theme,
          main: getComputedStyle(
            document.querySelector("[data-app-shell-main-surface]")
          ).backgroundColor,
          toolbar: getComputedStyle(
            controls.querySelector(".toolbar")
          ).backgroundColor,
          panel: getComputedStyle(
            controls.querySelector("[data-codex-wallpaper-panel]")
          ).backgroundColor
        };
      });
    })()`;
  const themeMaterialBefore = await evaluateInPage(
    port,
    themeMaterialExpression,
    options
  );
  await evaluateInPage(
    port,
    `document.body.append(document.getElementById("${controlRootId}").cloneNode(true))`,
    options
  );
  const toggleReceivesClick = await clickAtElementCenter(
    port,
    options,
    `#${controlRootId} .toolbar [data-codex-wallpaper-toggle]`
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          toggleReceivesClick: ${toggleReceivesClick},
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
      toggleReceivesClick,
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
        muted: true,
        rotationMinutes: 0,
        performanceProfile: "custom",
        pauseWhenHidden: true,
      },
      roots: 0,
    }
  );
  await pressAltShiftW();
  await waitForWallpaperImage();
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
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
          settingsInputs: Object.fromEntries(
            [...controls.querySelectorAll(".range input")].map((input) => [
              input.dataset.setting,
              Number(input.value)
            ])
          ),
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
      settingsInputs: {
        volume: 0,
        rotationMinutes: 0,
        dim: 42,
        blur: 6,
        opacity: 73,
      },
      savedActive: { kind: "workshop", id: "fixture-image" },
      savedEnabled: true,
    }
  );
  await pressAltShiftW();
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({
        state: globalThis.__codexWallpaperApi.state().state,
        toolbar: document.querySelector("#${controlRootId} .toolbar") !== null
      })`,
      options
    ),
    { state: "disabled", toolbar: false }
  );
  await pressAltShiftW();
  await waitForWallpaperImage();
  assert.deepEqual(
    await evaluateInPage(port, themeMaterialExpression, options),
    themeMaterialBefore
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
  await pressAltShiftW();
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (globalThis.__testHostRequests.length > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const root = document.getElementById("${rootId}");
        const media = root.querySelector(".media");
        const nativeBeforeAsset =
          media?.childElementCount === 0 &&
          !media.classList.contains("builtin");
        const previewShown = Boolean(
          media?.querySelector(".media-preview")
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
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return {
          request,
          nativeBeforeAsset,
          previewShown,
          assetShown: root
            .querySelector(".media:not(.staged) img")
            ?.src.includes("22c55e"),
          state: globalThis.__codexWallpaperApi.state()
        };
      })()`,
      options
    ),
    {
      request: { type: "load-asset", id: "fixture-on-demand" },
      nativeBeforeAsset: true,
      previewShown: false,
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
  await evaluateInPage(
    port,
    `(() => {
      const originalTheme = document.documentElement.dataset.theme;
      const settings = document.createElement("div");
      settings.id = "settings-fixture";
      settings.dataset.appShellFeatureNavigation = "true";
      settings.dataset.appShellFrame = "";
      settings.style.cssText =
        "position:fixed;inset:0;z-index:100;display:grid;grid-template-columns:340px minmax(0,1fr);color:var(--app-color-text-foreground);background:var(--app-color-background-surface)";
      settings.innerHTML = \`
        <div data-settings-nav-scroll-container style="padding:44px 12px">
          <h1 style="margin:0 16px 18px">设置</h1>
          <div id="settings-search-shell" class="bg-background-secondary-soft-alpha" style="padding:9px 12px;border-radius:9999px;background:rgba(255,255,255,.08)">
            <input id="settings-search-input" role="searchbox" placeholder="搜索">
          </div>
          <nav aria-label="设置" style="display:grid;gap:1px;margin-top:16px">
            <button id="settings-general" data-settings-panel-slug="general-settings" aria-current="page" style="padding:6px 16px;border:0;border-radius:12.5px;background:rgba(255,255,255,.08);text-align:left">常规</button>
            <button id="settings-appearance" data-settings-panel-slug="appearance" style="padding:6px 16px;border:0;border-radius:12.5px;background:transparent;text-align:left">外观</button>
          </nav>
        </div>
        <main data-app-shell-main-surface="default" style="min-height:0;overflow:auto">
          <div id="settings-viewport" class="electron:bg-surface" style="min-height:100%;background:rgb(24,24,28)">
            <div data-density="default" style="width:min(728px,calc(100% - 48px));margin:80px auto">
              <h2>常规</h2>
              <div id="settings-card" class="rounded-2xl border-default" style="padding:16px;background:rgb(35,35,35);border:1px solid rgba(255,255,255,.082);border-radius:20px;--color-border:rgba(255,255,255,.082)">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0">
                  <span>默认文件打开位置</span>
                  <button id="settings-select" class="bg-background-neutral-soft-alpha border-default" aria-expanded="false" style="padding:4px 12px;border-radius:12.5px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.082)">VS Code</button>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 0">
                  <span>默认使用完整视图</span>
                  <button id="settings-switch" role="switch" aria-checked="true" data-state="checked" style="padding:0;border:0;background:transparent">
                    <span id="settings-switch-track" data-state="checked" style="display:block;width:32px;height:20px;border-radius:9999px;background:rgb(2,133,255)"></span>
                  </button>
                </div>
                <button id="settings-secondary" class="bg-text/5" style="padding:4px 12px;border:0;border-radius:12.5px;background:rgba(255,255,255,.05)">更改</button>
              </div>
            </div>
          </div>
        </main>
      \`;
      document.body.append(settings);

      const search = settings.querySelector("#settings-search-input");
      const searchShell = settings.querySelector("#settings-search-shell");
      const select = settings.querySelector("#settings-select");
      const switchControl = settings.querySelector("#settings-switch");
      const switchTrack = settings.querySelector("#settings-switch-track");
      const menu = document.createElement("div");
      menu.id = "settings-menu";
      menu.setAttribute("role", "dialog");
      menu.hidden = true;
      menu.textContent = "VS Code";
      menu.style.cssText =
        "position:fixed;right:24px;top:24px;z-index:101;padding:12px;border-radius:14px;background:rgb(20,20,20)";
      document.body.append(menu);
      settings
        .querySelectorAll("[data-settings-panel-slug]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            settings
              .querySelectorAll("[data-settings-panel-slug]")
              .forEach((item) => item.removeAttribute("aria-current"));
            button.setAttribute("aria-current", "page");
          });
        });
      select.addEventListener("click", () => {
        const open = select.getAttribute("aria-expanded") !== "true";
        select.setAttribute("aria-expanded", String(open));
        menu.hidden = !open;
      });
      switchControl.addEventListener("click", () => {
        const checked =
          switchControl.getAttribute("aria-checked") !== "true";
        switchControl.setAttribute("aria-checked", String(checked));
        switchControl.dataset.state = checked ? "checked" : "unchecked";
        switchTrack.dataset.state = checked ? "checked" : "unchecked";
      });

      const decoy = document.createElement("div");
      decoy.id = "settings-scope-decoy";
      decoy.className = "electron:bg-surface";
      decoy.style.cssText =
        "position:fixed;right:0;bottom:0;width:8px;height:8px;background:rgb(35,35,35)";
      document.body.append(decoy);
      globalThis.__settingsOriginalTheme = originalTheme;
      globalThis.__settingsSearchShell = searchShell;
      globalThis.__settingsSearch = search;
      globalThis.__settingsSearchIdleShadow =
        getComputedStyle(searchShell).boxShadow;
    })()`,
    options
  );
  assert.equal(
    await clickAtElementCenter(port, options, "#settings-search-input"),
    true
  );
  await callMainPage(
    port,
    "Input.insertText",
    { text: "通用" },
    options.page,
    true
  );
  const searchInteraction = await evaluateInPage(
    port,
    `(() => {
      const search = document.querySelector("#settings-search-input");
      const searchShell = document.querySelector("#settings-search-shell");
      return {
        focused: document.activeElement === search,
        acceptedText: search.value === "通用",
        focusStyleChanged:
          getComputedStyle(searchShell).boxShadow !==
          globalThis.__settingsSearchIdleShadow,
      };
    })()`,
    options
  );
  await callMainPage(
    port,
    "Input.dispatchKeyEvent",
    {
      type: "rawKeyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    },
    options.page,
    true
  );
  await callMainPage(
    port,
    "Input.dispatchKeyEvent",
    {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    },
    options.page,
    true
  );
  const keyboardFocus = await evaluateInPage(
    port,
    `(() => ({
      target: document.activeElement.id,
      focusVisible: document.activeElement.matches(":focus-visible"),
      outline: getComputedStyle(document.activeElement).outlineStyle,
    }))()`,
    options
  );
  assert.equal(
    await clickAtElementCenter(port, options, "#settings-appearance"),
    true
  );
  assert.equal(
    await clickAtElementCenter(port, options, "#settings-select"),
    true
  );
  assert.equal(
    await clickAtElementCenter(port, options, "#settings-switch"),
    true
  );
  const settingsResults = await evaluateInPage(
    port,
    `(() => {
      const readAlpha = (element) => {
        const value = getComputedStyle(element).backgroundColor;
        const match =
          value.match(/\\/\\s*([\\d.]+)\\s*\\)/) ||
          value.match(/,\\s*([\\d.]+)\\s*\\)$/);
        return match ? Number(match[1]) : 1;
      };
      const viewport = document.querySelector("#settings-viewport");
      const card = document.querySelector("#settings-card");
      const searchShell = document.querySelector("#settings-search-shell");
      const selected = document.querySelector(
        "[data-settings-panel-slug][aria-current='page']"
      );
      const select = document.querySelector("#settings-select");
      const switchTrack = document.querySelector("#settings-switch-track");
      const menu = document.querySelector("#settings-menu");
      const decoy = document.querySelector("#settings-scope-decoy");
      const readMaterials = (theme) => {
        document.documentElement.dataset.theme = theme;
        return {
          viewport: getComputedStyle(viewport).backgroundColor,
          card: getComputedStyle(card).backgroundColor,
          search: getComputedStyle(searchShell).backgroundColor,
        };
      };
      const dark = readMaterials("dark");
      const light = readMaterials("light");
      document.documentElement.dataset.theme =
        globalThis.__settingsOriginalTheme;
      return {
        viewportTranslucent:
          readAlpha(viewport) > 0 && readAlpha(viewport) < 1,
        cardTranslucent: readAlpha(card) > 0 && readAlpha(card) < 1,
        cardBelowViewport: readAlpha(card) < readAlpha(viewport),
        searchHasMaterial:
          getComputedStyle(searchShell).boxShadow !== "none",
        selectedHasMaterial:
          getComputedStyle(selected).boxShadow !== "none",
        controlHasMaterial:
          getComputedStyle(select).borderColor !==
            "rgba(255, 255, 255, 0.082)" &&
          getComputedStyle(document.querySelector("#settings-secondary"))
            .backgroundColor !== "rgba(255, 255, 255, 0.05)",
        switchHasMaterial:
          getComputedStyle(switchTrack).boxShadow !== "none",
        themesDiffer:
          dark.viewport !== light.viewport &&
          dark.card !== light.card &&
          dark.search !== light.search,
        scopedToSettings:
          getComputedStyle(decoy).backgroundColor === "rgb(35, 35, 35)",
        appearanceSelected:
          document
            .querySelector("#settings-appearance")
            .getAttribute("aria-current") === "page",
        menuOpened:
          select.getAttribute("aria-expanded") === "true" && !menu.hidden,
        switchToggled:
          document
            .querySelector("#settings-switch")
            .getAttribute("aria-checked") === "false",
      };
    })()`,
    options
  );
  assert.deepEqual(
    {
      ...settingsResults,
      searchFocused: searchInteraction.focused,
      searchAcceptedText: searchInteraction.acceptedText,
      searchFocusStyleChanged: searchInteraction.focusStyleChanged,
      keyboardFocusTarget: keyboardFocus.target,
      keyboardFocusVisible:
        keyboardFocus.focusVisible && keyboardFocus.outline !== "none",
    },
    {
      viewportTranslucent: true,
      cardTranslucent: true,
      cardBelowViewport: true,
      searchHasMaterial: true,
      selectedHasMaterial: true,
      controlHasMaterial: true,
      switchHasMaterial: true,
      themesDiffer: true,
      scopedToSettings: true,
      appearanceSelected: true,
      menuOpened: true,
      switchToggled: true,
      searchFocused: true,
      searchAcceptedText: true,
      searchFocusStyleChanged: true,
      keyboardFocusTarget: "settings-general",
      keyboardFocusVisible: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const initial = globalThis.__codexWallpaperApi.state();
        const before = {
          viewport: getComputedStyle(
            document.querySelector("#settings-viewport")
          ).backgroundColor,
          card: getComputedStyle(
            document.querySelector("#settings-card")
          ).backgroundColor,
        };
        await globalThis.__codexWallpaperApi.disable();
        const disabled = {
          styles: document.querySelectorAll("#${rootId}-style").length,
          viewport: getComputedStyle(
            document.querySelector("#settings-viewport")
          ).backgroundColor,
          card: getComputedStyle(
            document.querySelector("#settings-card")
          ).backgroundColor,
        };
        const enabled = await globalThis.__codexWallpaperApi.enable();
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          initiallyEnabled: initial.state === "enabled",
          disabled,
          reapplied: {
            state: enabled.state,
            styles: document.querySelectorAll("#${rootId}-style").length,
            sameViewport:
              getComputedStyle(
                document.querySelector("#settings-viewport")
              ).backgroundColor === before.viewport,
            sameCard:
              getComputedStyle(
                document.querySelector("#settings-card")
              ).backgroundColor === before.card,
          },
        };
      })()`,
      options
    ),
    {
      initiallyEnabled: true,
      disabled: {
        styles: 0,
        viewport: "rgb(24, 24, 28)",
        card: "rgb(35, 35, 35)",
      },
      reapplied: {
        state: "enabled",
        styles: 1,
        sameViewport: true,
        sameCard: true,
      },
    }
  );
});
