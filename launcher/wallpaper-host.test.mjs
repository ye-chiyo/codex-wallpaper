import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { attachWallpaperHost } from "./wallpaper-host.mjs";

async function listenOnUnusedPort(server) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = server.address().port;
    const locked = await access(
      join(tmpdir(), `codex-wallpaper-host-${port}.lock`)
    ).then(
      () => true,
      () => false
    );
    if (!locked) return port;
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  throw new Error("Could not find an unlocked fixture port");
}

test("host fails closed and removes its lock without a reachable Codex port", async () => {
  const probe = createServer();
  const port = await listenOnUnusedPort(probe);
  await new Promise((resolve) => probe.close(resolve));

  const child = spawn(
    process.execPath,
    ["--no-use-env-proxy", "launcher/wallpaper-host.mjs", String(port)],
    { stdio: "ignore" }
  );
  const [code] = await once(child, "exit");
  assert.equal(code, 1);
  await assert.rejects(
    access(join(tmpdir(), `codex-wallpaper-host-${port}.lock`))
  );
});

test("host closes its socket and lock when Runtime initialization fails", async (t) => {
  const id = "0123456789abcdef0123456789abcdef";
  const sockets = new Set();
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
      if (incoming.length < 7) return;
      const length = incoming[1] & 127;
      if (incoming.length < 6 + length || (incoming[0] & 15) !== 1) return;
      const mask = incoming.subarray(2, 6);
      const command = JSON.parse(
        incoming
          .subarray(6, 6 + length)
          .map((byte, index) => byte ^ mask[index % 4])
          .toString()
      );
      incoming = Buffer.alloc(0);
      if (command.method !== "Runtime.enable") return;
      const body = Buffer.from(
        JSON.stringify({
          id: command.id,
          error: { message: "initialization failed" },
        })
      );
      socket.end(
        Buffer.concat([
          Buffer.from([0x81, body.length]),
          body,
          Buffer.from([0x88, 0]),
        ])
      );
    });
  });
  const port = await listenOnUnusedPort(server);
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise((resolve) => server.close(resolve));
  });

  const child = spawn(
    process.execPath,
    ["--no-use-env-proxy", "launcher/wallpaper-host.mjs", String(port)],
    { stdio: "ignore" }
  );
  const [code] = await once(child, "exit");
  assert.equal(code, 1);
  await assert.rejects(
    access(join(tmpdir(), `codex-wallpaper-host-${port}.lock`))
  );
  assert.equal(sockets.size, 0);
});

for (const staleResult of ["success", "failure"]) {
  test(`host retries the latest same-id request after a stale ${staleResult}`, async (t) => {
    const steamRoot = await mkdtemp(
      join(tmpdir(), `codex-wallpaper-flight-${staleResult}-`)
    );
    const project = join(
      steamRoot,
      "steamapps",
      "workshop",
      "content",
      "431960",
      "flight-project"
    );
    const distribution = join(
      steamRoot,
      "steamapps",
      "common",
      "wallpaper_engine",
      "distribution"
    );
    await mkdir(project, { recursive: true });
    await mkdir(distribution, { recursive: true });
    await writeFile(join(distribution, "version.json"), "{}");
    await writeFile(
      join(project, "project.json"),
      JSON.stringify({
        type: "image",
        title: "Flight project",
        file: "image.png",
      })
    );
    await writeFile(join(project, "image.png"), Buffer.from([1]));
    const previousRoot = process.env.DSH_WE_STEAM_ROOT;
    process.env.DSH_WE_STEAM_ROOT = steamRoot;
    t.after(() => {
      if (previousRoot === undefined) delete process.env.DSH_WE_STEAM_ROOT;
      else process.env.DSH_WE_STEAM_ROOT = previousRoot;
      return rm(steamRoot, { recursive: true, force: true });
    });

    const server = createServer();
    const port = await listenOnUnusedPort(server);
    await new Promise((resolve) => server.close(resolve));
    const events = [];
    const oldFinishSeen = Promise.withResolvers();
    const oldRelease = Promise.withResolvers();
    const newFinished = Promise.withResolvers();
    let bindingHandler;
    const requestToken = (expression) => {
      const match = expression.match(/, ("(?:[^"\\]|\\.)*"|null)\)$/);
      return match ? JSON.parse(match[1]) : null;
    };
    const session = {
      async send(method, params = {}) {
        if (method !== "Runtime.evaluate") return { result: {} };
        const expression = params.expression;
        if (expression.startsWith("document.querySelector("))
          return { result: { objectId: "file-input" } };
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
          )
        ) {
          const token = requestToken(expression);
          events.push(`begin:${token}`);
          return { result: { value: `file-${token}` } };
        }
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi.finishAssetFileTransfer("
          )
        ) {
          const token = requestToken(expression);
          events.push(`finish:${token}`);
          if (token === "old") {
            oldFinishSeen.resolve();
            await oldRelease.promise;
            if (staleResult === "failure")
              return {
                exceptionDetails: {
                  exception: { description: "stale failure" },
                },
              };
          } else {
            newFinished.resolve();
          }
          return { result: { value: true } };
        }
        if (
          expression.startsWith(
            "globalThis.__codexWallpaperApi?.receiveAssetError("
          )
        ) {
          events.push(`error:${requestToken(expression)}`);
        }
        return {
          result: { value: { state: "enabled", hostReady: true } },
        };
      },
      on(method, handler) {
        if (method === "Runtime.bindingCalled") bindingHandler = handler;
      },
      onClose() {},
      close() {},
    };
    const host = await attachWallpaperHost({
      port,
      session,
      source: "({ state: 'disabled' })",
    });
    assert.ok(host);
    t.after(() => host.stop());
    const request = (token) =>
      bindingHandler({
        name: "__codexWallpaperHostRequest",
        payload: JSON.stringify({
          type: "load-asset",
          id: "flight-project",
          request: token,
        }),
      });
    request("old");
    await oldFinishSeen.promise;
    request("new");
    oldRelease.resolve();
    await Promise.race([
      newFinished.promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Replacement request did not run")),
          3000
        )
      ),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.deepEqual(events, [
      "begin:old",
      "finish:old",
      "begin:new",
      "finish:new",
    ]);
  });
}

