import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { candidateIdentity, runtimeSource } from "./client-runtime.mjs";
import { applyStaticBackground, evaluateInPage } from "./static-background.mjs";
import { callMainPage, openMainPageSession } from "./read-only-probe.mjs";
import { attachWallpaperHost, sessionEvaluate } from "./wallpaper-host.mjs";

const edge =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const rootId = "codex-wallpaper-p1";
const controlRootId = "codex-wallpaper-p1-controls";
const toggleSettings =
  'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyS" }))';
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

function firstJsonArgument(expression) {
  const start = expression.indexOf("(") + 1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < expression.length; index += 1) {
    const character = expression[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0)
      return JSON.parse(expression.slice(start, index + 1));
  }
  throw new Error("Missing JSON argument");
}

async function startCdpFixture(
  t,
  {
    evaluate = null,
    origin = "app://-",
    origins = null,
    suspend = null,
    objectId = "file-input",
    switching = false,
  } = {}
) {
  const oldId = "0123456789abcdef0123456789abcdef";
  const newId = "fedcba9876543210fedcba9876543210";
  const requests = [];
  const sockets = new Set();
  let pageSocket = null;
  let hostSocket = null;
  let discoveries = 0;
  let sessions = 0;
  let switched = false;
  let replacementId = null;
  let hostConnections = 0;
  let originIndex = 0;
  const delivered = Promise.withResolvers();
  function requestHost(type, id) {
    return (
      hostSocket?.write(
        encodeWebSocketText(
          JSON.stringify({
            method: "Runtime.bindingCalled",
            params: {
              name: "__codexWallpaperHostRequest",
              payload: JSON.stringify({ type, id }),
            },
          })
        )
      ) ?? false
    );
  }
  const server = createServer(async (request, response) => {
    assert.equal(request.url, "/json/list");
    discoveries += 1;
    const lock = join(
      tmpdir(),
      `codex-wallpaper-host-${server.address().port}.lock`
    );
    const targetId =
      replacementId ??
      (switching
        ? !switched
          ? oldId
          : (await access(lock).then(
                () => false,
                () => true
              ))
            ? newId
            : null
        : oldId);
    response.end(
      JSON.stringify(
        targetId
          ? [
              {
                id: targetId,
                type: "page",
                url: "app://-/index.html",
                webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/${targetId}`,
              },
            ]
          : []
      )
    );
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    pageSocket = socket;
    sessions += 1;
    const targetId = request.url.split("/").at(-1);
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
        if (suspend?.(command)) {
          frame = takeWebSocketText(incoming);
          continue;
        }
        if (
          switching &&
          targetId === oldId &&
          command.method === "Runtime.enable"
        ) {
          switched = true;
          socket.destroy();
          return;
        }
        let result = {};
        if (command.method === "Page.getFrameTree") {
          result = {
            frameTree: {
              frame: {
                url: "app://-/index.html",
                securityOrigin: origins?.[originIndex++] ?? origin,
              },
            },
          };
        }
        if (command.method === "Runtime.evaluate") {
          if (command.params.returnByValue === false) {
            try {
              new Function(`return (${command.params.expression})`);
              result = { result: objectId ? { objectId } : {} };
            } catch (error) {
              result = {
                exceptionDetails: {
                  exception: { description: String(error?.message || error) },
                },
              };
            }
          } else {
            const value = evaluate
              ? evaluate(command.params.expression, requestHost, delivered)
              : command.params.expression.startsWith(
                    "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
                  )
                ? false
                : command.params.expression ===
                    "globalThis.__codexWallpaperApi.configureHost()"
                  ? { state: "enabled", hostReady: true }
                  : { state: "disabled", backgroundLayers: 0 };
            result = { result: { value } };
          }
        }
        if (command.method === "Runtime.addBinding") {
          hostSocket = socket;
          hostConnections += 1;
        }
        socket.write(
          encodeWebSocketText(JSON.stringify({ id: command.id, result }))
        );
        frame = takeWebSocketText(incoming);
      }
      if (frame?.opcode === 8) socket.end(Buffer.from([0x88, 0]));
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
    requestHost,
    delivered,
    get discoveries() {
      return discoveries;
    },
    get sessions() {
      return sessions;
    },
    get hostConnected() {
      return Boolean(hostSocket);
    },
    get hostConnections() {
      return hostConnections;
    },
    get switched() {
      return switched;
    },
    replaceTarget(id) {
      replacementId = id;
      pageSocket.destroy();
    },
    stopHost() {
      requestHost("stop");
    },
  };
}

function startExactCdpFixture(t, evaluate = null, options = {}) {
  return startCdpFixture(t, { ...options, evaluate });
}

function startSwitchingCdpFixture(t, { evaluate }) {
  return startCdpFixture(t, { evaluate, switching: true });
}

async function waitForCondition(check, timeout, message) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (await check()) return;
    await delay(25);
  }
  assert.fail(message);
}

function supervisorExited(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return true;
  }
}

test(
  "supervisor verifies the main frame before installing a host or runtime",
  { timeout: 8000 },
  async (t) => {
    const cdp = await startExactCdpFixture(t, null, { origin: "app://other" });
    const child = spawn(
      process.execPath,
      [
        "--no-use-env-proxy",
        "launcher/startup-supervisor.mjs",
        String(cdp.port),
      ],
      {
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      }
    );
    t.after(() => child.kill());
    let output = "";
    child.stdout.setEncoding("utf8").on("data", (line) => {
      output += line;
    });
    const [code] = await once(child, "close");
    assert.equal(code, 1);
    assert.equal(JSON.parse(output).error, "main-frame-unverified");
    const methods = cdp.requests.map(({ method }) => method);
    assert.equal(methods.length, 5);
    assert.ok(methods.every((method) => method === "Page.getFrameTree"));
  }
);

test(
  "closing the startup handoff releases the host lock even while CDP initialization is stalled",
  { timeout: 8000 },
  async (t) => {
    let initializing;
    const initializingHost = new Promise((resolve) => {
      initializing = resolve;
    });
    const cdp = await startExactCdpFixture(t, null, {
      suspend({ method }) {
        if (method !== "Runtime.enable") return false;
        initializing();
        return true;
      },
    });
    const child = spawn(
      process.execPath,
      [
        "--no-use-env-proxy",
        "launcher/startup-supervisor.mjs",
        String(cdp.port),
      ],
      {
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      }
    );
    t.after(() => child.kill());
    const output = createInterface({ input: child.stdout });
    const done = once(child, "close");
    const [line] = await once(output, "line");
    const verified = JSON.parse(line);
    assert.equal(verified.state, "verified");
    child.stdin.write(`attach ${verified.verification}\n`);
    await initializingHost;
    child.stdin.end();
    await done;
    await assert.rejects(
      access(join(tmpdir(), `codex-wallpaper-host-${cdp.port}.lock`)),
      { code: "ENOENT" }
    );
    assert.ok(!cdp.hostConnected);
  }
);

test(
  "startup recovers after the verified target disconnects and delivers the first workshop asset",
  { timeout: 25000 },
  async (t) => {
    const steamRoot = await mkdtemp(join(tmpdir(), "codex-wallpaper-switch-"));
    const videoId = "9999999999997";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Target switch fixture",
        file: "clip.mp4",
      })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    const identity = candidateIdentity();
    let savedEnabled = true;
    let assetRequests = 0;
    let completedTransfers = 0;
    const cdp = await startSwitchingCdpFixture(t, {
      videoId,
      evaluate(expression, requestHost, delivered) {
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
          )
        )
          return "file-1";
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.finishAssetFileTransfer("
          )
        ) {
          completedTransfers += 1;
          delivered.resolve();
          return true;
        }
        if (expression.includes("globalThis.__codexWallpaperStartupPid")) {
          if (savedEnabled) {
            assetRequests += 1;
            requestHost("load-asset", videoId);
          }
          return {
            state: savedEnabled ? "enabled" : "disabled",
            hostReady: true,
            identity,
          };
        }
        return { state: "enabled", hostReady: true, identity };
      },
    });
    const receipt = await runStartupHandoff(t, cdp, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(receipt.TargetVerificationCount, 2);
    assert.equal(receipt.TargetVerified, true);
    assert.equal(receipt.HostReady, true);
    assert.deepEqual(receipt.Wallpaper.identity, identity);
    assert.equal(cdp.switched, true);
    assert.equal(cdp.hostConnections, 1);
    let deadline;
    const delivered = await Promise.race([
      cdp.delivered.promise.then(() => true),
      new Promise((resolve) => {
        deadline = setTimeout(() => resolve(false), 5000);
      }),
    ]);
    clearTimeout(deadline);
    assert.ok(
      delivered,
      JSON.stringify({
        commands: cdp.requests.map((command) => command.method),
      })
    );
    assert.deepEqual(
      cdp.requests
        .filter((command) => command.method === "DOM.setFileInputFiles")
        .map((command) => command.params),
      [{ files: [join(project, "clip.mp4")], objectId: "file-input" }]
    );

    cdp.replaceTarget("11111111111111111111111111111111");
    await waitForCondition(
      () => completedTransfers === 2,
      8000,
      "The replacement target never received its saved workshop video"
    );
    assert.equal(cdp.hostConnections, 2);
    const lock = join(tmpdir(), `codex-wallpaper-host-${cdp.port}.lock`);
    assert.equal(
      Number(await readFile(lock, "utf8")),
      receipt.Wallpaper.hostPid
    );

    savedEnabled = false;
    cdp.replaceTarget("22222222222222222222222222222222");
    await waitForCondition(
      () =>
        cdp.requests.filter(
          ({ method, params }) =>
            method === "Runtime.evaluate" &&
            params.expression.includes("globalThis.__codexWallpaperStartupPid")
        ).length === 3,
      8000,
      "The disabled replacement target never acknowledged the runtime"
    );
    assert.equal(cdp.hostConnections, 3);
    assert.equal(assetRequests, 2);
    cdp.stopHost();
    await waitForCondition(
      () => supervisorExited(receipt.Wallpaper.hostPid),
      4000,
      "An explicit stop must end the supervisor"
    );
    assert.equal(cdp.hostConnections, 3);
    await assert.rejects(access(lock), { code: "ENOENT" });
  }
);

test(
  "supervisor rejects post-startup replacement when the listener owner does not match",
  { timeout: 15000 },
  async (t) => {
    const identity = candidateIdentity();
    const cdp = await startExactCdpFixture(t, () => ({
      state: "enabled",
      hostReady: true,
      identity,
    }));
    // The fixture owns the listener, while the reported identity belongs to its parent.
    const receipt = await runStartupHandoff(t, cdp, {
      listenerOwner: process.ppid,
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    const start = cdp.requests.length;
    cdp.replaceTarget("33333333333333333333333333333333");
    await waitForCondition(
      () => supervisorExited(receipt.Wallpaper.hostPid),
      8000,
      "The supervisor must exit when the replacement listener is not owned by Codex"
    );
    assert.deepEqual(
      cdp.requests.slice(start).map(({ method }) => method),
      ["Page.getFrameTree"]
    );
    assert.equal(cdp.hostConnections, 1);
  }
);

test(
  "a delayed attach approval cannot be consumed by a replacement startup target",
  { timeout: 15000 },
  async (t) => {
    const folder = await mkdtemp(join(tmpdir(), "codex-wallpaper-handoff-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    const started = join(folder, "first-check");
    const released = join(folder, "allow-first-approval");
    const literal = (path) => `'${path.replaceAll("'", "''")}'`;
    const identity = candidateIdentity();
    const cdp = await startExactCdpFixture(t, () => ({
      state: "enabled",
      hostReady: true,
      identity,
    }));
    const handoff = runStartupHandoff(t, cdp, {
      recheck: `
        if ($script:wallpaperRecheckCount -eq 1) {
          [IO.File]::WriteAllText(${literal(started)}, '')
          while (-not [IO.File]::Exists(${literal(released)})) { Start-Sleep -Milliseconds 20 }
        } else {
          Start-Sleep -Milliseconds 750
        }
      `,
    });
    void handoff.catch(() => {});
    await waitForCondition(
      () => existsSync(started),
      4000,
      "The launcher never began checking the old target"
    );
    cdp.replaceTarget("44444444444444444444444444444444");
    await waitForCondition(
      () =>
        cdp.requests.filter(({ method }) => method === "Page.getFrameTree")
          .length === 2,
      1000,
      "The supervisor never verified the replacement target"
    );
    await writeFile(released, "");
    const receipt = await handoff;
    assert.equal(receipt.TargetVerificationCount, 2);
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.ok(
      cdp.requestHost("stop"),
      "The launcher acknowledged a host that had already disconnected"
    );
    await waitForCondition(
      () => supervisorExited(receipt.Wallpaper.hostPid),
      3000,
      "The final host did not handle stop"
    );
  }
);

test(
  "startup retries a transient unverified main frame before attaching",
  { timeout: 15000 },
  async (t) => {
    const identity = candidateIdentity();
    const cdp = await startExactCdpFixture(
      t,
      () => ({ state: "disabled", hostReady: true, identity }),
      { origins: ["app://other", "app://-"] }
    );
    const receipt = await runStartupHandoff(t, cdp);
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(receipt.TargetVerificationCount, 1);
    assert.equal(receipt.HostReady, true);
    assert.deepEqual(receipt.Wallpaper.identity, identity);
    assert.equal(cdp.hostConnections, 1);
    assert.ok(cdp.discoveries >= 2);
    assert.ok(cdp.sessions >= 2);
  }
);

test(
  "startup rechecks a replacement verified target and fails closed when the recheck rejects",
  { timeout: 10000 },
  async (t) => {
    const cdp = await startSwitchingCdpFixture(t, {
      videoId: "unused",
      evaluate() {
        return { state: "enabled", hostReady: true };
      },
    });
    const receipt = await runStartupHandoff(t, cdp, {
      recheck:
        "if ($script:wallpaperRecheckCount -gt 1) { 'listener-changed' } else { '' }",
    });
    assert.equal(receipt.Outcome, "listener-changed");
    assert.equal(receipt.TargetVerificationCount, 2);
    assert.equal(receipt.TargetRecheckCount, 2);
    assert.equal(receipt.Wallpaper, undefined);
    assert.equal(cdp.hostConnections, 0);
    await assert.rejects(
      access(join(tmpdir(), `codex-wallpaper-host-${cdp.port}.lock`)),
      { code: "ENOENT" }
    );
  }
);

async function runStartupHandoff(
  t,
  cdp,
  {
    rejection = "",
    recheck = null,
    env = process.env,
    compatibilityProbe = false,
    listenerOwner = process.pid,
    previewFolder = null,
  } = {}
) {
  const psLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
  const recheckCode = recheck ?? psLiteral(rejection);
  const command = `
    $ErrorActionPreference = 'Stop'
    $launcher = (Resolve-Path 'launcher/Start-CodexWallpaper.ps1').Path
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$null, [ref]$null)
    foreach ($name in @('Start-WallpaperSupervisor', 'Test-LoopbackOwner')) {
      $definition = $ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name}, $true)
      . ([scriptblock]::Create($definition.Extent.Text))
    }
    $receipt = [ordered]@{}
    $receipt.MainPid = ${listenerOwner}
    $receipt.MainCreated = (Get-CimInstance Win32_Process -Filter 'ProcessId=${listenerOwner}').CreationDate.ToString('o')
    $receipt.CompatibilityMode = ${compatibilityProbe ? "'probe'" : "$null"}
    $script:wallpaperRecheckCount = 0
    $stateFolder = ${previewFolder ? psLiteral(previewFolder) : "$null"}
    Start-WallpaperSupervisor ${psLiteral(process.execPath)} (Split-Path -Parent $launcher) ${cdp.port} ([Diagnostics.Stopwatch]::StartNew()) $receipt { $script:wallpaperRecheckCount++; ${recheckCode} } ${previewFolder ? "$true" : "$false"}
    $receipt.TargetRecheckCount = $script:wallpaperRecheckCount
    $receipt | ConvertTo-Json -Depth 6 -Compress
  `;
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(command, "utf16le").toString("base64"),
    ],
    {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );
  t.after(() => child.kill());
  let error = "";
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    error += chunk;
  });
  const output = createInterface({ input: child.stdout });
  const options = { signal: AbortSignal.timeout(5000) };
  const signals = [];
  try {
    const [[code], receipt] = await Promise.all([
      once(child, "exit", options),
      new Promise((resolve) => {
        output.on("line", (line) => {
          if (line.startsWith("CodexWallpaper:")) signals.push(line);
          else resolve(line);
        });
      }).then(JSON.parse),
    ]);
    assert.equal(code, 0, error);
    if (previewFolder) receipt.DesktopSignals = signals;
    return receipt;
  } catch (cause) {
    throw new Error(
      `PowerShell handoff failed. ${error} CDP: ${cdp.requests.map(({ method }) => method)}`,
      { cause }
    );
  } finally {
    output.close();
    child.stdout.destroy();
    child.stderr.destroy();
  }
}

test(
  "PowerShell rejects a changed listener before injection",
  { timeout: 8000 },
  async (t) => {
    const cdp = await startExactCdpFixture(t);
    const receipt = await runStartupHandoff(t, cdp, {
      rejection: "listener-changed",
    });
    assert.equal(receipt.Outcome, "listener-changed");
    assert.deepEqual(
      cdp.requests.map(({ method }) => method),
      ["Page.getFrameTree"]
    );
  }
);

test(
  "startup rolls back a mounted candidate that does not acknowledge the host",
  { timeout: 8000 },
  async (t) => {
    const cdp = await startExactCdpFixture(t, () => ({
      state: "enabled",
      hostReady: false,
      identity: candidateIdentity(),
    }));
    const receipt = await runStartupHandoff(t, cdp);
    assert.equal(receipt.Outcome, "wallpaper-injection-failed");
    assert.equal(receipt.SupervisorError, "runtime-not-ready");
    assert.equal(receipt.Wallpaper, undefined);
    await assert.rejects(
      access(join(tmpdir(), `codex-wallpaper-host-${cdp.port}.lock`)),
      { code: "ENOENT" }
    );
  }
);

test(
  "startup reattaches the host to an existing matching runtime",
  { timeout: 8000 },
  async (t) => {
    const identity = candidateIdentity();
    let reconfigured = false;
    const cdp = await startExactCdpFixture(t, (expression) => {
      if (expression.includes("await existing.configureHost()"))
        reconfigured = true;
      return { state: "enabled", hostReady: true, identity };
    });
    const receipt = await runStartupHandoff(t, cdp);
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(receipt.HostReady, true);
    assert.equal(reconfigured, true);
    assert.equal(cdp.hostConnections, 1);
    assert.deepEqual(receipt.Wallpaper.identity, identity);
  }
);

test(
  "compatibility probe fails closed when the current Codex interface never appears",
  { timeout: 8000 },
  async (t) => {
    const identity = candidateIdentity();
    const cdp = await startExactCdpFixture(t, () => ({
      state: "enabled",
      hostReady: true,
      mainInterfaceShown: false,
      identity,
    }));
    const receipt = await runStartupHandoff(t, cdp, {
      compatibilityProbe: true,
      env: {
        ...process.env,
        CODEX_WALLPAPER_COMPATIBILITY_PROBE_MS: "300",
      },
    });
    assert.equal(receipt.Outcome, "compatibility-probe-failed");
    assert.equal(receipt.SupervisorError, "compatibility-probe-failed");
    assert.equal(receipt.Wallpaper, undefined);
  }
);

test(
  "compatibility probe waits for the current Codex interface before declaring ready",
  { timeout: 8000 },
  async (t) => {
    const identity = candidateIdentity();
    let polls = 0;
    const cdp = await startExactCdpFixture(t, (expression) => {
      if (expression === "globalThis.__codexWallpaperApi?.state()") polls += 1;
      return {
        state: "enabled",
        hostReady: true,
        mainInterfaceShown: polls >= 2,
        identity,
      };
    });
    const receipt = await runStartupHandoff(t, cdp, {
      compatibilityProbe: true,
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(receipt.HostReady, true);
    assert.ok(polls >= 2);
  }
);

test("the desktop handoff waits for a presented wallpaper after verifying the host", { timeout: 8000 }, async (t) => {
  const previewFolder = await mkdtemp(join(tmpdir(), "codex-wallpaper-presentation-"));
  t.after(() => rm(previewFolder, { recursive: true, force: true }));
  let sampled = 0;
  const interfaceAt = Date.now();
  const frameAt = interfaceAt + 100;
  const cdp = await startExactCdpFixture(t, (expression) => {
    if (expression === "globalThis.__codexWallpaperApi?.waitForStartupPresentation()") {
      sampled += 1;
      return { status: "visible", interfaceAt, frameAt };
    }
    return { state: "enabled", hostReady: true, identity: candidateIdentity() };
  });
  const receipt = await runStartupHandoff(t, cdp, {
    previewFolder, env: { ...process.env, CODEX_WALLPAPER_DESKTOP_HANDSHAKE: "1" },
  });
  assert.equal(receipt.Outcome, "wallpaper-ready");
  assert.equal(receipt.StartupPreview, "visible");
  assert.ok(receipt.StartupPreviewHandoffMs >= receipt.HostReadyMs);
  assert.equal(receipt.StartupPreviewInterfaceAt, interfaceAt);
  assert.equal(receipt.StartupPreviewFirstFrameAt, frameAt);
  assert.deepEqual(receipt.DesktopSignals, ["CodexWallpaper:presented"]);
  assert.equal(sampled, 1);
});

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
        [data-app-shell-workspace] {
          grid-column: 3;
          grid-row: 1;
          position: relative;
          display: flex;
          min-width: 0;
        }
        .bg-surface { background-color: var(--app-color-background-surface); }
        [data-app-shell-surface-backing] { position: absolute; inset: 0; pointer-events: none; }
        [data-app-shell-surface-backing]::after {
          content: "";
          position: absolute;
          inset: 0;
          box-shadow: inset 0 0 0 1px rgb(100 100 100);
        }
        [data-app-shell-main-surface] {
          position: relative;
          flex: 1;
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
          <div data-app-shell-workspace>
            <div class="bg-surface" data-app-shell-surface-backing aria-hidden="true"></div>
            <main data-app-shell-main-surface>
              <div class="content">Chat canvas</div>
            </main>
          </div>
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

async function startRuntimeFixture(t, payload, fixture = null) {
  const page = await startBrowserFixture(t, fixture);
  const options = {
    page: page.fixture.url,
    origin: new URL(page.fixture.url).origin,
    payload,
  };
  await waitForPage(page.port, options);
  return { ...page, options };
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
  let target = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    target = await evaluateInPage(
      port,
      `(() => {
        const control = document.querySelector(${JSON.stringify(selector)});
        if (!control) return null;
        const rect = control.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, receivesClick: hit === control || control.contains(hit) };
      })()`,
      options
    );
    if (target?.receivesClick) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!target) return false;
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

async function pressWallpaperShortcut(port, options, key) {
  const virtualKey = key.charCodeAt(0);
  for (const type of ["rawKeyDown", "keyUp"]) {
    await callMainPage(
      port,
      "Input.dispatchKeyEvent",
      {
        type,
        key,
        code: `Key${key}`,
        windowsVirtualKeyCode: virtualKey,
        nativeVirtualKeyCode: virtualKey,
        modifiers: 9,
      },
      options.page,
      true
    );
  }
}

test("browser startup uses the bound host during first recovery and discards a failed mount without saving", async (t) => {
  const { fixture, port } = await startBrowserFixture(t);
  const options = { page: fixture.url };
  await waitForPage(port, options);
  const key = "codex-wallpaper-p1-config";
  const saved = JSON.stringify({
    enabled: true,
    active: { kind: "workshop", id: "startup-video" },
  });
  const session = await openMainPageSession(port, options.page, true);
  t.after(() => session.close());
  async function evaluate(expression) {
    const response = await session.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.equal(response.exceptionDetails, undefined);
    return response.result.value;
  }
  await session.send("Runtime.enable");
  await session.send("Runtime.addBinding", {
    name: "__codexWallpaperHostRequest",
  });
  const requests = [];
  session.on("Runtime.bindingCalled", ({ payload }) =>
    requests.push(JSON.parse(payload))
  );
  await evaluate(
    `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(saved)})`
  );
  const state = await evaluate(
    runtimeSource(
      {
        version: 1,
        library: [
          { id: "startup-video", type: "video", title: "Startup video" },
        ],
      },
      true
    )
  );
  assert.equal(state.hostReady, true);
  assert.deepEqual(
    requests.map(({ request, ...rest }) => rest),
    [{ type: "load-asset", id: "startup-video" }]
  );
  assert.deepEqual(
    await evaluate("globalThis.__codexWallpaperApi.identity()"),
    candidateIdentity()
  );
  const cancelled = await evaluate(`(async () => {
    const api = globalThis.__codexWallpaperApi;
    const token = api.beginAssetFileTransfer({ id: "startup-video", type: "video" });
    const pending = api.finishAssetFileTransfer(token);
    await api.discardStartup();
    return Promise.race([pending, new Promise(resolve => setTimeout(() => resolve("still pending"), 200))]);
  })()`);
  assert.equal(cancelled, false);
  assert.deepEqual(
    await evaluate(`[
    Boolean(document.getElementById(${JSON.stringify(rootId)})),
    typeof globalThis.__codexWallpaperApi, typeof globalThis.__codexWallpaperHotkey,
    localStorage.getItem(${JSON.stringify(key)})
  ]`),
    [false, "undefined", "undefined", saved]
  );
});

test("dedicated startup reveals wallpaper and controls after the active Codex interface paints", async (t) => {
  const html = await startHtmlFixture(`<!doctype html><html><body>
    <div id="splash">Loading</div>
    <div data-app-shell-active-page="true" style="opacity:0">
      <main data-app-shell-main-surface style="min-height:100px"></main>
    </div>
  </body></html>`);
  const { fixture, port } = await startBrowserFixture(t, html);
  const options = { page: fixture.url };
  const evaluate = (expression) => evaluateInPage(port, expression, options);
  await waitForPage(port, options);
  await evaluate(`globalThis.startupRequests = [];
    globalThis.__codexWallpaperHostRequest = (request) => startupRequests.push(JSON.parse(request));
    globalThis.libraryReads = 0;
    const getAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      libraryReads += 1;
      return getAll.apply(this, args);
    };
    globalThis.assetRequests = () => startupRequests.filter(request => request.type === 'load-asset');`);

  const key = "codex-wallpaper-p1-config";
  const selected = { kind: "workshop", id: "last-image" };
  const image =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const source = runtimeSource(
    {
      library: [
        { id: selected.id, title: "Saved image", type: "image" },
      ],
    },
    true,
    true,
    true
  );
  const layers = `[
    document.querySelectorAll('#${rootId} [data-codex-wallpaper-layer]').length,
    document.querySelectorAll('#${controlRootId} [data-codex-wallpaper-panel]').length,
    globalThis.__codexWallpaperApi.state().styles
  ]`;
  const afterPaint = (value) => `new Promise(resolve => requestAnimationFrame(() =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(${value})))))`;
  const saveEnabled = `localStorage.setItem('${key}', ${JSON.stringify(
    JSON.stringify({ enabled: true, active: selected })
  )})`;
  await evaluate(saveEnabled);
  const startup = await evaluate(source);
  assert.equal(startup.hostReady, true);
  assert.equal(startup.activeId, selected.id);
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate("globalThis.__codexWallpaperApi.startupPresentation()"), "waiting");
  assert.equal(await evaluate("assetRequests().length"), 1);
  assert.equal(await evaluate("assetRequests().at(-1).id"), selected.id);

  await evaluate(`document.querySelector('main').innerHTML =
    '<div data-composer-surface-variant>Message composer</div>'`);
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate(`(() => {
    globalThis.cancelledFile = globalThis.__codexWallpaperApi.beginAssetFileTransfer(
      { id: ${JSON.stringify(selected.id)} }, null, assetRequests().at(-1).request
    );
    return document.querySelector('input[data-codex-wallpaper-file]')?.hidden;
  })()`), true);

  // A cross-window stop while startup waits must cancel the pending mount.
  await evaluate(`(() => {
    const config = JSON.parse(localStorage.getItem('${key}'));
    localStorage.setItem('${key}', JSON.stringify({ ...config, enabled: false }));
    dispatchEvent(new StorageEvent('storage', { key: '${key}' }));
    document.querySelector('[data-app-shell-active-page]').style.opacity = '1';
  })()`);
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate("document.querySelectorAll('input[data-codex-wallpaper-file]').length"), 0);
  assert.equal(await evaluate("globalThis.__codexWallpaperApi.finishAssetFileTransfer(cancelledFile)"), false);
  await evaluate("globalThis.__codexWallpaperApi.discardStartup()");
  assert.equal((await evaluate(source)).state, "disabled");
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate("globalThis.__codexWallpaperApi.startupPresentation()"), "disabled");
  assert.equal(await evaluate("startupRequests.at(-1).enabled"), false);

  await evaluate(`(async () => {
    await globalThis.__codexWallpaperApi.discardStartup();
    document.querySelector('[data-app-shell-active-page]').style.opacity = '0';
    ${saveEnabled};
  })()`);
  assert.equal((await evaluate(source)).state, "enabled");
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate("assetRequests().length"), 2);
  await evaluate(`(async () => {
    globalThis.presentation = null;
    void globalThis.__codexWallpaperApi.waitForStartupPresentation().then(value => { presentation = value; });
    const blob = await fetch(${JSON.stringify(image)}).then(response => response.blob());
    const request = assetRequests().at(-1).request;
    const token = globalThis.__codexWallpaperApi.beginAssetFileTransfer(
      { id: ${JSON.stringify(selected.id)}, title: 'Saved image', type: 'image', mime: blob.type, size: blob.size },
      null, request
    );
    const input = document.querySelector('input[data-codex-wallpaper-file]');
    const data = new DataTransfer();
    data.items.add(new File([blob], 'saved.gif', {type: blob.type}));
    input.files = data.files;
    input.dispatchEvent(new Event('change'));
    await globalThis.__codexWallpaperApi.finishAssetFileTransfer(token, request);
  })()`);
  await evaluate(`(() => {
    const active = document.querySelector('[data-app-shell-active-page]');
    active.inert = true;
    active.style.opacity = '1';
  })()`);
  assert.deepEqual(await evaluate(afterPaint(layers)), [0, 0, 0]);
  assert.equal(await evaluate("presentation"), null);
  // Confirm that the first visible composer frame still has the native appearance.
  const firstVisibleFrame = await evaluate(`new Promise(resolve => {
    document.querySelector('#splash').remove();
    document.querySelector('[data-app-shell-active-page]').inert = false;
    requestAnimationFrame(() => resolve(${layers}));
  })`);
  assert.deepEqual(firstVisibleFrame, [0, 0, 0]);
  await waitForCondition(
    async () => (await evaluate(layers)).every((count) => count === 1),
    3000,
    "wallpaper and settings panel were not mounted after the composer"
  );
  await waitForCondition(
    () => evaluate(`document.querySelector('#${rootId} img')?.src.startsWith('blob:') &&
      presentation?.status === 'visible'`),
    3000,
    "saved wallpaper did not restore"
  );
  assert.deepEqual(await evaluate("[presentation.frameAt >= presentation.interfaceAt, assetRequests().length, libraryReads]"),
    [true, 2, 0]);
  await waitForCondition(
    () => evaluate("startupRequests.at(-1).poster?.startsWith('data:image/jpeg;base64,')"),
    3000,
    "wallpaper poster was not published after presentation"
  );
  await evaluate(source);
  assert.deepEqual(await evaluate(layers), [1, 1, 1]);
  await evaluate(toggleSettings);
  await waitForCondition(() => evaluate("libraryReads === 1"), 3000, "opening the panel did not load local imports");

  await evaluate(`(async () => {
    await globalThis.__codexWallpaperApi.discardStartup();
    document.querySelector('[data-app-shell-active-page]').inert = true;
    const create = indexedDB.open('codex-wallpaper-media', 1);
    const db = await new Promise(resolve => { create.onsuccess = () => resolve(create.result); });
    const blob = await fetch(${JSON.stringify(image)}).then(response => response.blob());
    const transaction = db.transaction('media', 'readwrite');
    transaction.objectStore('media').put({id:'saved-import', title:'Saved import', blob, createdAt:1});
    await new Promise(resolve => { transaction.oncomplete = resolve; });
    db.close();
    const get = IDBObjectStore.prototype.get;
    globalThis.importReads = [];
    IDBObjectStore.prototype.get = function (key) {
      importReads.push(key);
      return get.call(this, key);
    };
    localStorage.setItem('${key}', JSON.stringify({ enabled: true, active: {kind:'imported',id:'saved-import'} }));
  })()`);
  assert.equal((await evaluate(source)).activeId, "saved-import");
  await waitForCondition(() => evaluate("importReads.length === 1"), 3000, "the selected import was not prepared");
  assert.deepEqual(await evaluate(layers), [0, 0, 0]);
  assert.deepEqual(await evaluate("importReads"), ["saved-import"]);
  await evaluate("document.querySelector('[data-app-shell-active-page]').inert = false");
  await waitForCondition(() => evaluate("globalThis.__codexWallpaperApi.startupPresentation() === 'visible'"), 3000, "the selected import was not presented");
  assert.deepEqual(await evaluate("[importReads.length, libraryReads, assetRequests().length]"), [1, 1, 2]);
});

