import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { readMainFrame, selectEndpoint } from "./read-only-probe.mjs";

const id = "0123456789ABCDEF0123456789ABCDEF";
const page = "app://-/index.html";
const target = (port, url = page) => ({
  id,
  type: "page",
  url,
  webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${id}`,
});

async function startCdpFixture(
  t,
  {
    targetUrl = page,
    frameUrl = page,
    origin = "app://-",
    extraMain = false,
  } = {}
) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push([request.method, request.url]);
    const targets = [target(server.address().port, targetUrl)];
    if (extraMain) {
      const secondaryId = "fedcba9876543210fedcba9876543210";
      targets.push({
        ...target(server.address().port),
        id: secondaryId,
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/devtools/page/${secondaryId}`,
      });
    }
    response.end(JSON.stringify(targets));
  });
  const sockets = new Set();
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    return new Promise((resolve) => server.close(resolve));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket) => {
    requests.push([request.method, request.url]);
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
      const length = incoming[1] & 127;
      if (incoming.length < 6 + length || (incoming[0] & 15) !== 1) return;
      const mask = incoming.subarray(2, 6);
      const command = incoming
        .subarray(6, 6 + length)
        .map((byte, index) => byte ^ mask[index % 4]);
      requests.push(JSON.parse(command.toString()));
      const body = Buffer.from(
        JSON.stringify({
          id: 1,
          result: {
            frameTree: {
              frame: { url: frameUrl, securityOrigin: origin },
            },
          },
        })
      );
      const header =
        body.length < 126
          ? Buffer.from([0x81, body.length])
          : Buffer.from([0x81, 126, 0, body.length]);
      socket.end(Buffer.concat([header, body, Buffer.from([0x88, 0])]));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { port: server.address().port, requests };
}

test("accepts only an unambiguous main page on the verified loopback port", () => {
  const port = 25000;
  const main = target(port, `${page}?transient=not-in-report`);
  assert.equal(selectEndpoint([main], port), main.webSocketDebuggerUrl);
  assert.equal(
    selectEndpoint([{ ...main, url: "https://example.test/" }], port),
    null
  );
  assert.throws(() => selectEndpoint([main, main], port), /Ambiguous/);
  for (const url of [
    main.webSocketDebuggerUrl.replace("127.0.0.1", "localhost"),
    main.webSocketDebuggerUrl.replace(":25000", ":25001"),
    main.webSocketDebuggerUrl.replace("/page/", "/browser/"),
  ]) {
    assert.throws(() =>
      selectEndpoint([{ ...main, webSocketDebuggerUrl: url }], port)
    );
  }
});

test("exact page selection ignores auxiliary query-routed windows", () => {
  const port = 25000;
  const main = target(port);
  const avatar = {
    ...target(port, `${page}?initialRoute=%2Favatar-overlay`),
    id: "fedcba9876543210fedcba9876543210",
    webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/fedcba9876543210fedcba9876543210`,
  };
  assert.throws(() => selectEndpoint([main, avatar], port), /Ambiguous/);
  assert.equal(
    selectEndpoint([main, avatar], port, page, true),
    main.webSocketDebuggerUrl
  );
});

test("sends only Page.getFrameTree and emits no transient URL data", async (t) => {
  const fixture = await startCdpFixture(t);
  assert.deepEqual(await readMainFrame(fixture.port), {
    method: "Page.getFrameTree",
    page,
    origin: "app://-",
  });
  assert.deepEqual(fixture.requests, [
    ["GET", "/json/list"],
    ["GET", `/devtools/page/${id}`],
    { id: 1, method: "Page.getFrameTree", params: {} },
  ]);
});

test("preflight fails closed before protocol access for two exact main pages", async (t) => {
  const fixture = await startCdpFixture(t, { extraMain: true });
  await assert.rejects(
    readMainFrame(fixture.port),
    (error) => error.code === "ambiguous-main-page"
  );
  assert.deepEqual(fixture.requests, [["GET", "/json/list"]]);
});

test("preflight rejects a query-routed target before protocol access", async (t) => {
  const fixture = await startCdpFixture(t, {
    targetUrl: `${page}?initialRoute=%2Favatar-overlay`,
  });
  assert.equal(await readMainFrame(fixture.port), null);
  assert.deepEqual(fixture.requests, [["GET", "/json/list"]]);
});

test("preflight rejects a query-routed frame", async (t) => {
  const fixture = await startCdpFixture(t, {
    frameUrl: `${page}?initialRoute=%2Favatar-overlay`,
  });
  await assert.rejects(readMainFrame(fixture.port), /Unverified main frame/);
});

test("preflight rejects a frame outside the Codex app origin", async (t) => {
  const fixture = await startCdpFixture(t, {
    origin: "https://example.test",
  });
  await assert.rejects(readMainFrame(fixture.port), /Unverified main frame/);
});
