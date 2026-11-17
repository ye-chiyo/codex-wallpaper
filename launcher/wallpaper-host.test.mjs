import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { access } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

test("host fails closed and removes its lock without a reachable Codex port", async () => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
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
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
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