test("window chrome keeps wallpaper sharp and native titlebar interactive", async (t) => {
  const fixture = await startChromeFixture();
  const { port, options } = await startRuntimeFixture(
    t,
    { version: 1, library: [] },
    fixture
  );
  const readTitlebar = `(() => {
    const bar = document.querySelector("[data-app-shell-titlebar]");
    const style = getComputedStyle(bar);
    return [style.position, style.zIndex, style.getPropertyValue("-webkit-app-region"),
      getComputedStyle(bar.firstElementChild).getPropertyValue("-webkit-app-region"),
      bar.getBoundingClientRect().toJSON()];
  })()`;
  const readBacking = `(() => {
    const backing = document.querySelector("[data-app-shell-surface-backing]");
    return {
      background: getComputedStyle(backing).backgroundColor,
      outline: getComputedStyle(backing, "::after").boxShadow
    };
  })()`;
  const nativeTitlebar = await evaluateInPage(port, readTitlebar, options);
  const nativeBacking = await evaluateInPage(port, readBacking, options);
  await applyStaticBackground(port, options);
  assert.deepEqual(await evaluateInPage(port, readBacking, options), {
    ...nativeBacking,
    background: "rgba(0, 0, 0, 0)"
  });
  assert.deepEqual(
    await evaluateInPage(
      port,
      "globalThis.__codexWallpaperApi.identity()",
      options
    ),
    candidateIdentity()
  );
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
    const alphaOf = (color) => color === "rgba(0, 0, 0, 0)"
      ? 0
      : Number(color.match(/\\/\\s*([\\d.]+)\\s*\\)/)?.[1] ?? 1);
    function sample(theme) {
      document.documentElement.dataset.theme = theme;
      const paint = getComputedStyle(frame).backgroundColor;
      const alpha = alphaOf(paint);
      return {
        paint,
        wallpaperThroughFrame: alpha > 0 && alpha < 1,
        noOverpaint: [...surrounds].every(element => {
          const style = getComputedStyle(element);
          return alphaOf(style.backgroundColor) === 0 &&
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

  await evaluateInPage(
    port,
    `document.documentElement.dataset.theme = "dark"`,
    options
  );
  await pressWallpaperShortcut(port, options, "W");
  assert.deepEqual(await evaluateInPage(port, readBacking, options), nativeBacking);
});

test("changing selection cancels a pending File and accepts a new transfer when reselected", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "fixture-file-video",
        title: "Fixture File Video",
        type: "video",
        playable: false,
        fallback: true,
        previewDataUrl:
          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
        assetDataUrl: null,
        webHtml: null,
        reason: "on-demand",
      },
      {
        id: "fixture-switch-image",
        title: "Fixture Switch Image",
        type: "image",
        playable: true,
        assetDataUrl:
          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
      },
    ],
  });
  await evaluateInPage(
    port,
    `(() => {
      localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
        enabled: true, active: {kind:"workshop",id:"fixture-file-video"},
        favorites: [], playlist: [], settings: {fps: 30, volume: 0}
      }));
    })()`,
    options
  );
  await applyStaticBackground(port, options);
  const result = await evaluateInPage(
    port,
    `(async () => {
      const api = globalThis.__codexWallpaperApi;
      const token = api.beginAssetFileTransfer({
        id: "fixture-file-video",
        title: "Fixture File Video",
        type: "video",
        playable: false,
        previewDataUrl: null,
        webHtml: null,
        reason: "on-demand",
        mime: "video/mp4",
        size: ${Buffer.from(tinyMp4, "base64").length}
      }, null);
      if (!token) throw new Error("File transfer token was rejected");
      const input = document.querySelector(
        \`input[data-codex-wallpaper-file="\${token}"]\`
      );
      const oldFinish = api.finishAssetFileTransfer(token);
      ${toggleSettings};
      const imageCard = document.querySelector("[data-entry-id=fixture-switch-image]");
      const videoCard = document.querySelector("[data-entry-id=fixture-file-video]");
      imageCard.querySelector("[data-entry-action=use]").click();
      videoCard.querySelector("[data-entry-action=use]").click();
      const cancelResult = await Promise.race([
        oldFinish,
        new Promise((resolve) => setTimeout(resolve, 300, null)),
      ]);
      const token2 = api.beginAssetFileTransfer({
        id: "fixture-file-video",
        title: "Fixture File Video",
        type: "video",
        playable: false,
        previewDataUrl: null,
        webHtml: null,
        reason: "on-demand",
        mime: "video/mp4",
        size: ${Buffer.from(tinyMp4, "base64").length}
      }, null);
      const activeInput = document.querySelector(
        \`input[data-codex-wallpaper-file="\${token2}"]\`
      );
      const file = new File(
        [Uint8Array.from(atob(${JSON.stringify(tinyMp4)}), (char) => char.charCodeAt(0))],
        "Fixture File.mp4",
        { type: "video/mp4" }
      );
      const transfer = new DataTransfer();
      transfer.items.add(file);
      activeInput.files = transfer.files;
      activeInput.dispatchEvent(new Event("change", { bubbles: true }));
      await api.finishAssetFileTransfer(token2);
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const video = document.querySelector("#${rootId} .media:not(.staged) video");
        if (video?.readyState >= 2 && video.src.startsWith("blob:")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const video = document.querySelector("#${rootId} .media:not(.staged) video");
      return {
        hadInput: Boolean(input),
        canceledInputGone: !document.contains(input),
        canceledFinish: cancelResult === false,
        blobVideo: video?.src.startsWith("blob:") ?? false,
        cardStatus: videoCard.querySelector("[data-card-status]").textContent,
        playerCount: api.state().playerCount,
        staged: document.querySelectorAll("#${rootId} .media.staged").length
      };
    })()`,
    options
  );
  assert.deepEqual(result, {
    hadInput: true,
    canceledInputGone: true,
    canceledFinish: true,
    blobVideo: true,
    cardStatus: "video · 原生播放",
    playerCount: 1,
    staged: 0,
  });
});