test("host stops a rejected File delivery without a newer same-id request", async (t) => {
  const steamRoot = await mkdtemp(
    join(tmpdir(), "codex-wallpaper-stale-file-")
  );
  const project = join(
    steamRoot,
    "steamapps",
    "workshop",
    "content",
    "431960",
    "stale-file-project"
  );
  const distribution = join(
    steamRoot,
    "steamapps",
    "common",
    "wallpaper_engine",
    "distribution"
  );
  await mkdir(project, { recursive: true });
  await mkdir(distribution, { recursive: true });
  await writeFile(join(distribution, "version.json"), "{}");
  await writeFile(
    join(project, "project.json"),
    JSON.stringify({
      type: "image",
      title: "Stale File project",
      file: "image.png",
    })
  );
  await writeFile(join(project, "image.png"), Buffer.from([1]));
  const previousRoot = process.env.DSH_WE_STEAM_ROOT;
  process.env.DSH_WE_STEAM_ROOT = steamRoot;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.DSH_WE_STEAM_ROOT;
    else process.env.DSH_WE_STEAM_ROOT = previousRoot;
    return rm(steamRoot, { recursive: true, force: true });
  });

  const server = createServer();
  const port = await listenOnUnusedPort(server);
  await new Promise((resolve) => server.close(resolve));
  let bindingHandler;
  let fileAttempts = 0;
  const firstAttempt = Promise.withResolvers();
  const session = {
    async send(method, params = {}) {
      if (method !== "Runtime.evaluate") return { result: {} };
      const expression = params.expression;
      if (expression.startsWith("document.querySelector("))
        return { result: { objectId: "file-input" } };
      if (
        expression.startsWith(
          "globalThis.__codexWallpaperApi.beginAssetFileTransfer("
        )
      ) {
        fileAttempts += 1;
        firstAttempt.resolve();
        await new Promise((resolve) => setImmediate(resolve));
        return { result: { value: null } };
      }
      return {
        result: { value: { state: "enabled", hostReady: true } },
      };
    },
    on(method, handler) {
      if (method === "Runtime.bindingCalled") bindingHandler = handler;
    },
    onClose() {},
    close() {},
  };
  const host = await attachWallpaperHost({
    port,
    session,
    source: "({ state: 'disabled' })",
  });
  assert.ok(host);
  t.after(() => host.stop());
  await bindingHandler({
    name: "__codexWallpaperHostRequest",
    payload: JSON.stringify({
      type: "load-asset",
      id: "stale-file-project",
      request: "stale",
    }),
  });
  await firstAttempt.promise;
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(fileAttempts, 1);
});