test("same-id reselection isolates late File and failure results from the current request", async (t) => {
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23f97316'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "fixture-request-video",
        title: "Request Video",
        type: "video",
        playable: false,
        fallback: true,
        previewDataUrl: preview,
        reason: "on-demand",
      },
      {
        id: "fixture-request-image",
        title: "Request Image",
        type: "image",
        playable: true,
        assetDataUrl: preview,
      },
      {
        id: "fixture-request-final",
        title: "Request Final",
        type: "image",
        playable: true,
        assetDataUrl:
          "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%2322c55e'/%3E%3C/svg%3E",
      },
    ],
  });
  await evaluateInPage(
    port,
    `(() => {
      globalThis.__fixtureAssetRequests = [];
      globalThis.__codexWallpaperHostRequest = (raw) => {
        const request = JSON.parse(raw);
        if (request.type === "load-asset")
          globalThis.__fixtureAssetRequests.push(request);
      };
      localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-request-video" },
        favorites: [],
        playlist: [],
        settings: { fps: 30, volume: 0 }
      }));
    })()`,
    options
  );
  await applyStaticBackground(port, options);
  const result = await evaluateInPage(
    port,
    `(async () => {
      const api = globalThis.__codexWallpaperApi;
      const root = document.getElementById("${rootId}");
      const controls = document.getElementById("${controlRootId}");
      const action = (id) =>
        controls.querySelector(
          \`.card[data-entry-id="\${id}"] [data-entry-action="use"]\`
        );
      const requestToken = () => globalThis.__fixtureAssetRequests.at(-1)?.request;
      const entry = {
        id: "fixture-request-video",
        title: "Request Video",
        type: "video",
        mime: "video/mp4",
        size: ${Buffer.from(tinyMp4, "base64").length}
      };
      const attachFile = async (token) => {
        const input = document.querySelector(
          \`input[data-codex-wallpaper-file="\${token}"]\`
        );
        const transfer = new DataTransfer();
        transfer.items.add(
          new File(
            [Uint8Array.from(atob(${JSON.stringify(tinyMp4)}), (char) => char.charCodeAt(0))],
            "Request Video.mp4",
            { type: "video/mp4" }
          )
        );
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return input;
      };
      ${toggleSettings};
      const firstRequest = requestToken();
      const firstToken = api.beginAssetFileTransfer(entry, null, firstRequest);
      const firstInput = await attachFile(firstToken);
      action("fixture-request-image").click();
      action("fixture-request-video").click();
      const secondRequest = requestToken();
      const staleFileResult = await api.finishAssetFileTransfer(firstToken);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const afterStaleFile = {
        staleFileResult,
        inputGone: !document.contains(firstInput),
        activeVideo: Boolean(root.querySelector(".media:not(.staged) video")),
        status: controls.querySelector(".runtime-status")?.textContent
      };
      action("fixture-request-image").click();
      action("fixture-request-video").click();
      const thirdRequest = requestToken();
      api.receiveAssetError(
        "fixture-request-video",
        "stale failure",
        secondRequest
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      const afterStaleFailure = {
        status: controls.querySelector(".runtime-status")?.textContent,
        cardStatus: controls
          .querySelector(
            '.card[data-entry-id="fixture-request-video"] [data-card-status]'
          )?.textContent
      };
      const currentToken = api.beginAssetFileTransfer(entry, null, thirdRequest);
      await attachFile(currentToken);
      await api.finishAssetFileTransfer(currentToken, thirdRequest);
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const video = root.querySelector(".media:not(.staged) video");
        if (video?.readyState >= 2 && video.src.startsWith("blob:")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const videoDelivered = Boolean(
        root.querySelector(".media:not(.staged) video")?.src.startsWith("blob:")
      );
      action("fixture-request-image").click();
      action("fixture-request-final").click();
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const image = root.querySelector(".media:not(.staged) img");
        if (image?.complete && image.naturalWidth > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      api.receiveAsset(
        {
          id: "fixture-request-video",
          title: "Request Video",
          type: "video",
          playable: true,
          assetDataUrl: null
        },
        thirdRequest
      );
      api.receiveAssetError(
        "fixture-request-video",
        "late after C",
        thirdRequest
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        firstRequest,
        secondRequest,
        thirdRequest,
        distinctRequests:
          firstRequest && secondRequest && thirdRequest &&
          firstRequest !== secondRequest && secondRequest !== thirdRequest,
        afterStaleFile,
        afterStaleFailure,
        currentVideo: videoDelivered,
        afterAtoBtoC: {
          activeId: api.state().activeId,
          finalShown: root
            .querySelector(".media:not(.staged) img")
            ?.src.includes("22c55e")
        },
        staged: root.querySelectorAll(".media.staged").length,
        temporaryInputs: root.querySelectorAll("input[type='file']").length
      };
    })()`,
    options
  );
  assert.equal(result.distinctRequests, true);
  assert.deepEqual(result.afterStaleFile, {
    staleFileResult: false,
    inputGone: true,
    activeVideo: false,
    status: "正在加载：Request Video",
  });
  assert.deepEqual(result.afterStaleFailure, {
    status: "正在加载：Request Video",
    cardStatus: "video · 加载中",
  });
  assert.deepEqual(
    {
      currentVideo: result.currentVideo,
      activeId: result.afterAtoBtoC.activeId,
      finalShown: result.afterAtoBtoC.finalShown,
      staged: result.staged,
      temporaryInputs: result.temporaryInputs,
    },
    {
      currentVideo: true,
      activeId: "fixture-request-final",
      finalShown: true,
      staged: 0,
      temporaryInputs: 0,
    }
  );
});

test("video card waits for an actual click before requesting the asset", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "click-video",
        title: "Click Video",
        type: "video",
        playable: false,
      },
    ],
  });
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        ${toggleSettings};
        const card = document.querySelector("[data-entry-id=click-video]");
        const use = card.querySelector("[data-entry-action=use]");
        const requests = [];
        globalThis.__codexWallpaperHostRequest = (raw) => requests.push(JSON.parse(raw));
        card.dispatchEvent(new MouseEvent("mouseenter"));
        use.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        use.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const beforeClick = {
          requests: requests.splice(0).filter((request) => request.type !== "load-preview"),
          playerCount: globalThis.__codexWallpaperApi.state().playerCount,
          fileInputs: document.querySelectorAll("#${rootId} input[type=file]").length,
        };
        use.click();
        return {
          beforeClick,
          requests: requests
            .filter((request) => request.type !== "load-preview")
            .map(({ request, ...rest }) => rest),
          selected: use.getAttribute("aria-pressed"),
          status: card.querySelector("[data-card-status]").textContent,
        };
      })()`,
      options
    ),
    {
      beforeClick: { requests: [], playerCount: 0, fileInputs: 0 },
      requests: [{ type: "load-asset", id: "click-video" }],
      selected: "true",
      status: "video · 加载中",
    }
  );
});

test("real CDP file input delivers a video without a Base64 page transfer", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "cdp-file-video",
        title: "CDP File Video",
        type: "video",
        playable: false,
        fallback: true,
        previewDataUrl: null,
        assetDataUrl: null,
        webHtml: null,
        reason: "on-demand",
      },
    ],
  });
  await evaluateInPage(
    port,
    `(() => {
      localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
        enabled: true, active: {kind:"workshop",id:"cdp-file-video"},
        favorites: [], playlist: [], settings: {fps: 30, volume: 0}
      }));
    })()`,
    options
  );
  await applyStaticBackground(port, options);
  const path = join(tmpdir(), "codex-wallpaper-cdp-file.mp4");
  await writeFile(path, Buffer.from(tinyMp4, "base64"));
  t.after(() => rm(path, { force: true }));
  const session = await openMainPageSession(port, options.page, true);
  t.after(() => session.close());
  const size = Buffer.from(tinyMp4, "base64").length;
  const token = (
    await session.send("Runtime.evaluate", {
      expression: `globalThis.__codexWallpaperApi.beginAssetFileTransfer(${JSON.stringify(
        {
          id: "cdp-file-video",
          title: "CDP File Video",
          type: "video",
          playable: false,
          fallback: true,
          previewDataUrl: null,
          assetDataUrl: null,
          webHtml: null,
          reason: "on-demand",
          mime: "video/mp4",
          size,
        }
      )}, null)`,
      returnByValue: true,
      awaitPromise: true,
    })
  ).result.value;
  const document = await session.send("DOM.getDocument");
  const input = await session.send("DOM.querySelector", {
    nodeId: document.result?.rootId ?? document.root.nodeId,
    selector: `input[data-codex-wallpaper-file="${token}"]`,
  });
  await session.send("DOM.setFileInputFiles", {
    files: [path],
    nodeId: input.nodeId,
  });
  await session.send("Runtime.evaluate", {
    expression: `globalThis.__codexWallpaperApi.finishAssetFileTransfer(${JSON.stringify(
      String(token)
    )})`,
    returnByValue: true,
    awaitPromise: true,
  });
  const result = await evaluateInPage(
    port,
    `(async () => {
      const api = globalThis.__codexWallpaperApi;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const video = document.querySelector("#${rootId} .media:not(.staged) video");
        if (video?.readyState >= 2 && video.src.startsWith("blob:")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const video = document.querySelector("#${rootId} .media:not(.staged) video");
      return {
        blobVideo: video?.src.startsWith("blob:") ?? false,
        playerCount: api.state().playerCount,
        staged: document.querySelectorAll("#${rootId} .media.staged").length,
        temporaryInputs: document.querySelectorAll(
          "input[type='file'][hidden]"
        ).length,
      };
    })()`,
    options
  );
  assert.deepEqual(result, {
    blobVideo: true,
    playerCount: 1,
    staged: 0,
    temporaryInputs: 0,
  });
});

test(
  "CDP file input uses the original File when the MP4 layout is rejected",
  { timeout: 15000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-layout-fallback-")
    );
    const videoId = "9999999999996";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Rejected layout fixture",
        file: "clip.mp4",
      })
    );
    const malformed = Buffer.alloc(24);
    malformed.writeUInt32BE(8, 0);
    malformed.write("ftyp", 4, "latin1");
    malformed.writeUInt32BE(1, 8);
    malformed.write("mdat", 12, "latin1");
    malformed.writeBigUInt64BE(8n, 16);
    await writeFile(join(project, "clip.mp4"), malformed);
    const calls = [];
    const identity = candidateIdentity();
    const finished = Promise.withResolvers();
    const fixture = await startExactCdpFixture(t, (expression) => {
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
        )
      ) {
        calls.push(
          expression.endsWith(", null)") ? "file-layout-null" : "file"
        );
        return "file-1";
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetTransfer("
        )
      )
        calls.push("base64");
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.finishAssetFileTransfer("
        )
      ) {
        calls.push("finish");
        finished.resolve();
        return true;
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi?.receiveAssetError("
        )
      )
        finished.reject(new Error(expression));
      return { state: "enabled", hostReady: true, identity };
    });
    const receipt = await runStartupHandoff(t, fixture, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(fixture.requestHost("load-asset", videoId), true);
    const outcome = await Promise.race([
      finished.promise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
    ]);
    assert.equal(outcome, true, JSON.stringify({ calls }));
    assert.deepEqual(calls, ["file-layout-null", "finish"]);
    assert.deepEqual(
      fixture.requests
        .filter((command) => command.method === "DOM.setFileInputFiles")
        .map((command) => command.params),
      [{ files: [join(project, "clip.mp4")], objectId: "file-input" }]
    );
    fixture.stopHost();
  }
);

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

test(
  "complete reset keeps the real host ready for reenable and workshop File delivery",
  { timeout: 20000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-reset-host-")
    );
    const videoId = "9999999999995";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Reset Host Video",
        file: "clip.mp4",
      })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    const previousRoot = process.env.DSH_WE_STEAM_ROOT;
    process.env.DSH_WE_STEAM_ROOT = steamRoot;
    t.after(() => {
      if (previousRoot === undefined) delete process.env.DSH_WE_STEAM_ROOT;
      else process.env.DSH_WE_STEAM_ROOT = previousRoot;
    });
    const payload = {
      version: 1,
      library: [
        {
          id: videoId,
          title: "Reset Host Video",
          type: "video",
          playable: false,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: null,
          reason: "on-demand",
        },
      ],
    };
    const { fixture, port, options } = await startRuntimeFixture(t, payload);
    await evaluateInPage(
      port,
      `localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
        enabled: false,
        active: { kind: "workshop", id: ${JSON.stringify(videoId)} },
        favorites: [],
        playlist: [],
        settings: { fps: 30, volume: 0 }
      }))`,
      options
    );
    const session = await openMainPageSession(port, options.page, true);
    const host = await attachWallpaperHost({
      port,
      session,
      page: options.page,
      source: runtimeSource(payload, true),
    });
    assert.ok(host);
    t.after(async () => {
      await host.stop();
      session.close();
    });
    const lock = join(tmpdir(), `codex-wallpaper-host-${port}.lock`);
    const waitForVideo = () =>
      evaluateInPage(
        port,
        `(async () => {
          for (let attempt = 0; attempt < 120; attempt += 1) {
            const video = document.querySelector(
              "#${rootId} .media:not(.staged) video"
            );
            if (video?.readyState >= 2 && video.src.startsWith("blob:"))
              return true;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          return false;
        })()`,
        options
      );

    assert.equal(
      (await applyStaticBackground(port, options)).state,
      "disabled"
    );
    await sessionEvaluate(
      session,
      "globalThis.__codexWallpaperApi.configureHost()"
    );
    const pressAltShiftW = () =>
      evaluateInPage(
        port,
        `dispatchEvent(new KeyboardEvent("keydown", {
          key: "W",
          code: "KeyW",
          altKey: true,
          shiftKey: true,
          bubbles: true
        }))`,
        options
      );
    await pressAltShiftW();
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (document.getElementById("${rootId}")) return true;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return false;
      })()`,
      options
    );
    await evaluateInPage(
      port,
      `(() => {
        ${toggleSettings};
        document
          .querySelector(
            \`.card[data-entry-id="${videoId}"] [data-entry-action="use"]\`
          )
          .click();
      })()`,
      options
    );
    assert.equal(await waitForVideo(), true);
    await access(lock);

    await evaluateInPage(
      port,
      `(() => {
        ${toggleSettings};
        const reset = document.querySelector("#${controlRootId} button.reset");
        reset.click();
        reset.click();
      })()`,
      options
    );
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 160; attempt += 1) {
          if (!document.getElementById("${rootId}")) return true;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return false;
      })()`,
      options
    );
    await access(lock);
    await pressAltShiftW();
    await evaluateInPage(
      port,
      `(async () => {
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (document.getElementById("${rootId}")) return true;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return false;
      })()`,
      options
    );
    await evaluateInPage(
      port,
      `(() => {
        ${toggleSettings};
        document
          .querySelector(
            \`.card[data-entry-id="${videoId}"] [data-entry-action="use"]\`
          )
          .click();
      })()`,
      options
    );
    assert.equal(await waitForVideo(), true);
    await access(lock);
  }
);

test(
  "one supervisor retries discarded fallback and File transfers after PowerShell exits",
  { timeout: 15000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-transfer-")
    );
    const videoId = "9999999999999";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Transfer fixture",
        file: "clip.mp4",
      })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    const calls = [];
    let fileAttempts = 0;
    const identity = candidateIdentity();
    const finished = Promise.withResolvers();
    const fixture = await startExactCdpFixture(t, (expression, requestHost) => {
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
        )
      )
        return ++fileAttempts === 1 ? false : `file-${fileAttempts}`;
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetTransfer("
        )
      ) {
        const transfer = firstJsonArgument(expression);
        calls.push(transfer.fileFallbackReason);
        return true;
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.appendAssetTransferChunk("
        )
      ) {
        calls.push("chunk");
        if (calls.length === 2) {
          // The page disabled and re-enabled while the old host request was in flight.
          requestHost("load-asset", videoId);
          return false;
        }
        return true;
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.finishAssetFileTransfer("
        )
      ) {
        if (fileAttempts === 2) {
          requestHost("load-asset", videoId);
          return false;
        }
        finished.resolve();
        return true;
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi?.receiveAssetError("
        )
      )
        finished.reject(
          new Error(`Host rejected the test wallpaper: ${expression}`)
        );
      return { state: "enabled", hostReady: true, identity };
    });
    const receipt = await runStartupHandoff(t, fixture, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.deepEqual(receipt.Wallpaper.identity, identity);
    assert.equal(fixture.discoveries, 1);
    assert.equal(fixture.sessions, 1);
    const requestSent = fixture.requestHost("load-asset", videoId);
    let deadline;
    const outcome = await Promise.race([
      finished.promise.then(() => ({ finished: true })),
      new Promise((resolve) => {
        deadline = setTimeout(() => resolve({ finished: false }), 5000);
      }),
    ]);
    clearTimeout(deadline);
    assert.ok(
      outcome.finished,
      JSON.stringify({
        calls,
        hostConnected: fixture.hostConnected,
        requestSent,
        commands: fixture.requests.map((command) => command.method),
      })
    );
    assert.deepEqual(calls, ["file-input-unavailable", "chunk"]);
    assert.deepEqual(
      fixture.requests
        .filter((command) => command.method === "DOM.setFileInputFiles")
        .map((command) => command.params),
      [
        { files: [join(project, "clip.mp4")], objectId: "file-input" },
        { files: [join(project, "clip.mp4")], objectId: "file-input" },
      ]
    );
    fixture.stopHost();
    const lock = join(tmpdir(), `codex-wallpaper-host-${fixture.port}.lock`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (
        await access(lock).then(
          () => false,
          () => true
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    await assert.rejects(access(lock), { code: "ENOENT" });
  }
);

test(
  "large video uses its preview when File is unavailable without starting Base64",
  { timeout: 15000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-oversized-")
    );
    const videoId = "9999999999998";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Oversized fixture",
        file: "clip.mp4",
        preview: "preview.png",
      })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    await truncate(join(project, "clip.mp4"), 512 * 1024 * 1024 + 1);
    await writeFile(join(project, "preview.png"), Buffer.from([0x89, 0x50]));
    const calls = [];
    const identity = candidateIdentity();
    const finished = Promise.withResolvers();
    const fixture = await startExactCdpFixture(t, (expression) => {
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
        )
      ) {
        calls.push("file-transfer");
        return false;
      }
      if (
        expression.startsWith("globalThis.__codexWallpaperApi.receivePreview(")
      ) {
        calls.push("preview");
        return { state: "enabled", hostReady: true };
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetTransfer("
        )
      )
        calls.push("base64");
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi?.receiveAssetError("
        )
      ) {
        calls.push("error");
        finished.resolve();
        return { state: "enabled", hostReady: true };
      }
      return { state: "enabled", hostReady: true, identity };
    });
    const receipt = await runStartupHandoff(t, fixture, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(fixture.requestHost("load-asset", videoId), true);
    const outcome = await Promise.race([
      finished.promise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    assert.equal(outcome, true, JSON.stringify({ calls }));
    assert.deepEqual(calls, ["file-transfer", "preview", "error"]);
    fixture.stopHost();
  }
);

test(
  "video above 512 MiB is delivered through File without Base64",
  { timeout: 15000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-large-file-")
    );
    const videoId = "9999999999997";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "video",
        title: "Large File fixture",
        file: "clip.mp4",
      })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    await truncate(join(project, "clip.mp4"), 512 * 1024 * 1024 + 1);
    const calls = [];
    const identity = candidateIdentity();
    const finished = Promise.withResolvers();
    const fixture = await startExactCdpFixture(t, (expression) => {
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
        )
      ) {
        calls.push("file");
        return `file-${videoId}`;
      }
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetTransfer("
        )
      )
        calls.push("base64");
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.finishAssetFileTransfer("
        )
      ) {
        calls.push("finish");
        finished.resolve();
        return true;
      }
      return { state: "enabled", hostReady: true, identity };
    });
    const receipt = await runStartupHandoff(t, fixture, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(fixture.requestHost("load-asset", videoId), true);
    const outcome = await Promise.race([
      finished.promise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    assert.equal(outcome, true, JSON.stringify({ calls }));
    assert.deepEqual(calls, ["file", "finish"]);
    assert.deepEqual(
      fixture.requests
        .filter((command) => command.method === "DOM.setFileInputFiles")
        .map((command) => command.params),
      [{ files: [join(project, "clip.mp4")], objectId: "file-input" }]
    );
    assert.equal(
      fixture.requests.some(
        (command) => command.method === "Runtime.releaseObject"
      ),
      true
    );
    fixture.stopHost();
  }
);

test(
  "missing File input object falls back for a small video",
  { timeout: 15000 },
  async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), "codex-wallpaper-missing-object-")
    );
    const videoId = "9999999999996";
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      videoId
    );
    t.after(() => rm(steamRoot, { recursive: true, force: true }));
    await mkdir(distribution, { recursive: true });
    await mkdir(project, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({ type: "video", file: "clip.mp4" })
    );
    await writeFile(join(project, "clip.mp4"), Buffer.from(tinyMp4, "base64"));
    const calls = [];
    const identity = candidateIdentity();
    const finished = Promise.withResolvers();
    const fixture = await startExactCdpFixture(
      t,
      (expression) => {
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
          )
        )
          return `file-${videoId}`;
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.beginAssetTransfer("
          )
        ) {
          const transfer = firstJsonArgument(expression);
          calls.push(transfer.fileFallbackReason);
          return true;
        }
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.appendAssetTransferChunk("
          )
        )
          return true;
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.finishAssetTransfer("
          )
        ) {
          finished.resolve();
          return true;
        }
        return { state: "enabled", hostReady: true, identity };
      },
      { objectId: null }
    );
    const receipt = await runStartupHandoff(t, fixture, {
      env: { ...process.env, DSH_WE_STEAM_ROOT: steamRoot },
    });
    assert.equal(receipt.Outcome, "wallpaper-ready");
    assert.equal(fixture.requestHost("load-asset", videoId), true);
    const outcome = await Promise.race([
      finished.promise.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);
    assert.equal(outcome, true, JSON.stringify({ calls }));
    assert.deepEqual(calls, ["file-input-failed"]);
    assert.equal(
      fixture.requests.some(
        (command) => command.method === "DOM.setFileInputFiles"
      ),
      false
    );
    fixture.stopHost();
  }
);

test("reenabling during a video transfer discards the old stream and accepts its replacement", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      { id: "fixture-video", title: "Transfer fixture", type: "video" },
    ],
  });
  await evaluateInPage(
    port,
    `(() => {
    localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
      enabled: true, active: {kind:"workshop",id:"fixture-video"}
    }));
    globalThis.__fixtureAssetRequests = 0;
    globalThis.__codexWallpaperHostRequest = (raw) => {
      if (JSON.parse(raw).type === "load-asset") globalThis.__fixtureAssetRequests++;
    };
  })()`,
    options
  );
  await applyStaticBackground(port, options);
  const result = await evaluateInPage(
    port,
    `(async () => {
    const api = globalThis.__codexWallpaperApi;
    const data = ${JSON.stringify(tinyMp4)};
    const entry = { id:"fixture-video",title:"Transfer fixture",type:"video",mime:"video/mp4",size:atob(data).length };
    api.beginAssetTransfer(entry);
    await api.disable();
    const disabled = !document.querySelector("#${rootId}");
    await api.enable();
    const chunkRejected = api.appendAssetTransferChunk(entry.id, data) === false;
    const finishRejected = await api.finishAssetTransfer(entry.id) === false;
    api.beginAssetTransfer(entry);
    api.appendAssetTransferChunk(entry.id, data);
    await api.finishAssetTransfer(entry.id);
    for (let i=0;i<40&&!document.querySelector("#${rootId} .media:not(.staged) video");i++)
      await new Promise(resolve => setTimeout(resolve, 25));
    return {
      disabled, chunkRejected, finishRejected, requests: globalThis.__fixtureAssetRequests,
      player: !!document.querySelector("#${rootId} .media:not(.staged) video"),
      staged: document.querySelectorAll("#${rootId} .media.staged").length
    };
  })()`,
    options
  );
  assert.deepEqual(result, {
    disabled: true,
    chunkRejected: true,
    finishRejected: true,
    requests: 2,
    player: true,
    staged: 0,
  });
});

test("failed first video shows its preview instead of a blank background", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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

test("oversized video host failure commits its preview instead of a blank background", async (t) => {
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "fixture-oversized-video",
        title: "Fixture Oversized Video",
        type: "video",
        playable: false,
        fallback: true,
        previewDataUrl: preview,
        assetDataUrl: null,
        reason: "asset-too-large",
      },
    ],
  });
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-oversized-video" },
        favorites: [],
        playlist: [],
        settings: { fps: 30, volume: 0 }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const api = globalThis.__codexWallpaperApi;
        const id = "fixture-oversized-video";
        api.receivePreview({ id, previewDataUrl: ${JSON.stringify(preview)}, fallback: true });
        await api.receiveAssetError(id, "Video exceeds the 1 GiB File playback limit");
        const root = document.getElementById("${rootId}");
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = root.querySelector(".media:not(.staged) img");
          if (image?.complete && image.naturalWidth > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const media = root.querySelector(".media:not(.staged)");
        return {
          previewShown: media?.querySelector("img")?.src.includes("5d32b8"),
          mediaCount: root.querySelectorAll(".media:not(.staged)").length,
          status: document.querySelector("#${controlRootId} .runtime-status")?.textContent,
        };
      })()`,
      options
    ),
    {
      previewShown: true,
      mediaCount: 1,
      status:
        "素材加载失败：Video exceeds the 1 GiB File playback limit，已使用预览",
    }
  );
});

test("disable cancels a staged video before its first frame can commit", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
        ${toggleSettings};
        controls.querySelector("[data-panel-page='appearance']")?.click();
        const opacity = [...controls.querySelectorAll(".range")].find(
          (range) => range.querySelector("span")?.textContent === "不透明度"
        ).querySelector("input");
        const opacityOutput = opacity.closest(".range").querySelector("output");
        const opacityText = opacityOutput.firstChild;
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
        const visibleOpacityAfterPreview = opacityOutput.textContent;
        const savedBeforeSettle = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        const visiblePages = () => [...controls.querySelectorAll("[data-panel-region]")]
          .filter((page) => page.getClientRects().length > 0)
          .map((page) => page.dataset.panelRegion);
        const appearancePage = visiblePages();
        controls.querySelector("[data-panel-page='playback']")?.click();
        const playbackPage = visiblePages();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const writesAfterBlur = configWrites;
        const savedAfterBlur = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).settings.opacity;
        controls.querySelector("[data-panel-page='appearance']")?.click();
        controls.querySelector("[data-codex-wallpaper-panel] header button").click();
        ${toggleSettings};
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
        const visibleOpacityAfterSync = opacityOutput.textContent;
        const displayedAfterRemote = pendingLocal.value;
        const image = root.querySelector(".media:not(.staged) img");
        const name = controls.querySelector("[data-preset-name-input]");
        name.value = "未保存预设";
        const appearanceTab = controls.querySelector("[data-panel-page='appearance']");
        appearanceTab.focus();
        appearanceTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
        const keyboardPage = visiblePages();
        const search = controls.querySelector("[data-library-search]");
        search.value = "Fixture";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        appearanceTab.click();
        const editor = opacity.closest(".range");
        editor.querySelector("button").click();
        const number = editor.querySelector("input[type='number']");
        const exactInputFocused = document.activeElement === number;
        number.value = "64.5";
        number.dispatchEvent(new Event("input", { bubbles: true }));
        const exactPreview = root.querySelector("[data-codex-wallpaper-layer]").style.opacity;
        controls.querySelector("[data-codex-wallpaper-panel] header button").click();
        ${toggleSettings};
        const exactSaved = JSON.parse(localStorage.getItem("codex-wallpaper-p1-config")).settings.opacity;
        const sameImage = root.querySelector(".media:not(.staged) img") === image;
        const exactReopened = opacityOutput.textContent;
        let disableWrites = 0;
        const originalDisableSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === "codex-wallpaper-p1-config") disableWrites += 1;
          return originalDisableSetItem.call(this, key, value);
        };
        opacity.value = "55";
        opacity.dispatchEvent(new Event("input", { bubbles: true }));
        await globalThis.__codexWallpaperApi.disable();
        const disabledConfig = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        Storage.prototype.setItem = originalDisableSetItem;
        return {
          previewBeforeSettle,
          visibleOpacityAfterPreview,
          visibleOpacityAfterSync,
          keptOpacityText: opacityOutput.firstChild === opacityText,
          savedBeforeSettle,
          writesAfterBlur,
          savedAfterBlur,
          appearancePage,
          playbackPage,
          reopenedOpacity,
          localBeforeRemote,
          localOpacityAfterCombinedSave: afterCombinedSave.settings.opacity,
          remoteVolumeAfterCombinedSave: afterCombinedSave.settings.volume,
          displayedOpacityAfterCombinedSave,
          displayedVolumeAfterCombinedSave: displayedVolume,
          stateVolumeAfterCombinedSave,
          remoteApplied,
          remoteVolumeApplied,
          displayedAfterRemote,
          keyboardPage,
          retainedFilter: search.value,
          retainedDraft: name.value,
          exactInputFocused,
          exactPreview,
          exactSaved,
          exactReopened,
          disableWrites,
          disabledValue: disabledConfig.settings.opacity,
          disabledEnabled: disabledConfig.enabled,
          sameImage
        };
      })()`,
      options
    ),
    {
      previewBeforeSettle: "0.5",
      visibleOpacityAfterPreview: "50%",
      visibleOpacityAfterSync: "80%",
      keptOpacityText: true,
      savedBeforeSettle: 100,
      writesAfterBlur: 1,
      savedAfterBlur: 50,
      appearancePage: ["appearance"],
      playbackPage: ["playback"],
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
      keyboardPage: ["library"],
      retainedFilter: "Fixture",
      retainedDraft: "未保存预设",
      exactInputFocused: true,
      exactPreview: "0.645",
      exactSaved: 64.5,
      exactReopened: "64.5%",
      disableWrites: 1,
      disabledValue: 55,
      disabledEnabled: false,
      sameImage: true,
    }
  );
});

test("cross-window settings update in place without rebuilding cards or media", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
        ${toggleSettings};
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
        const content = panel.querySelector(".panel-content");
        panel.querySelector("[data-panel-page='playback']").click();
        const settings = controls.querySelector(".settings-grid");
        const cards = [...controls.querySelectorAll(".card")];
        const media = root.querySelector(".media");
        const volume = [...controls.querySelectorAll(".range")].find(
          (range) => range.querySelector("span")?.textContent === "音量"
        ).querySelector("input");
        volume.focus();
        content.scrollTop = 60;
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
        const peer = document.createElement("iframe");
        peer.hidden = true;
        document.body.append(peer);
        const synced = new Promise((resolve) => window.addEventListener("storage", resolve, { once: true }));
        peer.contentWindow.localStorage.setItem("codex-wallpaper-p1-config", next);
        await synced;
        peer.remove();
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
          contentScrollTop: content.scrollTop,
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
      contentScrollTop: 60,
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
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
        const controls = document.getElementById("${controlRootId}");
        ${toggleSettings};
        const appearance = controls.querySelector(".settings-grid");
        const appearanceControl = appearance.firstElementChild;
        const playback = controls.querySelector("[data-playback-settings]");
        const playbackControl = playback.firstElementChild;
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
          appearanceSame:
            appearance === controls.querySelector(".settings-grid") &&
            appearanceControl ===
              controls.querySelector(".settings-grid").firstElementChild,
          playbackSame:
            playback === controls.querySelector("[data-playback-settings]") &&
            playbackControl ===
              controls.querySelector("[data-playback-settings]").firstElementChild,
          staged: root.querySelectorAll(".media.staged").length,
          active: globalThis.__codexWallpaperApi.state().activeId
        };
      })()`,
      options
    ),
    {
      imageReplaced: true,
      nextImageVisible: true,
      appearanceSame: true,
      playbackSame: true,
      staged: 0,
      active: "fixture-image-next",
    }
  );
});

test("opening and closing the mounted panel does not rebuild wallpaper cards", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
        const list = panel.querySelector(".wallpaper-list");
        const beforeOpenCards = list.querySelectorAll(".card").length;
        ${toggleSettings};
        const opened = panel.classList.contains("open");
        const firstOpenCards = list.querySelectorAll(".card").length;
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
        ${toggleSettings};
        const closed = !panel.classList.contains("open");
        ${toggleSettings};
        const reopened = panel.classList.contains("open");
        await new Promise((resolve) => setTimeout(resolve, 20));
        observer.disconnect();
        return {
          beforeOpenCards,
          firstOpenCards,
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
      beforeOpenCards: 0,
      firstOpenCards: 2,
      opened: true,
      closed: true,
      reopened: true,
      sameCards: true,
      addedCards: 0,
    }
  );
});

test("rotation requests an item without a preview and respects background pause", async (t) => {
  const image =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='red'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "still",
        title: "Still",
        type: "image",
        playable: true,
        assetDataUrl: image,
      },
      {
        id: "on-demand",
        title: "On demand",
        type: "video",
        reason: "asset-not-loaded",
      },
    ],
  });
  await applyStaticBackground(port, options);
  const result = await evaluateInPage(
    port,
    `(async () => {
    const select = (selector) => document.querySelector("#${controlRootId} " + selector);
    const action = (id, action) =>
      select('.card[data-entry-id="' + id + '"] [data-entry-action="' + action + '"]');
    const runtime = globalThis.__codexWallpaperApi;
    const requests = [];
    globalThis.__codexWallpaperHostRequest = (raw) => requests.push(JSON.parse(raw));
    let tick = null;
    let visibility = "visible";
    const setInterval = window.setInterval;
    const clearInterval = window.clearInterval;
    window.setInterval = (callback, delay, ...args) => {
      if (delay !== 60000) return setInterval(callback, delay, ...args);
      tick = callback;
      return -1;
    };
    window.clearInterval = (id) => {
      if (id === -1) tick = null;
      else clearInterval(id);
    };
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    ${toggleSettings};
    action("still", "use").click();
    action("still", "queue").click();
    action("on-demand", "queue").click();
    select("[data-panel-page='playback']").click();
    const minutes = select("[data-setting='rotationMinutes']");
    minutes.value = "1";
    minutes.dispatchEvent(new Event("input", { bubbles:true }));
    select("[data-panel-page='library']").click();
    const saved = JSON.parse(localStorage.getItem("codex-wallpaper-p1-config")).settings.rotationMinutes;
    const summary = select(".playlist-summary").textContent;
    visibility = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    const stoppedWhileHidden = tick === null;
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    tick?.();
    const request = requests.find((entry) => entry.type === "load-asset");
    if (!request) return { saved, summary, stoppedWhileHidden, request: null };
    const opened = runtime.beginAssetTransfer({ id: "on-demand" });
    action("still", "use").click();
    return {
      saved,
      summary,
      stoppedWhileHidden,
      request: { type: request.type, id: request.id },
      startedTransfer: opened !== false,
      discardedChunk: runtime.appendAssetTransferChunk("on-demand", "AA==") === false,
      discardedEnd: (await runtime.finishAssetTransfer("on-demand")) === false,
      newSelection: runtime.state().activeId,
    };
  })()`,
    options
  );
  assert.deepEqual(result, {
    saved: 1,
    summary: "轮播：Still · On demand",
    stoppedWhileHidden: true,
    request: { type: "load-asset", id: "on-demand" },
    startedTransfer: true,
    discardedChunk: true,
    discardedEnd: true,
    newSelection: "still",
  });
});

test("wallpaper library shell combines filters without reloading the current media", async (t) => {
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
      ${toggleSettings};
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
      transfer.items.add(
        new File([Uint8Array.from(atob(${JSON.stringify(tinyMp4)}), (char) => char.charCodeAt(0))], "Imported Motion.mp4", {
          type: "video/mp4"
        })
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
      const importedCard = [...panel.querySelectorAll(".card")].find(
        (card) =>
          card.querySelector("strong")?.textContent === "Imported Sunset.svg"
      );
      importedCard.scrollIntoView({ block: "center" });
      let importedPreviewLoaded = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        importedPreviewLoaded = Boolean(
          importedCard.querySelector(".thumb img, .thumb video")
        );
        if (importedPreviewLoaded) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      search.value = "motion";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      const importedVideoCard = [...panel.querySelectorAll(".card")].find(
        (card) =>
          card.querySelector("strong")?.textContent === "Imported Motion.mp4"
      );
      importedVideoCard.scrollIntoView({ block: "center" });
      let importedVideoPreviewLoaded = false;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        importedVideoPreviewLoaded = Boolean(
          importedVideoCard.querySelector(".thumb video")
        );
        if (importedVideoPreviewLoaded) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
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
      const content = panel.querySelector(".panel-content");
      content.scrollTop = content.scrollHeight;
      const scrollable =
        getComputedStyle(content).overflowY === "auto" &&
        content.scrollHeight > content.clientHeight &&
        content.scrollTop > 0;

      const close = panel.querySelector("header button");
      close.click();
      ${toggleSettings};
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
        importedPreviewLoaded,
        importedVideoPreviewLoaded,
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
    regionNames: ["library", "playback", "appearance"],
    visibleTitles: ["Fixture Image"],
    resultText: "显示 1 / 7 项",
    statuses: {
      scene: "scene · 原生渲染",
      webFallback: "web · 预览降级",
      onDemand: "image · 按需加载",
    },
    importedFilterVisible: true,
    importedPreviewLoaded: true,
    importedVideoPreviewLoaded: true,
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

test("late Web preview commits when that Web item is already current", async (t) => {
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23f97316'/%3E%3C/svg%3E";
  const { port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "fixture-web-late",
        title: "Fixture Web Late",
        type: "web",
        playable: false,
        fallback: true,
        previewDataUrl: null,
        assetDataUrl: null,
        webHtml: null,
        reason: "web-preview-fallback",
      },
    ],
  });
  await evaluateInPage(
    port,
    `localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
      enabled: true,
      active: { kind: "workshop", id: "fixture-web-late" },
      favorites: [],
      playlist: [],
      settings: { fps: 30, volume: 0 }
    }))`,
    options
  );
  await applyStaticBackground(port, options);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        await globalThis.__codexWallpaperApi.receivePreview({
          id: "fixture-web-late",
          previewDataUrl: ${JSON.stringify(preview)},
          fallback: true
        });
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const image = document.querySelector(
            "#${rootId} .media:not(.staged) img"
          );
          if (image?.complete && image.naturalWidth > 0)
            return {
              activeId: globalThis.__codexWallpaperApi.state().activeId,
              image: image.src === ${JSON.stringify(preview)},
              staged: document.querySelectorAll("#${rootId} .media.staged").length
            };
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return null;
      })()`,
      options
    ),
    { activeId: "fixture-web-late", image: true, staged: 0 }
  );
});

test("playback profiles and capability controls apply without replacing media", async (t) => {
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
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
      ${toggleSettings};
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.querySelector("[data-panel-page='playback']").click();

      const initial = {
        profile: panel.querySelector("[data-playback-profile]").value,
        summary: panel.querySelector("[data-performance-summary]").textContent,
        tradeoff: panel.querySelector("[data-performance-tradeoff]").textContent,
        capability: panel.querySelector("[data-playback-capability]").textContent,
        fpsControl: Boolean(panel.querySelector("[data-setting='fps']")),
        audioDisabled: panel.querySelector("[data-setting='volume']").disabled && panel.querySelector("[data-setting='muted']").disabled,
        pauseDisabled: panel.querySelector(
          "[data-setting='pauseWhenHidden']"
        ).disabled
      };

      const selectMedia = async (id, ready) => {
        panel.querySelector("[data-panel-page='library']").click();
        panel
          .querySelector(\`.card[data-entry-id="\${id}"] [data-entry-action='use']\`)
          .click();
        for (let attempt = 0; attempt < 200; attempt += 1) {
          if (ready()) {
            panel.querySelector("[data-panel-page='playback']").click();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error(\`Timed out selecting \${id}: \${panel.querySelector(".runtime-status").textContent}\`);
      };

      await selectMedia(
        "fixture-video",
        () => Boolean(root.querySelector(".media:not(.staged) video"))
      );
      const videoMedia = root.querySelector(".media:not(.staged)");
      const video = videoMedia.querySelector("video");
      const volume = panel.querySelector("[data-setting='volume']");
      volume.value = "43";
      volume.dispatchEvent(new Event("input", { bubbles: true }));
      volume.dispatchEvent(new Event("change", { bubbles: true }));
      const mute = panel.querySelector("[data-setting='muted']");
      const unmutedByVolume =
        mute.checked === false && video.muted === false && video.volume === 0.43;
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
        tradeoff: panel.querySelector("[data-performance-tradeoff]").textContent,
        mediaSame: root.querySelector(".media:not(.staged)") === videoMedia
      };

      await selectMedia(
        "fixture-scene",
        () => Boolean(root.querySelector(".media:not(.staged) .scene-host.ready"))
      );
      const sceneFpsFromProfile = globalThis.__t05SceneFps;
      const fps = panel.querySelector("[data-setting='fps']");
      fps.value = "24";
      fps.dispatchEvent(new Event("input", { bubbles: true }));
      fps.dispatchEvent(new Event("change", { bubbles: true }));
      const custom = {
        profile: panel.querySelector("[data-playback-profile]").value,
        fps: fps.value,
        sceneFps: globalThis.__t05SceneFps,
        summary: panel.querySelector("[data-performance-summary]").textContent,
        tradeoff: panel.querySelector("[data-performance-tradeoff]").textContent
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
      const directProfile = panel.querySelector("[data-playback-profile]");
      directProfile.value = "balanced";
      directProfile.dispatchEvent(new Event("change", { bubbles: true }));
      directProfile.value = "custom";
      directProfile.dispatchEvent(new Event("change", { bubbles: true }));
      const directCustom = {
        profile: panel.querySelector("[data-playback-profile]").value,
        fps: globalThis.__codexWallpaperApi.state().fpsCap
      };

      await selectMedia(
        "fixture-image",
        () => Boolean(root.querySelector(".media:not(.staged) img"))
      );
      const imageCapability = {
        fpsControl: Boolean(panel.querySelector("[data-setting='fps']")),
        audioDisabled: panel.querySelector("[data-setting='volume']").disabled && panel.querySelector("[data-setting='muted']").disabled,
        pauseDisabled: panel.querySelector(
          "[data-setting='pauseWhenHidden']"
        ).disabled,
        text: panel.querySelector("[data-playback-capability]").textContent
      };

      await selectMedia(
        "fixture-web",
        () => Boolean(root.querySelector(".media:not(.staged) iframe"))
      );
      const webCapability =
        {
          text: panel.querySelector("[data-playback-capability]").textContent,
          pauseDisabled: panel.querySelector(
            "[data-setting='pauseWhenHidden']"
          ).disabled
        };

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
      ${toggleSettings};
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
        directCustom,
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
      summary: "当前图片不使用帧率；已保存 Scene 上限 30 FPS · 不可见时暂停",
      tradeoff: "取舍：保留现有 30 FPS 上限，优先画面连续性。",
      capability: "图片稳定显示后不持续绘制；帧率不适用。",
      fpsControl: false,
      audioDisabled: true,
      pauseDisabled: true,
    },
    videoControls: {
      volume: 0.43,
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
      summary: "当前视频按源播放；已保存 Scene 上限 15 FPS · 不可见时暂停",
      tradeoff:
        "取舍：降低 Scene 绘制上限以减少渲染活动，画面连续性可能低于 30 FPS。",
      mediaSame: true,
    },
    sceneFpsFromProfile: 15,
    custom: {
      profile: "custom",
      fps: "24",
      sceneFps: 24,
      summary: "参数：Scene 上限 24 FPS · 不可见时暂停",
      tradeoff: "取舍：使用手动参数组合，不再自动套用命名档位。",
    },
    pauseEnabled: { paused: true, resumed: true },
    pauseDisabled: { paused: false, resumed: true },
    directCustom: {
      profile: "custom",
      fps: 30,
    },
    imageCapability: {
      fpsControl: false,
      audioDisabled: true,
      pauseDisabled: true,
      text: "图片稳定显示后不持续绘制；帧率不适用。",
    },
    webCapability: {
      text: "Web iframe 内部帧率和暂停无法由父页面可靠控制。",
      pauseDisabled: true,
    },
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

test("Codex form resets leave wallpaper settings controls visible and operable", async (t) => {
  const { port, options } = await startRuntimeFixture(t, { version: 1, library: [] });
  const evaluate = (expression) => evaluateInPage(port, expression, options);
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: "center", container: "nearest" })`);
    assert.equal(await clickAtElementCenter(port, options, selector), true, selector);
  };
  await evaluate(`(() => {
    const style = document.createElement("style");
    style.textContent = \`
      input[type=checkbox] { appearance: none; border: 0; padding: 0; margin: 0 }
      input[type=range], select { appearance: none }
      [data-composer-surface-variant] { position: fixed; right: 140px; bottom: 20px; width: 440px; height: 72px; box-sizing: border-box }
    \`;
    document.head.append(style);
  })()`);
  await applyStaticBackground(port, options);
  await pressWallpaperShortcut(port, options, "S");
  await waitForCondition(
    async () =>
      await evaluate(
        'document.querySelector("#codex-wallpaper-p1-controls .panel.open") !== null'
      ),
    2000,
    "Wallpaper settings panel did not open"
  );
  assert.equal(
    await evaluate('getComputedStyle(document.querySelector("[data-playback-profile]")).appearance'),
    "auto"
  );
  await click("[data-panel-page=appearance]");
  const preference = "JSON.parse(localStorage.getItem('codex-wallpaper-p1-config')).settings";
  const border = "[data-setting=interfaceBorders]";
  const scopes = ["chat", "left", "sidebar", "right", "settings"];
  const affordance = await evaluate(`(() => {
    const box = document.querySelector('${border}');
    return { appearance: getComputedStyle(box).appearance, width: box.offsetWidth, height: box.offsetHeight };
  })()`);
  assert.notEqual(affordance.appearance, "none", border);
  assert.ok(affordance.width >= 16 && affordance.height >= 16, border);
  assert.equal(await evaluate(
    'document.querySelector("[data-panel-region=appearance] [data-setting=surfaceOpacity]") === null'
  ), true);
  assert.equal(await evaluate(
    'document.querySelector("[data-panel-region=appearance] .surface-overrides").closest("details") === null'
  ), true);

  const initialBorders = await evaluate(`document.querySelector('${border}').checked`);
  await click(border);
  assert.equal(await evaluate(`${preference}.interfaceBorders`), !initialBorders);
  await click(border);
  assert.equal(await evaluate(`${preference}.interfaceBorders`), initialBorders);

  for (const scope of scopes) {
    const slider = `[data-surface-override-value=${scope}]`;
    const restore = `[data-restore-surface=${scope}]`;
    const state = () => evaluate(`[
      document.querySelector('${slider}').disabled,
      document.querySelector('${restore}').disabled
    ]`);
    assert.deepEqual(await state(), [false, false]);
    assert.equal(await evaluate(`document.querySelector('${restore}').textContent`), "恢复默认");
    const inherited = await evaluate(`document.querySelector('${slider}').value`);
    await click(slider);
    for (const type of ["rawKeyDown", "keyUp"]) {
      await callMainPage(port, "Input.dispatchKeyEvent",
        { type, key: "End", code: "End", windowsVirtualKeyCode: 35 }, options.page, true);
    }
    assert.equal(await evaluate(`${preference}.surfaceOverrides.${scope}`), 100);
    assert.equal(await evaluate(`document.querySelector('${slider}').nextElementSibling.textContent`), "100%");
    assert.deepEqual(await state(), [false, false]);
    for (let repeat = 0; repeat < 2; repeat += 1) {
      await click(restore);
      assert.deepEqual(await state(), [false, false]);
      assert.equal(await evaluate(`document.querySelector('${slider}').value`), inherited);
      assert.equal(await evaluate(`${preference}.surfaceOverrides.${scope}`), null);
      assert.equal(await evaluate(`document.activeElement === document.querySelector('${restore}')`), true);
    }
  }
});

test("appearance controls update wallpaper and surface layers without reloading media", async (t) => {
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
    ],
  });
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
          surfaceOpacity: 55,
          fps: 30,
          volume: 0,
          rotationMinutes: 0
        }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);

  const first = await evaluateInPage(
    port,
    `(async () => {
      const controls = document.getElementById("${controlRootId}");
      const root = document.getElementById("${rootId}");
      ${toggleSettings};
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.querySelector("[data-panel-page='appearance']").click();
      const media = root.querySelector(".media:not(.staged)");
      const image = media.querySelector("img");
      const titlebar = document.querySelector("[data-app-shell-titlebar]");
      const settingsHost = document.createElement("div");
      settingsHost.dataset.appShellFeatureNavigation = "true";
      settingsHost.innerHTML =
        '<nav data-settings-nav-scroll-container></nav><main data-app-shell-main-surface><div class="electron:bg-surface">Settings</div></main>';
      document.body.append(settingsHost);
      const settingsCanvas = settingsHost.querySelector(
        "[class~='electron:bg-surface']"
      );
      const alphaOf = (value) => {
        const alpha = value.match(/\\/\\s*([\\d.]+)\\s*\\)$/)?.[1];
        if (alpha !== undefined) return Number(alpha);
        if (value.startsWith("rgba(")) return Number(value.slice(5, -1).split(",").at(-1));
        return 1;
      };
      const setRange = (name, value) => {
        const input = panel.querySelector(\`[data-setting="\${name}"]\`);
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      setRange("dim", "35");
      setRange("blur", "7");
      setRange("opacity", "80");

      const fit = panel.querySelector("[data-setting='fitMode']");
      const fitAvailable = Boolean(fit);
      fit.value = "contain";
      fit.dispatchEvent(new Event("change", { bubbles: true }));
      const fitResult = {
        fit: fit.value,
        objectFit: getComputedStyle(image).objectFit,
        mediaSame: root.querySelector(".media:not(.staged)") === media
      };

      const rootStyleBeforePreview = document.documentElement.getAttribute("style");
      const surfaceAlpha = (selector) =>
        alphaOf(getComputedStyle(document.querySelector(selector)).backgroundColor);
      const globalSurface = surfaceAlpha("body [data-app-shell-frame]");
      const inheritedChat = surfaceAlpha("[data-app-shell-main-surface]");
      const inheritedSidebar = surfaceAlpha("[data-app-shell-page-sidebar]");
      const frame = document.querySelector("[data-app-shell-frame]");
      frame.dataset.appShellResponsiveSidebar = "false";
      frame.dataset.appShellApplicationMenuBar = "true";
      frame.style.setProperty("--app-shell-sidebar-docked-background", "rgb(24 24 28 / .5)");
      frame.style.setProperty("--app-shell-application-menu-height", "36px");
      frame.style.setProperty("--app-shell-titlebar-height", "8px");
      frame.style.backgroundImage = "linear-gradient(var(--app-shell-sidebar-docked-background), var(--app-shell-sidebar-docked-background))";
      const dockedRow = document.createElement("div");
      dockedRow.dataset.appShellWorkspaceRow = "";
      dockedRow.innerHTML = '<div data-app-shell-workspace><div data-app-shell-left-panel-appearance></div><div data-app-shell-surface-backing style="position:absolute;inset:0;border-start-start-radius:12px"></div></div>';
      frame.append(dockedRow);
      const chat = frame.querySelector("[data-app-shell-main-surface]");
      chat.classList.add("mt-(--app-shell-titlebar-height)");
      chat.style.borderInlineStart = "1px solid transparent";
      const layout = document.createElement("div");
      layout.dataset.appShellMainContentLayout = "thread-edge-scroll";
      layout.dataset.appShellWorkspaceLayout = "split";
      layout.style.minHeight = "180px";
      const right = document.createElement("div");
      right.dataset.appShellFocusArea = "right-panel";
      right.style.cssText = "position:absolute; inset:0 0 0 auto; width:180px";
      right.innerHTML = '<div data-app-shell-tabs><div style="background-color: var(--app-shell-panel-background, rgb(24 24 28))"><div data-app-shell-pane-content-viewport><diffs-container style="background-color:rgb(17 17 17)"></diffs-container><file-tree-container style="background-color:rgb(24 24 28)"></file-tree-container></div></div></div>';
      const fullView = document.createElement("button");
      fullView.textContent = "Enter full view";
      fullView.dataset.appShellWorkspaceLayoutToggle = "right-panel";
      titlebar.append(fullView);
      const tree = right.querySelector("file-tree-container");
      tree.style.display = "block";
      const treeShadow = tree.attachShadow({ mode: "open" });
      treeShadow.innerHTML = '<div data-file-tree-virtualized-scroll style="height:80px;overflow:auto"><div style="height:0"><div data-file-tree-sticky-overlay-content style="height:28px"></div></div><div data-file-tree-virtualized-list style="height:200px"></div></div>';
      const scrollChrome = document.createElement("div");
      scrollChrome.innerHTML = '<div aria-hidden="true" class="bg-[image:var(--app-shell-content-fade,transparent)]" style="background-image:linear-gradient(black,transparent)"></div><div><div data-app-action-timeline-scroll></div></div>';
      layout.append(scrollChrome);
      chat.append(titlebar, layout, right);
      const treeScroll = treeShadow.querySelector("[data-file-tree-virtualized-scroll]");
      const treeList = treeShadow.querySelector("[data-file-tree-virtualized-list]");
      const treeClipTop = () => parseFloat(treeList.style.clipPath.slice(6));
      const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await nextPaint();
      const initialTreeClip = treeClipTop();
      treeScroll.scrollTop = 15;
      await nextPaint();
      const scrolledTreeClip = treeClipTop();
      const backingElement = dockedRow.querySelector("[data-app-shell-surface-backing]");
      const wallpaperLayer = root.querySelector("[data-codex-wallpaper-layer]");
      const chatAlpha = () => alphaOf(getComputedStyle(layout).backgroundColor);
      const setSurface = (scope, value) => {
        const input = panel.querySelector('[data-surface-override-value=' + scope + ']');
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const scopes = ["chat", "left", "sidebar", "right", "settings"];
      const restoreSurface = (scope) => panel.querySelector('[data-restore-surface=' + scope + ']').click();
      const zoneState = () => [
        chatAlpha(),
        surfaceAlpha("[data-app-shell-left-panel-appearance]"),
        alphaOf(getComputedStyle(frame, "::before").backgroundColor),
        alphaOf(getComputedStyle(wallpaperLayer, "::before").backgroundColor),
        alphaOf(getComputedStyle(right).backgroundColor),
        alphaOf(getComputedStyle(wallpaperLayer, "::after").backgroundColor),
        alphaOf(getComputedStyle(panel).backgroundColor)
      ];
      for (const scope of scopes) setSurface(scope, "0");
      const allClear = {
        zones: zoneState(),
        frameColor: alphaOf(getComputedStyle(frame).backgroundColor),
        frameImage: getComputedStyle(frame).backgroundImage,
        backingColor: alphaOf(getComputedStyle(backingElement).backgroundColor),
        backingImage: getComputedStyle(backingElement).backgroundImage,
        main: alphaOf(getComputedStyle(chat).backgroundColor),
        header: alphaOf(getComputedStyle(titlebar).backgroundColor),
        rightInner: alphaOf(getComputedStyle(right.firstElementChild.firstElementChild).backgroundColor),
        rightComponents: [...right.querySelectorAll("diffs-container, file-tree-container")].map((element) => [
          alphaOf(getComputedStyle(element).backgroundColor),
          getComputedStyle(element).getPropertyValue("--color-surface")
        ]),
        panelFilter: getComputedStyle(panel).backdropFilter
      };
      const oneAtATime = scopes.map((scope) => {
        setSurface(scope, "40");
        const state = zoneState();
        setSurface(scope, "0");
        return state;
      });
      for (const scope of scopes) restoreSurface(scope);
      const defaults = zoneState();
      const leftRange = panel.querySelector("[data-surface-override-value='left']");
      const leftDefault = leftRange.value;
      const leftState = () => ({
        left: surfaceAlpha("[data-app-shell-left-panel-appearance]"),
        frame: surfaceAlpha("[data-app-shell-frame]"),
        chat: chatAlpha()
      });
      leftRange.value = "42";
      leftRange.dispatchEvent(new Event("input", { bubbles: true }));
      const customLeft = leftState();
      leftRange.value = "0";
      leftRange.dispatchEvent(new Event("input", { bubbles: true }));
      const clearLeft = leftState();
      panel.querySelector("[data-restore-surface='left']").click();
      const restoredLeft = leftState();
      const dimLayer = wallpaperLayer.querySelector(".dim");
      setRange("interfaceBlur", "8");
      const blurState = () => [
        getComputedStyle(panel).backdropFilter,
        getComputedStyle(root, "::after").backdropFilter,
        getComputedStyle(dimLayer, "::after").backdropFilter,
        getComputedStyle(right).backdropFilter,
      ];
      const settingsOnlyBlur = blurState();
      setRange("chatBlur", "12");
      setRange("interfaceBlur", "0");
      const chatOnlyBlur = blurState();
      const chatBox = layout.getBoundingClientRect();
      const blurStyle = getComputedStyle(root, "::after");
      const chatBlurMatchesLayout = ["left", "top", "width", "height"].every(
        (property) => Math.abs(parseFloat(blurStyle[property]) - chatBox[property]) < 1
      );
      setRange("chatBlur", "0");
      const rightOnlyBlur = ["0", "12", "24"].map((value) => {
        setRange("rightBlur", value);
        return blurState();
      });
      const rightBox = right.getBoundingClientRect();
      const rightBlurStyle = getComputedStyle(dimLayer, "::after");
      const titleTop = titlebar.getBoundingClientRect().top;
      const rightBlurMatchesLayout = [
        ["left", rightBox.left],
        ["top", titleTop],
        ["width", rightBox.width],
        ["height", rightBox.bottom - titleTop]
      ].every(([property, value]) => Math.abs(parseFloat(rightBlurStyle[property]) - value) < 1);
      setRange("rightBlur", "12");
      setRange("chatBlur", "12");
      setRange("interfaceBlur", "8");
      const projectSidebar = document.querySelector("[data-slate-sidebar-content]");
      const projectBlurBefore = getComputedStyle(projectSidebar).backdropFilter;
      setRange("projectSidebarBlur", "14");
      const projectBlur = getComputedStyle(projectSidebar).backdropFilter;
      const railBlur = getComputedStyle(document.querySelector("[data-app-navigation-rail]")).backdropFilter;
      const previewKeepsRootStyle =
        document.documentElement.getAttribute("style") === rootStyleBeforePreview;
      const borders = panel.querySelector(
        "[data-setting-toggle='interfaceBorders']"
      );
      borders.click();
      const bordersOff =
        document.documentElement.style.getPropertyValue(
          "--codex-wallpaper-line"
        ) === "transparent";

      const topPaintValue = () => getComputedStyle(frame, "::before").backgroundColor;
      const header = getComputedStyle(titlebar);
      const topPaint = getComputedStyle(frame, "::before");
      const backing = getComputedStyle(dockedRow.querySelector("[data-app-shell-surface-backing]"));
      const seamlessTop = {
        headerTint: alphaOf(getComputedStyle(wallpaperLayer, "::before").backgroundColor) === alphaOf(topPaint.backgroundColor) && header.boxShadow === "none" && header.borderRadius === "0px",
        nativeCorner: backing.insetBlockStart === "0px" && backing.borderStartStartRadius === "12px",
        chatCoversInset: getComputedStyle(chat).paddingBlockStart === "8px",
        sharedTint: topPaint.pointerEvents === "none" && parseFloat(topPaint.height) === 44,
        fadesContent: getComputedStyle(scrollChrome.firstElementChild).backgroundImage === "none" &&
          getComputedStyle(scrollChrome.querySelector("[data-app-action-timeline-scroll]")).maskImage !== "none"
      };
      const flushChatEdge = Math.abs(layout.getBoundingClientRect().left - chat.getBoundingClientRect().left) < 0.1;
      const defaultTopPaint = topPaintValue();
      const sidebarRange = panel.querySelector(
        "[data-surface-override-value='sidebar']"
      );
      sidebarRange.value = "40";
      sidebarRange.dispatchEvent(new Event("input", { bubbles: true }));
      const customTopPaint = topPaintValue();
      panel.querySelector("[data-restore-surface='sidebar']").click();
      const restoredTopPaint = topPaintValue();

      const settingsCanvasBefore = alphaOf(
        getComputedStyle(settingsCanvas).backgroundColor
      );
      const settingsRange = panel.querySelector(
        "[data-surface-override-value='settings']"
      );
      settingsRange.value = "70";
      settingsRange.dispatchEvent(new Event("input", { bubbles: true }));
      const settingsCanvasAfter = alphaOf(
        getComputedStyle(settingsCanvas).backgroundColor
      );
      panel.querySelector("[data-restore-surface='settings']").click();

      const chatRange = panel.querySelector(
        "[data-surface-override-value='chat']"
      );
      const inheritedValue = chatRange.value;
      const restoreChat = panel.querySelector("[data-restore-surface='chat']");
      chatRange.value = "30";
      chatRange.dispatchEvent(new Event("input", { bubbles: true }));
      const override = {
        inheritedValue,
        rangeEnabled: !chatRange.disabled,
        value: chatAlpha()
      };
      restoreChat.click();
      const restored = {
        rangeEnabled: !chatRange.disabled,
        value: chatAlpha()
      };

      document.documentElement.dataset.theme = "light";
      const lightBackground = getComputedStyle(layout).backgroundColor;
      const lightAlpha = Number(
        lightBackground.match(/\\/\\s*([\\d.]+)\\s*\\)$/)?.[1]
      );
      document.documentElement.dataset.theme = "dark";

      panel.querySelector("header button").click();
      ${toggleSettings};
      const reopened = {
        fit: panel.querySelector("[data-setting='fitMode']").value,
        sidebarReadability:
          panel.querySelector("[data-surface-override-value='sidebar']").value,
        settingsBlur: panel.querySelector("[data-setting='interfaceBlur']").value,
        chatBlur: panel.querySelector("[data-setting='chatBlur']").value,
        rightBlur: panel.querySelector("[data-setting='rightBlur']").value,
        projectBlur: panel.querySelector("[data-setting='projectSidebarBlur']").value,
        borders: panel.querySelector(
          "[data-setting-toggle='interfaceBorders']"
        ).checked,
        restoreAvailable: !panel.querySelector(
          "[data-restore-surface='chat']"
        ).disabled,
        mediaSame: root.querySelector(".media:not(.staged)") === media
      };

      const previous = localStorage.getItem("codex-wallpaper-p1-config");
      const pendingChatRange = panel.querySelector(
        "[data-surface-override-value='chat']"
      );
      pendingChatRange.value = "44";
      pendingChatRange.dispatchEvent(new Event("input", { bubbles: true }));
      const next = JSON.stringify({
        ...JSON.parse(previous),
        settings: {
          ...JSON.parse(previous).settings,
          fitMode: "contain",
          surfaceOpacity: 60,
          interfaceBlur: 4,
          chatBlur: 16,
          rightBlur: 20,
          interfaceBorders: true,
          surfaceOverrides: { chat: null, sidebar: null, right: null, settings: 70 }
        }
      });
      localStorage.setItem("codex-wallpaper-p1-config", next);
      const syncedMedia = root.querySelector(".media:not(.staged)");
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
        sidebarReadability:
          panel.querySelector("[data-surface-override-value='sidebar']").value,
        fit: panel.querySelector("[data-setting='fitMode']").value,
        chatOverride: chatAlpha(),
        projectBlur: getComputedStyle(projectSidebar).backdropFilter,
        settingsOverride: alphaOf(getComputedStyle(panel).backgroundColor)
      };

      return {
        mediaSame:
          root.querySelector(".media:not(.staged) img") === image,
        dim: root.querySelector(
          "[data-codex-wallpaper-layer] .dim"
        ).style.background,
        filter: media.style.filter,
        opacity:
          root.querySelector("[data-codex-wallpaper-layer]").style.opacity,
        fitAvailable,
        fitResult,
        globalSurface,
        inheritedChat,
        inheritedSidebar,
        leftDefault,
        customLeft,
        clearLeft,
        restoredLeft,
        allClear,
        oneAtATime,
        pinnedTreeClips: [initialTreeClip, scrolledTreeClip],
        defaults,
        settingsOnlyBlur,
        chatOnlyBlur,
        chatBlurMatchesLayout,
        rightOnlyBlur,
        rightBlurMatchesLayout,
        syncedBlur: blurState(),
        projectBlurBefore,
        projectBlur,
        railBlur,
        previewKeepsRootStyle,
        bordersOff,
        seamlessTop,
        flushChatEdge,
        top: {
          changes: customTopPaint !== defaultTopPaint,
          restores: restoredTopPaint === defaultTopPaint
        },
        settingsSurface: {
          changes: settingsCanvasAfter !== settingsCanvasBefore,
          effective: settingsCanvasAfter > 0
        },
        override,
        restored,
        lightSurfaceTranslucent: lightAlpha > 0 && lightAlpha < 1,
        reopened,
        crossWindow
      };
    })()`,
    options
  );

  assert.deepEqual(first, {
    mediaSame: true,
    dim: "rgba(4, 6, 15, 0.35)",
    filter: "blur(7px)",
    opacity: "0.8",
    fitAvailable: true,
    fitResult: {
      fit: "contain",
      objectFit: "contain",
      mediaSame: true,
    },
    globalSurface: 0.55,
    inheritedChat: 0.14,
    inheritedSidebar: 0.55,
    leftDefault: "55",
    customLeft: { left: 0.42, frame: 0, chat: 0.14 },
    clearLeft: { left: 0, frame: 0, chat: 0.14 },
    restoredLeft: { left: 0.55, frame: 0, chat: 0.14 },
    allClear: {
      zones: [0, 0, 0, 0, 0, 0, 0],
      frameColor: 0,
      frameImage: "none",
      backingColor: 0,
      backingImage: "none",
      main: 0,
      header: 0,
      rightInner: 0,
      rightComponents: [[0, "transparent"], [0, "transparent"]],
      panelFilter: "none",
    },
    oneAtATime: [
      [0.4, 0, 0, 0, 0, 0, 0],
      [0, 0.4, 0, 0, 0, 0, 0],
      [0, 0, 0.4, 0.4, 0, 0, 0],
      [0, 0, 0, 0, 0.4, 0.4, 0],
      [0, 0, 0, 0, 0, 0, 0.4],
    ],
    pinnedTreeClips: [28, 43],
    defaults: [0.14, 0.55, 0.55, 0.55, 0, 0, 0.9104],
    settingsOnlyBlur: ["blur(8px)", "none", "none", "none"],
    chatOnlyBlur: ["none", "blur(12px)", "none", "none"],
    chatBlurMatchesLayout: true,
    rightOnlyBlur: [
      ["none", "none", "none", "none"],
      ["none", "none", "blur(12px)", "none"],
      ["none", "none", "blur(24px)", "none"],
    ],
    rightBlurMatchesLayout: true,
    syncedBlur: ["blur(4px)", "blur(16px)", "blur(20px)", "none"],
    projectBlurBefore: "none",
    projectBlur: "blur(14px)",
    railBlur: "blur(14px)",
    previewKeepsRootStyle: true,
    bordersOff: true,
    seamlessTop: { headerTint: true, nativeCorner: true, chatCoversInset: true, sharedTint: true, fadesContent: true },
    flushChatEdge: true,
    top: { changes: true, restores: true },
    settingsSurface: {
      changes: true,
      effective: true,
    },
    override: {
      inheritedValue: "14",
      rangeEnabled: true,
      value: 0.3,
    },
    restored: {
      rangeEnabled: true,
      value: 0.14,
    },
    lightSurfaceTranslucent: true,
    reopened: {
      fit: "contain",
      sidebarReadability: "55",
      settingsBlur: "8",
      chatBlur: "12",
      rightBlur: "12",
      projectBlur: "14",
      borders: false,
      restoreAvailable: true,
      mediaSame: true,
    },
    crossWindow: {
      mediaSame: true,
      sidebarReadability: "60",
      fit: "contain",
      chatOverride: 0.44,
      projectBlur: "blur(14px)",
      settingsOverride: 0.7,
    },
  });

  const second = await evaluateInPage(
    port,
    `(async () => {
      await globalThis.__codexWallpaperApi.disable();
      const mainAfterDisable = document.querySelector("[data-app-shell-main-surface]");
      const treeList = mainAfterDisable.querySelector("file-tree-container").shadowRoot.querySelector("[data-file-tree-virtualized-list]");
      const cleared =
        !document.getElementById("${rootId}-style") &&
        getComputedStyle(mainAfterDisable).backdropFilter === "none" &&
        getComputedStyle(mainAfterDisable).borderInlineStartWidth === "1px" &&
        treeList.style.clipPath === "";
      await globalThis.__codexWallpaperApi.enable();
      const root = document.getElementById("${rootId}");
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const image = root?.querySelector(".media:not(.staged) img");
        if (image?.complete && image.naturalWidth > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const controls = document.getElementById("${controlRootId}");
      ${toggleSettings};
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      return {
        cleared,
        state: globalThis.__codexWallpaperApi.state().state,
        fit: getComputedStyle(root.querySelector(".media img")).objectFit,
        sidebarReadability:
          panel.querySelector("[data-surface-override-value='sidebar']").value,
        chatBlur: panel.querySelector("[data-setting='chatBlur']").value,
        rightBlur: panel.querySelector("[data-setting='rightBlur']").value,
        settingsOverride: Number(getComputedStyle(panel).backgroundColor.match(/\\/\\s*([\\d.]+)\\s*\\)$/)?.[1])
      };
    })()`,
    options
  );
  assert.deepEqual(second, {
    cleared: true,
    state: "enabled",
    fit: "contain",
    sidebarReadability: "60",
    chatBlur: "16",
    rightBlur: "20",
    settingsOverride: 0.7,
  });
});

test("scene fit uses the installed renderer without replacing the active scene", async (t) => {
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
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
    ],
  });
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-scene" },
        favorites: [],
        playlist: [],
        settings: {
          dim: 18,
          blur: 0,
          opacity: 100,
          fitMode: "contain",
          surfaceOpacity: 72,
          interfaceBlur: 0,
          interfaceBorders: true,
          surfaceOverrides: { chat: null, sidebar: null, right: null, settings: null },
          fps: 30,
          volume: 0,
          muted: true,
          rotationMinutes: 0,
          performanceProfile: "balanced",
          pauseWhenHidden: true
        }
      })
    );
    globalThis.__sceneFitCalls = [];
    globalThis.WebWallGL = {
      bytesSource: () => ({}),
      createScene: (host, sceneOptions) => {
        globalThis.__sceneInitialFit = sceneOptions.fit;
        const canvas = document.createElement("canvas");
        host.append(canvas);
        return {
          load: () => Promise.resolve(),
          pause: () => {},
          resume: () => {},
          setFps: () => {},
          setVolume: () => {},
          setFit: (fit) => globalThis.__sceneFitCalls.push(fit),
          destroy: () => {}
        };
      }
    };`,
    options
  );
  await applyStaticBackground(port, options);

  const result = await evaluateInPage(
    port,
    `(async () => {
      const root = document.getElementById("${rootId}");
      const controls = document.getElementById("${controlRootId}");
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (root.querySelector(".media:not(.staged) .scene-host.ready")) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const media = root.querySelector(".media:not(.staged)");
      ${toggleSettings};
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.querySelector("[data-panel-page='appearance']").click();
      const fit = panel.querySelector("[data-setting='fitMode']");
      const before = {
        available: Boolean(fit),
        enabled: !fit.disabled,
        value: fit.value,
        initialRendererFit: globalThis.__sceneInitialFit
      };
      fit.value = "cover";
      fit.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        before,
        after: {
          value: fit.value,
          calls: globalThis.__sceneFitCalls,
          mediaSame: root.querySelector(".media:not(.staged)") === media
        }
      };
    })()`,
    options
  );

  assert.deepEqual(result, {
    before: {
      available: true,
      enabled: true,
      value: "contain",
      initialRendererFit: "contain",
    },
    after: {
      value: "cover",
      calls: ["contain", "cover"],
      mediaSame: true,
    },
  });
});

test("desktop startup publishes a scene frame at the fitted viewport ratio and clears it when disabled", async (t) => {
  const id = "123456";
  const { port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [{
      id, title: "Startup scene fixture", type: "scene", playable: true,
      assetDataUrl: "data:application/octet-stream;base64,AA==",
    }],
  });
  await evaluateInPage(port, `
    localStorage.setItem("codex-wallpaper-p1-config", JSON.stringify({
      enabled: true, active: { kind: "workshop", id: "${id}" },
      settings: { dim: 18, opacity: 100, fitMode: "cover" },
    }));
    globalThis.previewRequests = [];
    globalThis.__codexWallpaperHostRequest = raw => previewRequests.push(JSON.parse(raw));
    const links = globalThis[Symbol.for("webwallgl.runtime-link")] = new WeakMap();
    globalThis.WebWallGL = {
      bytesSource: () => ({}),
      createScene(host) {
        const canvas = globalThis.sceneCanvas = document.createElement("canvas");
        canvas.style.cssText = "width: 800px; height: 500px";
        host.append(canvas);
        const scene = {
          canvas, load: async () => {}, pause() {}, resume() {}, destroy() {},
          setFit(fit) { this.fit = fit; },
        };
        links.set(scene, { sceneCtl: { editor: { async captureFrame() {
          const frame = document.createElement("canvas");
          frame.width = canvas.clientWidth;
          frame.height = canvas.clientHeight;
          const ctx = frame.getContext("2d");
          ctx.fillStyle = scene.fit === "contain" ? "#20b0e0" : "#e06020";
          ctx.fillRect(0, 0, frame.width, frame.height);
          if (globalThis.holdCapture) await new Promise(resolve => globalThis.releaseCapture = resolve);
          return frame;
        } } } });
        return scene;
      },
    };
  `, options);
  await evaluateInPage(port, runtimeSource(options.payload, false, false, true), options);

  const result = await evaluateInPage(port, `(async () => {
    const wait = async (check) => {
      for (let attempt = 0; attempt < 120; attempt++) {
        const result = check();
        if (result) return result;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error("Startup scene fixture timed out: " + JSON.stringify(
        previewRequests.map(({ poster, ...request }) => ({ ...request, poster: !!poster }))));
    };
    const sceneRequests = () => previewRequests.filter(request => request.source === "scene-frame");
    const inspect = async (request) => {
      const image = new Image();
      image.src = request.poster;
      await image.decode();
      const sample = document.createElement("canvas");
      const ctx = sample.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const [red, , blue] = ctx.getImageData(20, 20, 1, 1).data;
      return [image.width, image.height, request.fitMode, request.dim, blue > red];
    };
    const first = await inspect(await wait(() => sceneRequests()[0]));
    sceneCanvas.style.height = "450px";
    dispatchEvent(new Event("resize"));
    const resized = await inspect(await wait(() => sceneRequests()[1]));
    const controls = document.getElementById("${controlRootId}");
    ${toggleSettings};
    controls.querySelector("[data-panel-page='appearance']").click();
    const fit = controls.querySelector("[data-setting='fitMode']");
    fit.value = "contain";
    fit.dispatchEvent(new Event("change", { bubbles: true }));
    const fitted = await inspect(await wait(() => sceneRequests()[2]));
    globalThis.holdCapture = true;
    sceneCanvas.style.height = "400px";
    dispatchEvent(new Event("resize"));
    await wait(() => globalThis.releaseCapture);
    await globalThis.__codexWallpaperApi.disable();
    releaseCapture();
    await new Promise(resolve => setTimeout(resolve, 25));
    return { first, resized, fitted, frameCount: sceneRequests().length,
      enabled: previewRequests.at(-1).enabled };
  })()`, options);
  assert.deepEqual(result, {
    first: [800, 500, "cover", 18, false],
    resized: [800, 450, "cover", 18, false],
    fitted: [800, 450, "contain", 18, true],
    frameCount: 3,
    enabled: false,
  });
});

test("scene Blob URLs and renderers are released on switch, cancel, failure, disable and reset", async (t) => {
  const preview =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23f97316'/%3E%3C/svg%3E";
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
    version: 1,
    library: [
      {
        id: "fixture-scene",
        title: "Fixture Scene",
        type: "scene",
        playable: true,
        fallback: true,
        previewDataUrl: preview,
        assetDataUrl: null,
        reason: "on-demand",
      },
      {
        id: "fixture-image",
        title: "Fixture Image",
        type: "image",
        playable: true,
        assetDataUrl: image,
      },
    ],
  });
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [],
        playlist: [],
        settings: { fps: 30, volume: 0 }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);
  const result = await evaluateInPage(
    port,
    `(async () => {
      const api = globalThis.__codexWallpaperApi;
      let root = document.getElementById("${rootId}");
      let controls = document.getElementById("${controlRootId}");
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (read, attempts = 80) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const value = read();
          if (value) return value;
          await wait(25);
        }
        return null;
      };
      globalThis.__sceneRuns = [];
      globalThis.__revokedSceneUrls = [];
      const originalRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = (url) => {
        globalThis.__revokedSceneUrls.push(url);
        originalRevoke.call(URL, url);
      };
      globalThis.WebWallGL = {
        bytesSource: () => ({}),
        createScene: (host) => {
          const canvas = document.createElement("canvas");
          canvas.dataset.sceneCanvas = "";
          host.append(canvas);
          let resolveLoad;
          let rejectLoad;
          const promise = new Promise((resolve, reject) => {
            resolveLoad = resolve;
            rejectLoad = reject;
          });
          const run = {
            destroyed: false,
            resolve: resolveLoad,
            reject: rejectLoad
          };
          globalThis.__sceneRuns.push(run);
          return {
            load: () => promise,
            pause: () => {},
            resume: () => {},
            setFps: () => {},
            setVolume: () => {},
            setFit: () => {},
            destroy: () => {
              run.destroyed = true;
            }
          };
        }
      };
      const select = (id) =>
        controls.querySelector(
          \`.card[data-entry-id="\${id}"] [data-entry-action="use"]\`
        ).click();
      const deliverScene = async () => {
        const url = URL.createObjectURL(
          new Blob(["scene fixture"], { type: "application/octet-stream" })
        );
        await api.receiveAsset({
          id: "fixture-scene",
          title: "Fixture Scene",
          type: "scene",
          playable: true,
          fallback: true,
          previewDataUrl: ${JSON.stringify(preview)},
          assetDataUrl: null,
          assetUrl: url,
          reason: "scene-native"
        });
        return url;
      };
      const selectScene = async () => {
        select("fixture-scene");
        await waitFor(() => api.state().activeId === "fixture-scene");
      };

      ${toggleSettings};
      await selectScene();
      const committedUrl = await deliverScene();
      await waitFor(() => root.querySelector(".media.staged .scene-host"));
      globalThis.__sceneRuns.at(-1).resolve();
      await waitFor(
        () => root.querySelector(".media:not(.staged) .scene-host.ready")
      );
      const committed = {
        urlActive: !globalThis.__revokedSceneUrls.includes(committedUrl),
        destroyed: globalThis.__sceneRuns.at(-1).destroyed
      };
      select("fixture-image");
      await waitFor(() => root.querySelector(".media:not(.staged) img"));
      const afterSwitch = {
        urlRevoked: globalThis.__revokedSceneUrls.includes(committedUrl),
        rendererDestroyed: globalThis.__sceneRuns[0].destroyed
      };

      await selectScene();
      const cancelledUrl = URL.createObjectURL(
        new Blob(["cancelled scene"], { type: "application/octet-stream" })
      );
      api.receiveAsset({
        id: "fixture-scene",
        title: "Fixture Scene",
        type: "scene",
        playable: true,
        fallback: true,
        assetUrl: cancelledUrl
      });
      await waitFor(() => root.querySelector(".media.staged .scene-host"));
      select("fixture-image");
      await waitFor(() => root.querySelector(".media:not(.staged) img"));
      const cancelledRun = globalThis.__sceneRuns.at(-1);
      cancelledRun.resolve();
      await wait(50);
      const afterCancel = {
        urlRevoked: globalThis.__revokedSceneUrls.includes(cancelledUrl),
        rendererDestroyed: cancelledRun.destroyed,
        staged: root.querySelectorAll(".media.staged").length,
        sceneActive: Boolean(root.querySelector(".media:not(.staged) .scene-host"))
      };

      await selectScene();
      const failedUrl = await deliverScene();
      await waitFor(() => root.querySelector(".media.staged .scene-host"));
      const failedRun = globalThis.__sceneRuns.at(-1);
      failedRun.reject(new Error("fixture decode failure"));
      await waitFor(() =>
        controls.querySelector(".runtime-status")?.textContent.includes("加载失败")
      );
      const afterFailure = {
        urlRevoked: globalThis.__revokedSceneUrls.includes(failedUrl),
        rendererDestroyed: failedRun.destroyed,
        imageRetained: Boolean(root.querySelector(".media:not(.staged) img")),
        status: controls.querySelector(".runtime-status")?.textContent,
        staged: root.querySelectorAll(".media.staged").length
      };

      await selectScene();
      const disabledUrl = await deliverScene();
      await waitFor(() => root.querySelector(".media.staged .scene-host"));
      const disabledRun = globalThis.__sceneRuns.at(-1);
      disabledRun.resolve();
      await waitFor(
        () => root.querySelector(".media:not(.staged) .scene-host.ready")
      );
      await api.disable();
      const afterDisable = {
        urlRevoked: globalThis.__revokedSceneUrls.includes(disabledUrl),
        rendererDestroyed: disabledRun.destroyed,
        rootRemoved: !document.getElementById("${rootId}")
      };

      await api.enable();
      root = document.getElementById("${rootId}");
      controls = document.getElementById("${controlRootId}");
      const resetUrl = await deliverScene();
      await waitFor(() => root.querySelector(".media.staged .scene-host"));
      const resetRun = globalThis.__sceneRuns.at(-1);
      resetRun.resolve();
      await waitFor(
        () => root.querySelector(".media:not(.staged) .scene-host.ready")
      );
      ${toggleSettings};
      const reset = controls.querySelector("button.reset");
      reset.click();
      reset.click();
      await waitFor(() => !document.getElementById("${rootId}"), 200);
      const afterReset = {
        urlRevoked: globalThis.__revokedSceneUrls.includes(resetUrl),
        rendererDestroyed: resetRun.destroyed,
        rootRemoved: !document.getElementById("${rootId}"),
        enabled: api.state().state
      };
      URL.revokeObjectURL = originalRevoke;
      return {
        committed,
        afterSwitch,
        afterCancel,
        afterFailure,
        afterDisable,
        afterReset
      };
    })()`,
    options
  );
  assert.deepEqual(result, {
    committed: { urlActive: true, destroyed: false },
    afterSwitch: { urlRevoked: true, rendererDestroyed: true },
    afterCancel: {
      urlRevoked: true,
      rendererDestroyed: true,
      staged: 0,
      sceneActive: false,
    },
    afterFailure: {
      urlRevoked: true,
      rendererDestroyed: true,
      imageRetained: true,
      status: "Fixture Scene · Scene 加载失败，已保留当前画面",
      staged: 0,
    },
    afterDisable: {
      urlRevoked: true,
      rendererDestroyed: true,
      rootRemoved: true,
    },
    afterReset: {
      urlRevoked: true,
      rendererDestroyed: true,
      rootRemoved: true,
      enabled: "disabled",
    },
  });
});

test("settings presets import export migration and scoped resets form a complete loop", async (t) => {
  const image =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E";
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
    ],
  });
  await evaluateInPage(
    port,
    `localStorage.setItem(
      "codex-wallpaper-p1-config",
      JSON.stringify({
        enabled: true,
        active: { kind: "workshop", id: "fixture-image" },
        favorites: [{ kind: "workshop", id: "fixture-image" }],
        playlist: [{ kind: "workshop", id: "fixture-image" }],
        settings: {
          dim: 25,
          blur: 2,
          opacity: 90,
          fps: 30,
          volume: 20,
          rotationMinutes: 0,
          pauseWhenHidden: false,
          legacyPath: "C:\\\\private\\\\wallpaper",
          surfaceOverrides: {
            chat: null,
            sidebar: null,
            right: null,
            settings: null,
            unknown: 77
          }
        }
      })
    )`,
    options
  );
  await applyStaticBackground(port, options);

  const result = await evaluateInPage(
    port,
    `(async () => {
      const root = document.getElementById("${rootId}");
      const controls = document.getElementById("${controlRootId}");
      const media = root.querySelector(".media:not(.staged)");
      ${toggleSettings};
      const panel = controls.querySelector("[data-codex-wallpaper-panel]");
      panel.querySelector("[data-panel-page='appearance']").click();
      const recovery = panel.querySelector("[data-preset-section]");

      const migrated = {
        active: globalThis.__codexWallpaperApi.state().activeId,
        favorite: panel
          .querySelector("[data-entry-action='favorite']")
          .getAttribute("aria-pressed"),
        playlist: panel.querySelector(".playlist-summary").textContent,
        fitMode: panel.querySelector("[data-setting='fitMode']").value,
        sidebarReadability:
          panel.querySelector("[data-surface-override-value='sidebar']").value,
        profile: panel.querySelector("[data-playback-profile]").value
      };

      const dim = panel.querySelector("[data-setting='dim']");
      dim.value = "33";
      dim.dispatchEvent(new Event("input", { bubbles: true }));
      const projectBlur = panel.querySelector("[data-setting='projectSidebarBlur']");
      projectBlur.value = "11";
      projectBlur.dispatchEvent(new Event("input", { bubbles: true }));
      const rightBlur = panel.querySelector("[data-setting='rightBlur']");
      rightBlur.value = "12";
      rightBlur.dispatchEvent(new Event("input", { bubbles: true }));
      const volume = panel.querySelector("[data-setting='volume']");
      volume.value = "45";
      volume.dispatchEvent(new Event("input", { bubbles: true }));
      const name = recovery.querySelector("[data-preset-name-input]");
      name.value = "Night";
      recovery.querySelector("[data-preset-save]").click();
      const savedPreset = JSON.parse(
        localStorage.getItem("codex-wallpaper-p1-config")
      ).presets[0];

      dim.value = "50";
      dim.dispatchEvent(new Event("input", { bubbles: true }));
      const beforeRemoteEdit = localStorage.getItem(
        "codex-wallpaper-p1-config"
      );
      const remoteDuringEdit = JSON.stringify({
        ...JSON.parse(beforeRemoteEdit),
        activePresetId: "night",
        settings: {
          ...JSON.parse(beforeRemoteEdit).settings,
          dim: 33,
          performanceProfile: "custom"
        }
      });
      localStorage.setItem("codex-wallpaper-p1-config", remoteDuringEdit);
      dispatchEvent(
        new StorageEvent("storage", {
          key: "codex-wallpaper-p1-config",
          oldValue: beforeRemoteEdit,
          newValue: remoteDuringEdit,
          storageArea: localStorage
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 120));
      const afterRemoteEdit = JSON.parse(
        localStorage.getItem("codex-wallpaper-p1-config")
      );
      const customAfterEdit = {
        dim: afterRemoteEdit.settings.dim,
        activePresetId: afterRemoteEdit.activePresetId,
        profile: afterRemoteEdit.settings.performanceProfile
      };

      recovery
        .querySelector("[data-preset-apply='night']")
        .click();
      const applied = {
        dim: panel.querySelector("[data-setting='dim']").value,
        volume: panel.querySelector("[data-setting='volume']").value,
        activePresetId: JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).activePresetId,
        mediaSame: root.querySelector(".media:not(.staged)") === media
      };

      const rename = recovery.querySelector("[data-preset-name='night']");
      rename.value = "Night A";
      recovery.querySelector("[data-preset-rename='night']").click();
      const renamed = {
        text: recovery.querySelector("[data-preset-name='night']").value,
        stored: JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).presets[0].name
      };

      const originalCreate = URL.createObjectURL;
      let exportedBlob = null;
      URL.createObjectURL = (blob) => {
        exportedBlob = blob;
        return "blob:fixture-settings";
      };
      recovery.querySelector("[data-settings-export]").click();
      URL.createObjectURL = originalCreate;
      const exportedText = await exportedBlob.text();
      const exported = JSON.parse(exportedText);

      const previous = localStorage.getItem("codex-wallpaper-p1-config");
      const next = JSON.stringify({
        ...JSON.parse(previous),
        activePresetId: null,
        settings: {
          ...JSON.parse(previous).settings,
          dim: 41,
          rightBlur: 2
        }
      });
      localStorage.setItem("codex-wallpaper-p1-config", next);
      const syncedMedia = root.querySelector(".media:not(.staged)");
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
        dim: panel.querySelector("[data-setting='dim']").value,
        activePreset:
          recovery
            .querySelector("[data-preset-id='night']")
            .getAttribute("data-active"),
        mediaSame: root.querySelector(".media:not(.staged)") === syncedMedia
      };

      const settingsImport = recovery.querySelector("[data-settings-import]");
      recovery.querySelector("[data-settings-status]").textContent = "";
      const validTransfer = new DataTransfer();
      validTransfer.items.add(
        new File(
          [exportedText],
          "valid-settings.json",
          { type: "application/json" }
        )
      );
      settingsImport.files = validTransfer.files;
      settingsImport.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (recovery.querySelector("[data-settings-status]").textContent)
          break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const imported = {
        dim: panel.querySelector("[data-setting='dim']").value,
        projectBlur: projectBlur.value,
        rightBlur: rightBlur.value,
        fitMode: panel.querySelector("[data-setting='fitMode']").value,
        volume: panel.querySelector("[data-setting='volume']").value,
        activePresetId: JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        ).activePresetId,
        activePresetUi:
          recovery
            .querySelector("[data-preset-id='night']")
            .getAttribute("data-active"),
        mediaSame: root.querySelector(".media:not(.staged)") === media,
        status: recovery.querySelector("[data-settings-status]").textContent
      };
      panel.querySelector("header button").click();
      ${toggleSettings};
      const importedReopened = {
        dim: panel.querySelector("[data-setting='dim']").value,
        fitMode:
          panel.querySelector("[data-setting='fitMode']")?.value ?? null,
        volume: panel.querySelector("[data-setting='volume']").value
      };

      const beforeInvalid = localStorage.getItem("codex-wallpaper-p1-config");
      recovery.querySelector("[data-settings-status]").textContent = "";
      const invalidTransfer = new DataTransfer();
      invalidTransfer.items.add(
        new File(
          [
            JSON.stringify({
              version: 99,
              settings: { dim: 999, opacity: "broken" }
            })
          ],
          "invalid-settings.json",
          { type: "application/json" }
        )
      );
      settingsImport.files = invalidTransfer.files;
      settingsImport.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (recovery.querySelector("[data-settings-status]").textContent)
          break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const invalid = {
        unchanged:
          localStorage.getItem("codex-wallpaper-p1-config") === beforeInvalid,
        status: recovery.querySelector("[data-settings-status]").textContent
      };
      const beforeInvalidRange = localStorage.getItem(
        "codex-wallpaper-p1-config"
      );
      recovery.querySelector("[data-settings-status]").textContent = "";
      const invalidRangeTransfer = new DataTransfer();
      invalidRangeTransfer.items.add(
        new File(
          [
            JSON.stringify({
              version: 1,
              settings: { dim: 999 }
            })
          ],
          "invalid-range.json",
          { type: "application/json" }
        )
      );
      settingsImport.files = invalidRangeTransfer.files;
      settingsImport.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (recovery.querySelector("[data-settings-status]").textContent)
          break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const invalidRange = {
        unchanged:
          localStorage.getItem("codex-wallpaper-p1-config") ===
          beforeInvalidRange,
        status: recovery.querySelector("[data-settings-status]").textContent
      };
      recovery.querySelector("[data-settings-status]").textContent = "";
      const mismatchTransfer = new DataTransfer();
      mismatchTransfer.items.add(
        new File(
          [
            JSON.stringify({
              version: 1,
              settings: {
                ...exported.settings,
                fps: 17,
                pauseWhenHidden: false,
                performanceProfile: "balanced"
              }
            })
          ],
          "mismatched-profile.json",
          { type: "application/json" }
        )
      );
      settingsImport.files = mismatchTransfer.files;
      settingsImport.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (recovery.querySelector("[data-settings-status]").textContent)
          break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      const normalizedProfile = {
        profile: panel.querySelector("[data-playback-profile]").value,
        fps: globalThis.__codexWallpaperApi.state().fpsCap,
        status: recovery.querySelector("[data-settings-status]").textContent
      };

      recovery.querySelector("[data-reset-group='appearance']").click();
      const appearanceReset = {
        dim: panel.querySelector("[data-setting='dim']").value,
        projectBlur: projectBlur.value,
        rightBlur: rightBlur.value,
        fitMode: panel.querySelector("[data-setting='fitMode']").value,
        activeId: globalThis.__codexWallpaperApi.state().activeId,
        favorite: panel
          .querySelector("[data-entry-action='favorite']")
          .getAttribute("aria-pressed"),
        playlist: panel.querySelector(".playlist-summary").textContent
      };
      recovery.querySelector("[data-reset-group='playback']").click();
      const playbackReset = {
        volume: panel.querySelector("[data-setting='volume']").value,
        fps: globalThis.__codexWallpaperApi.state().fpsCap,
        profile: panel.querySelector("[data-playback-profile]").value
      };
      recovery.querySelector("[data-reset-group='all']").click();
      const allReset = {
        dim: panel.querySelector("[data-setting='dim']").value,
        volume: panel.querySelector("[data-setting='volume']").value,
        activeId: globalThis.__codexWallpaperApi.state().activeId,
        favorite: panel
          .querySelector("[data-entry-action='favorite']")
          .getAttribute("aria-pressed"),
        playlist: panel.querySelector(".playlist-summary").textContent
      };

      const mediaImport = panel.querySelector(".import-row input");
      const mediaTransfer = new DataTransfer();
      mediaTransfer.items.add(
        new File(
          ["<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/>"],
          "Remove Me.svg",
          { type: "image/svg+xml" }
        )
      );
      mediaImport.files = mediaTransfer.files;
      mediaImport.dispatchEvent(new Event("change", { bubbles: true }));
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (globalThis.__codexWallpaperApi.state().importedCount > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const importedBeforeRemove =
        globalThis.__codexWallpaperApi.state().importedCount;
      panel.querySelector("[data-panel-page='library']").click();
      panel.querySelector("[data-remove-imported]").click();
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (globalThis.__codexWallpaperApi.state().importedCount === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const removedImported = {
        before: importedBeforeRemove,
        after: globalThis.__codexWallpaperApi.state().importedCount,
        state: globalThis.__codexWallpaperApi.state().state,
        activeKind: globalThis.__codexWallpaperApi.state().activeKind,
        activeId: globalThis.__codexWallpaperApi.state().activeId,
        favorite: panel
          .querySelector("[data-entry-action='favorite']")
          .getAttribute("aria-pressed")
      };

      panel.querySelector("header button").click();
      ${toggleSettings};
      const reopened = {
        presetName: panel.querySelector("[data-preset-name='night']").value,
        presetCount: panel.querySelectorAll("[data-preset-id]").length
      };
      return {
        migrated,
        savedPreset,
        customAfterEdit,
        applied,
        renamed,
        exported,
        crossWindow,
        imported,
        importedReopened,
        invalid,
        invalidRange,
        normalizedProfile,
        appearanceReset,
        playbackReset,
        allReset,
        removedImported,
        reopened
      };
    })()`,
    options
  );

  assert.deepEqual(result.migrated, {
    active: "fixture-image",
    favorite: "true",
    playlist: "轮播：Fixture Image",
    fitMode: "cover",
    sidebarReadability: "72",
    profile: "custom",
  });
  assert.equal(result.savedPreset.id, "night");
  assert.equal(result.savedPreset.name, "Night");
  assert.equal(result.savedPreset.settings.dim, 33);
  assert.equal(result.savedPreset.settings.projectSidebarBlur, 11);
  assert.equal(result.savedPreset.settings.rightBlur, 12);
  assert.equal(result.savedPreset.settings.volume, 45);
  assert.deepEqual(result.customAfterEdit, {
    dim: 50,
    activePresetId: null,
    profile: "custom",
  });
  assert.deepEqual(result.applied, {
    dim: "33",
    volume: "45",
    activePresetId: "night",
    mediaSame: true,
  });
  assert.deepEqual(result.renamed, {
    text: "Night A",
    stored: "Night A",
  });
  assert.equal(result.exported.version, 1);
  assert.deepEqual(Object.keys(result.exported), ["version", "settings"]);
  assert.equal("favorites" in result.exported, false);
  assert.equal("active" in result.exported, false);
  assert.equal("legacyPath" in result.exported.settings, false);
  assert.equal("unknown" in result.exported.settings.surfaceOverrides, false);
  assert.equal(result.exported.settings.dim, 33);
  assert.equal(result.exported.settings.projectSidebarBlur, 11);
  assert.equal(result.exported.settings.rightBlur, 12);
  assert.deepEqual(result.crossWindow, {
    dim: "41",
    activePreset: "false",
    mediaSame: true,
  });
  assert.deepEqual(result.imported, {
    dim: "33",
    projectBlur: "11",
    rightBlur: "12",
    fitMode: "cover",
    volume: "45",
    activePresetId: null,
    activePresetUi: "false",
    mediaSame: true,
    status: "设置已导入",
  });
  assert.deepEqual(result.importedReopened, {
    dim: "33",
    fitMode: "cover",
    volume: "45",
  });
  assert.equal(result.invalid.unchanged, true);
  assert.match(result.invalid.status, /^导入失败：/);
  assert.equal(result.invalidRange.unchanged, true);
  assert.match(result.invalidRange.status, /^导入失败：/);
  assert.deepEqual(result.normalizedProfile, {
    profile: "custom",
    fps: 17,
    status: "设置已导入",
  });
  assert.deepEqual(result.appearanceReset, {
    dim: "18",
    projectBlur: "0",
    rightBlur: "0",
    fitMode: "cover",
    activeId: "fixture-image",
    favorite: "true",
    playlist: "轮播：Fixture Image",
  });
  assert.deepEqual(result.playbackReset, {
    volume: "0",
    fps: 30,
    profile: "balanced",
  });
  assert.deepEqual(result.allReset, {
    dim: "18",
    volume: "0",
    activeId: "fixture-image",
    favorite: "true",
    playlist: "轮播：Fixture Image",
  });
  assert.deepEqual(result.removedImported, {
    before: 1,
    after: 0,
    state: "enabled",
    activeKind: "builtin",
    activeId: "aurora",
    favorite: "true",
  });
  assert.deepEqual(result.reopened, {
    presetName: "Night A",
    presetCount: 1,
  });
});

test("the read-only profile account row retains its native opacity and cursor when wallpaper is toggled", async (t) => {
  const fixture = await startHtmlFixture(`<!doctype html><meta charset="utf-8">
    <style>@layer utilities { .account { opacity: .9; cursor: default; } }</style>
    <button aria-label="Open profile menu" aria-haspopup="menu" aria-expanded="true"></button>
    <div role="menu" data-radix-menu-content data-state="open">
      <div>
        <div role="presentation">
          <div id="account" class="account" role="menuitem" aria-disabled="true" data-disabled>
            <div data-menu-row-content><span data-leading-icon-slot="menu"></span>Profile / Plus</div>
          </div>
        </div>
        <div id="other" role="menuitem" aria-disabled="true" data-disabled>Unavailable action</div>
      </div>
    </div>`);
  const { port, options } = await startRuntimeFixture(t, { library: [] }, fixture);
  const read = (source) => evaluateInPage(port, source, options);
  const rows = () => read(`[...document.querySelectorAll('#account, #other')].map(row => {
    const { opacity, cursor } = getComputedStyle(row);
    return { opacity, cursor, disabled: row.getAttribute('aria-disabled'), nativeDisabled: row.hasAttribute('data-disabled') };
  })`);
  const native = await rows();
  assert.equal(native[0].opacity, "0.9");
  const enabled = [native[0], { ...native[1], opacity: "0.48", cursor: "not-allowed" }];

  await applyStaticBackground(port, options);
  assert.deepEqual(await rows(), enabled);
  await read("globalThis.__codexWallpaperApi.disable(false)");
  assert.deepEqual(await rows(), native);
  await read("globalThis.__codexWallpaperApi.enable(false)");
  assert.deepEqual(await rows(), enabled);
});

test("usage rows retain their hover tooltip and open native usage settings while wallpaper is enabled", async (t) => {
  const fixture = await startHtmlFixture(`<!doctype html><meta charset="utf-8">
    <style>
      [role="menuitem"] { padding: 8px; width: 220px; }
      #weekly { position: relative; }
      #reset-time { display: none; position: absolute; left: 100%; top: 0; white-space: nowrap; }
      #weekly:hover #reset-time { display: inline; }
    </style>
    <button id="usage" aria-label="用量" aria-haspopup="menu" aria-controls="usage-menu">用量</button>
    <div id="usage-menu" role="menu" data-radix-menu-content aria-labelledby="usage" tabindex="-1" hidden>
      <div id="weekly" role="menuitem" data-radix-collection-item aria-disabled="true" tabindex="-1">
        <div data-menu-row-content="true"><span>Weekly limit</span><span>52% left</span></div>
        <span id="reset-time">Resets in 5d</span>
      </div>
      <div id="manage" role="menuitem" data-radix-collection-item tabindex="-1">管理用量</div>
    </div>
    <div role="menu"><div id="profile-summary" role="menuitem" aria-disabled="true">Profile / Plus</div></div>
    <h1 id="usage-settings" hidden>使用情况</h1>
    <script>
      const trigger = document.querySelector('#usage');
      const menu = document.querySelector('#usage-menu');
      const settings = document.querySelector('#usage-settings');
      trigger.onclick = () => {
        menu.hidden = false;
        menu.dataset.state = 'open';
        settings.hidden = true;
        menu.focus();
      };
      document.querySelector('#manage').onclick = () => {
        menu.hidden = true;
        menu.dataset.state = 'closed';
        settings.hidden = false;
      };
    </script>`);
  const { port, options } = await startRuntimeFixture(t, { library: [] }, fixture);
  const read = (source) => evaluateInPage(port, source, options);
  const settingsVisible = '!document.querySelector("#usage-settings").hidden';
  await applyStaticBackground(port, options);
  await clickAtElementCenter(port, options, "#usage");
  assert.equal(await clickAtElementCenter(port, options, "#weekly"), true);
  assert.equal(await read(settingsVisible), true);

  await clickAtElementCenter(port, options, "#usage");
  const point = await read(`(() => {
    const { x, y, width, height } = document.querySelector('#weekly').getBoundingClientRect();
    return { x: x + width / 2, y: y + height / 2 };
  })()`);
  await callMainPage(
    port,
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", buttons: 0, pointerType: "mouse", ...point },
    options.page
  );
  assert.ok(await read('document.querySelector("#reset-time").getBoundingClientRect().width > 0'));
  assert.notEqual(await read('getComputedStyle(document.querySelector("#weekly")).backgroundColor'), "rgba(0, 0, 0, 0)");

  await read('document.querySelector("#weekly").focus()');
  for (const type of ["keyDown", "keyUp"]) {
    await callMainPage(
      port,
      "Input.dispatchKeyEvent",
      { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      options.page
    );
  }
  assert.equal(await read(settingsVisible), true);

  await clickAtElementCenter(port, options, "#usage");
  await read("globalThis.__codexWallpaperApi.disable(false)");
  assert.equal(await read('document.querySelector("#weekly").getAttribute("aria-disabled")'), "true");
  await clickAtElementCenter(port, options, "#weekly");
  assert.equal(await read(settingsVisible), false);
  await clickAtElementCenter(port, options, "#manage");
  assert.equal(await read(settingsVisible), true);
  await read("globalThis.__codexWallpaperApi.enable(false)");
  await clickAtElementCenter(port, options, "#usage");
  await clickAtElementCenter(port, options, "#weekly");
  assert.equal(await read(settingsVisible), true);
  assert.equal(await read('document.querySelector("#profile-summary").getAttribute("aria-disabled")'), "true");
});

test("modern tab side panels use the wallpaper surface material", async (t) => {
  const { port, options } = await startRuntimeFixture(t, { library: [] });
  const createPanel = `(() => {
    const panel = document.createElement("aside");
    panel.dataset.appShellFocusArea = "right-panel";
    panel.innerHTML = '<div id="app-shell-tab-panel-fixture" role="tabpanel"><div id="modern-right-surface" class="electron:bg-surface" style="background-color: rgb(35 35 35)">Changes</div></div>';
    document.querySelector("[data-app-shell-main-surface]").append(panel);
  })()`;
  await evaluateInPage(port, createPanel, options);
  const appearance = `(() => ({
    panel: getComputedStyle(document.querySelector("aside[data-app-shell-focus-area='right-panel']")).backgroundColor,
    surface: getComputedStyle(document.querySelector("#modern-right-surface")).backgroundColor,
  }))()`;
  const native = await evaluateInPage(port, appearance, options);
  await applyStaticBackground(port, { ...options, payload: { library: [] } });
  const adapted = await evaluateInPage(port, appearance, options);
  assert.equal(native.surface, "rgb(35, 35, 35)");
  assert.ok(
    Number(adapted.panel.match(/\/ ([\d.]+)\)$/)?.[1]) >= 0.8,
    JSON.stringify(adapted)
  );
  assert.notEqual(adapted.surface, native.surface);
  assert.notEqual(adapted.surface, "rgba(0, 0, 0, 0)");
  await evaluateInPage(port, "globalThis.__codexWallpaperApi.disable()", options);
  assert.deepEqual(await evaluateInPage(port, appearance, options), native);
});

test("the native settings dialog uses a 20 percent theme tint for its two columns", async (t) => {
  const { port, options } = await startRuntimeFixture(t);
  await evaluateInPage(
    port,
    `(() => {
      const wallpaper = document.createElement("div");
      wallpaper.style.cssText = "position:fixed;inset:0;z-index:100;background:" +
        "repeating-linear-gradient(90deg, #181818 0 4px, #c0c0c0 4px 8px) bottom / 100% 35% no-repeat," +
        "linear-gradient(90deg, #182838 50%, #90b8db 50%)";
      document.body.append(wallpaper);
      const portal = document.createElement("div");
      portal.style.cssText = "position:fixed;inset:0;z-index:101;contain:layout";
      const modal = document.createElement("div");
      modal.style.isolation = "isolate";
      const overlay = document.createElement("div");
      overlay.className = "settings-dialog-backdrop";
      overlay.style.cssText = "position:fixed;inset:0;background:rgb(0 0 0 / .18);backdrop-filter:blur(3px)";
      const dialog = document.createElement("div");
      dialog.className = "settings-dialog";
      dialog.setAttribute("role", "dialog");
      dialog.style.cssText = "position:fixed;inset:32px;display:grid;grid-template-columns:1fr 2fr";
      dialog.innerHTML = \`
        <div class="settings-dialog-sidebar" style="background-color: rgb(255 255 255 / .025); border-right: 1px solid rgb(48 48 48)">
          <div data-settings-nav-scroll-container>Settings navigation</div>
        </div>
        <div data-settings-panel>
          <div class="settings-dialog-content electron:bg-surface" style="background-color: rgb(35 35 35)">
            <button style="background-color: rgb(62 62 62)">Open menu</button>
          </div>
        </div>
      \`;
      modal.append(overlay, dialog);
      portal.append(modal);
      document.body.append(portal);
      const ordinary = document.createElement("div");
      ordinary.setAttribute("role", "dialog");
      ordinary.innerHTML = '<div class="electron:bg-surface" style="background-color: rgb(35 35 35)">Another dialog</div>';
      document.body.append(ordinary);
    })()`,
    options
  );
  const appearance = `(() => {
    const dialog = document.querySelector(".settings-dialog");
    const sidebar = dialog.querySelector(".settings-dialog-sidebar");
    const content = dialog.querySelector(".settings-dialog-content");
    return {
      backdrop: getComputedStyle(dialog).backgroundColor,
      blur: getComputedStyle(dialog).backdropFilter,
      sidebar: getComputedStyle(sidebar).backgroundColor,
      content: getComputedStyle(content).backgroundColor,
      divider: getComputedStyle(sidebar).borderRightWidth,
      button: getComputedStyle(content.querySelector("button")).backgroundColor,
      ordinary: getComputedStyle(document.querySelector("[role='dialog']:not(.settings-dialog) > div")).backgroundColor,
      ordinaryBlur: getComputedStyle(document.querySelector("[role='dialog']:not(.settings-dialog)")).backdropFilter,
    };
  })()`;
  const native = await evaluateInPage(port, appearance, options);
  await applyStaticBackground(port, { ...options, payload: { library: [] } });
  const adapted = await evaluateInPage(port, appearance, options);
  const { data } = await callMainPage(
    port,
    "Page.captureScreenshot",
    { format: "png" },
    options.page,
    true
  );
  const { broadContrast, stripeContrast } = await evaluateInPage(
    port,
    `(async () => {
      const image = new Image();
      image.src = "data:image/png;base64,${data}";
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const red = (x, y) => context.getImageData(x, y, 1, 1).data[0];
      const x = Math.floor(image.width / 16) * 8;
      const broadY = Math.floor(image.height * 0.45);
      const stripeY = Math.floor(image.height * 0.75);
      return {
        broadContrast: red(image.width * 0.75, broadY) - red(image.width * 0.25, broadY),
        stripeContrast: Math.abs(red(x + 2, stripeY) - red(x + 6, stripeY)),
      };
    })()`,
    options
  );
  assert.ok(
    broadContrast >= 70 && broadContrast <= 125,
    `Large background shapes should stay visible (red-channel difference: ${broadContrast})`
  );
  assert.ok(
    stripeContrast <= 6,
    `Fine background detail should be blurred (red-channel difference: ${stripeContrast})`
  );
  const alpha = (color) => Number(color.match(/\/ ([\d.]+)\)$/)?.[1]);
  assert.deepEqual(adapted, {
    ...native,
    backdrop: adapted.backdrop,
    blur: "blur(15px)",
    sidebar: "rgba(0, 0, 0, 0)",
    content: "rgba(0, 0, 0, 0)",
  });
  assert.equal(alpha(adapted.backdrop), 0.2);
  const light = await evaluateInPage(
    port,
    `(() => {
      document.documentElement.dataset.theme = "light";
      return ${appearance};
    })()`,
    options
  );
  assert.notEqual(light.backdrop, adapted.backdrop);
  assert.equal(alpha(light.backdrop), 0.2);
  assert.equal(light.blur, adapted.blur);
  const minimum = await evaluateInPage(
    port,
    `(() => {
      const controls = document.getElementById("${controlRootId}");
      ${toggleSettings};
      controls.querySelector("[data-panel-page='appearance']").click();
      const range = controls.querySelector("[data-surface-override-value='settings']");
      range.value = "0";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      return ${appearance};
    })()`,
    options
  );
  assert.ok(alpha(minimum.backdrop) === alpha(light.backdrop));
  assert.equal(minimum.blur, adapted.blur);
  await evaluateInPage(port, "globalThis.__codexWallpaperApi.disable()", options);
  assert.deepEqual(await evaluateInPage(port, appearance, options), native);
});

test("static background is single, removable and persists disabled", async (t) => {
  const { fixture, port, options } = await startRuntimeFixture(t, {
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
  });
  const pressAltShiftW = () => pressWallpaperShortcut(port, options, "W");
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
      `${toggleSettings},
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
        const content = panel.querySelector(".panel-content");
        const navigation = panel.querySelector(".panel-navigation");
        const navigationTop = navigation.getBoundingClientRect().top;
        content.scrollTop = 80;
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
          scrollTop: content.scrollTop,
          navigationFixed: navigation.getBoundingClientRect().top === navigationTop,
          navigationBackground: getComputedStyle(navigation).backgroundColor,
          contentBackground: getComputedStyle(content).backgroundColor
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
      navigationFixed: true,
      navigationBackground: "rgba(0, 0, 0, 0)",
      contentBackground: "rgba(0, 0, 0, 0)",
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
          videoFrameCallback = () => {
            videoFrameCallback = null;
            callback(performance.now(), {});
          };
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
        const staged = root.querySelector(".media.staged video");
        Object.defineProperty(staged, "readyState", { configurable: true, value: 1 });
        videoFrameCallback?.();
        const afterEarlyFrame = {
          oldFrameStillVisible: root.querySelector(".media img") === oldImage,
          stillStaged: staged.isConnected && staged.closest(".media").classList.contains("staged")
        };
        delete staged.readyState;
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
        return { beforeFrame, afterEarlyFrame, afterFrame };
      })()`,
      options
    ),
    {
      beforeFrame: {
        callbackAvailable: true,
        oldFrameStillVisible: true,
        fullWindowPreview: false,
      },
      afterEarlyFrame: {
        oldFrameStillVisible: true,
        stillStaged: true,
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
        const originalFrameCallback =
          HTMLVideoElement.prototype.requestVideoFrameCallback;
        const originalCancelFrameCallback =
          HTMLVideoElement.prototype.cancelVideoFrameCallback;
        let presentedFrame = null;
        HTMLVideoElement.prototype.requestVideoFrameCallback = (callback) => {
          presentedFrame = callback;
          return 1;
        };
        HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
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
          const stagedVideo =
            document.querySelector("#${rootId} .media.staged video");
          if (typeof presentedFrame === "function" && stagedVideo?.readyState >= 2)
            break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        presentedFrame?.(performance.now(), {});
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
        const result = {
          playerCount: api.state().playerCount,
          blobUrl: video?.src.startsWith("blob:") ?? false
        };
        HTMLVideoElement.prototype.requestVideoFrameCallback =
          originalFrameCallback;
        HTMLVideoElement.prototype.cancelVideoFrameCallback =
          originalCancelFrameCallback;
        return result;
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
    "素材加载失败：fixture failure，已保留当前画面"
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
        const committedScene = ".media:not(.staged) [data-scene-canvas]";
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (root.querySelector(committedScene)) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        if (!root.querySelector(committedScene))
          throw new Error("Timed out waiting for the scene to commit");
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
        const panel = controls.querySelector("[data-codex-wallpaper-panel]");
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
          wallpaperControlsHaveSeparateGlassSurface:
            getComputedStyle(panel).backgroundColor !==
              getComputedStyle(dialog).backgroundColor,
          wallpaperControlsRespectZeroInterfaceBlur:
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
          cornerControlsAbsent: !controls.querySelector(
            ".toolbar, [data-codex-wallpaper-settings], [data-codex-wallpaper-toggle]"
          ),
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
    wallpaperControlsHaveSeparateGlassSurface: true,
    wallpaperControlsRespectZeroInterfaceBlur: true,
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
    cornerControlsAbsent: true,
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
      document.querySelector("[data-composer-surface-variant]").tabIndex = 0;
      document.querySelector("[data-composer-surface-variant]").focus();
      globalThis.nativeShortcutEvents = 0;
      document.addEventListener("keydown", () => { nativeShortcutEvents += 1; });
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true, altKey: true, shiftKey: true, ctrlKey: true, code: "KeyS"
      }));
    })()`,
    options
  );
  assert.deepEqual(
    await evaluateInPage(port, `[
      nativeShortcutEvents,
      document.querySelector("#${controlRootId} .panel.open") !== null
    ]`, options),
    [1, false]
  );
  await pressWallpaperShortcut(port, options, "S");
  await waitForCondition(
    async () =>
      await evaluateInPage(
        port,
        `document.querySelector("#${controlRootId} .panel.open") !== null`,
        options
      ),
    2000,
    "Wallpaper settings panel did not open"
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const panel = document.querySelector("#${controlRootId} .panel.open");
        const c = document.querySelector("[data-composer-surface-variant]").getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        const repeat = new KeyboardEvent("keydown", {
          altKey: true, shiftKey: true, code: "KeyS",
          bubbles: true, cancelable: true, repeat: true
        });
        panel.dispatchEvent(repeat);
        return {
          visible: p.top >= 0 && p.right <= innerWidth - 13,
          clear: p.bottom <= c.top - 3,
          panelHasFocus: document.activeElement === panel,
          repeatWasConsumed: repeat.defaultPrevented,
          repeatKeptPanelOpen: panel.classList.contains("open"),
          nativeShortcutEvents
        };
      })()`,
      options
    ),
    {
      visible: true,
      clear: true,
      panelHasFocus: true,
      repeatWasConsumed: true,
      repeatKeptPanelOpen: true,
      nativeShortcutEvents: 1,
    }
  );
  await pressWallpaperShortcut(port, options, "S");
  assert.deepEqual(
    await evaluateInPage(port, `[
      document.querySelector("#${controlRootId} .panel.open") !== null,
      document.activeElement.matches("[data-composer-surface-variant]")
    ]`, options),
    [false, true]
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
  await pressWallpaperShortcut(port, options, "S");
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const panel = document.querySelector("#${controlRootId} .panel.open");
        const c = document.querySelector("[data-composer-surface-variant]").getBoundingClientRect();
        const p = panel?.getBoundingClientRect();
        return {
          visible: Boolean(p && p.top >= 0 && p.right <= innerWidth),
          clear: Boolean(p && p.bottom < c.top),
          hitTestable: Boolean(p && panel.contains(document.elementFromPoint(
            p.right - 8,
            p.top + 8
          )))
        };
      })()`,
      options
    ),
    { visible: true, clear: true, hitTestable: true }
  );
  await pressWallpaperShortcut(port, options, "S");
  for (const [width, height] of [[1290, 900], [360, 700]]) {
    await metrics.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pressWallpaperShortcut(port, options, "S");
    const layouts = await evaluateInPage(
      port,
      `(() => {
        const panel = document.querySelector("[data-codex-wallpaper-panel]");
        return [...panel.querySelectorAll("[data-panel-page]")].map((tab) => {
          tab.click();
          const { left, top, right, bottom, width, height } = panel.getBoundingClientRect();
          return {
            left, top, width, height,
            fitsWindow: left >= 0 && right <= document.documentElement.clientWidth &&
              top >= 0 && bottom <= innerHeight && panel.scrollWidth === panel.clientWidth
          };
        });
      })()`,
      options
    );
    assert.equal(layouts.length, 3);
    assert.ok(layouts[0].fitsWindow && layouts[0].width > 0 && layouts[0].height > 0);
    assert.deepEqual(layouts, [layouts[0], layouts[0], layouts[0]]);
    await evaluateInPage(
      port,
      'document.querySelector("[data-panel-page=library]").click()',
      options
    );
    await pressWallpaperShortcut(port, options, "S");
  }
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
        ${toggleSettings};
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
        fitMode: "cover",
        surfaceOpacity: 72,
        interfaceBlur: 0,
        chatBlur: 0,
        rightBlur: 0,
        projectSidebarBlur: 0,
        interfaceBorders: true,
        surfaceOverrides: {
          chat: null,
          left: null,
          sidebar: null,
          right: null,
          settings: null,
        },
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
        const panelBackground = getComputedStyle(sidebar).backgroundColor;
        const opened = {
          titlebarRemainsFixed: getComputedStyle(titlebar).position === "fixed",
          panel: !sidebar.hidden,
          panelKeepsWallpaper:
            panelBackground.includes("/ 0)") || panelBackground.endsWith("0, 0)"),
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
      panelKeepsWallpaper: true,
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
  await pressAltShiftW();
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
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
        libraryRevalidationFailed: false,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
        mainInterfaceShown: true,
      },
      savedEnabled: false,
      savedActive: { kind: "workshop", id: "fixture-image" },
      savedSettings: {
        dim: 42,
        blur: 6,
        opacity: 73,
        fitMode: "cover",
        surfaceOpacity: 72,
        interfaceBlur: 0,
        chatBlur: 0,
        rightBlur: 0,
        projectSidebarBlur: 0,
        interfaceBorders: true,
        surfaceOverrides: {
          chat: null,
          left: null,
          sidebar: null,
          right: null,
          settings: null,
        },
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
          state: { ...globalThis.__codexWallpaperApi.state(), controls: undefined },
          roots: {
            wallpaper: document.querySelectorAll("#${rootId}").length,
            controls: document.querySelectorAll("#${controlRootId}").length,
            styles: document.querySelectorAll("#${rootId}-style").length
          },
          imageIsFixture: media.querySelector("img")?.src.includes("5d32b8"),
          opacity: root.querySelector("[data-codex-wallpaper-layer]").style.opacity,
          filter: media.style.filter,
          settingsInputs: Object.fromEntries(
            [...controls.querySelectorAll(".range input[type='range']")].map((input) => [
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
        styles: 1,
        activeKind: "workshop",
        activeId: "fixture-image",
        libraryCount: 7,
        libraryRevalidationFailed: false,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
        mainInterfaceShown: true,
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
        interfaceBlur: 0,
        chatBlur: 0,
        rightBlur: 0,
        projectSidebarBlur: 0,
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
        panel: document.querySelector("#${controlRootId} .panel") !== null
      })`,
      options
    ),
    { state: "disabled", panel: false }
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
          request: { type: request.type, id: request.id },
          nativeBeforeAsset,
          previewShown,
          assetShown: root
            .querySelector(".media:not(.staged) img")
            ?.src.includes("22c55e"),
          state: { ...globalThis.__codexWallpaperApi.state(), controls: undefined }
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
        styles: 1,
        activeKind: "workshop",
        activeId: "fixture-on-demand",
        libraryCount: 7,
        libraryRevalidationFailed: false,
        importedCount: 0,
        playerCount: 0,
        visible: true,
        measuredFps: 0,
        fpsCap: 15,
        volume: 0,
        hostReady: true,
        mainInterfaceShown: true,
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
    `(async () => {
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
      const navigation = viewport.closest("#settings-fixture")
        .querySelector("[data-settings-nav-scroll-container]");
      navigation.removeAttribute("data-settings-nav-scroll-container");
      await new Promise(requestAnimationFrame);
      const restoresOrdinarySurfaces = {
        viewport: getComputedStyle(viewport).backgroundColor,
        card: getComputedStyle(card).backgroundColor
      };
      navigation.setAttribute("data-settings-nav-scroll-container", "");
      await new Promise(requestAnimationFrame);
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
        restoresOrdinarySurfaces,
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
      restoresOrdinarySurfaces: {
        viewport: "rgb(24, 24, 28)",
        card: "rgb(35, 35, 35)",
      },
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
