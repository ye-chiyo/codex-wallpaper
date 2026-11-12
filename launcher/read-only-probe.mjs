import { get } from "node:http";
import { pathToFileURL } from "node:url";

const host = "127.0.0.1";
const page = "app://-/index.html";
const timeoutMs = 2_500;

function isMainPage(value, expectedPage = page) {
  if (typeof value !== "string") return false;
  return value.split(/[?#]/, 1)[0] === expectedPage;
}

export function selectEndpoint(targets, port, expectedPage = page) {
  if (!Array.isArray(targets)) throw new Error("Invalid discovery response");
  const matches = targets.filter(
    (target) => target?.type === "page" && isMainPage(target.url, expectedPage)
  );
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error("Ambiguous main page");
  const target = matches[0];
  if (typeof target.id !== "string" || !/^[a-f0-9]{32}$/i.test(target.id)) {
    throw new Error("Invalid target ID");
  }
  const expected = `ws://${host}:${port}/devtools/page/${target.id}`;
  if (target.webSocketDebuggerUrl !== expected) {
    throw new Error("Unexpected WebSocket endpoint");
  }
  return expected;
}

export function listPages(port) {
  return new Promise((resolve, reject) => {
    const request = get(
      { host, port, path: "/json/list", agent: false },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(new Error("Unexpected discovery status"));
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (part) => {
          body += part;
          if (body.length > 512 * 1024)
            request.destroy(new Error("Discovery too large"));
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    const deadline = setTimeout(
      () => request.destroy(new Error("Discovery timeout")),
      timeoutMs
    );
    request.on("error", reject);
    request.on("close", () => clearTimeout(deadline));
  });
}

export async function callMainPage(
  port,
  method,
  params = {},
  expectedPage = page
) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid port");
  const endpoint = selectEndpoint(await listPages(port), port, expectedPage);
  if (endpoint === null) return null;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const deadline = setTimeout(
      () => finish(new Error("Frame probe timeout")),
      timeoutMs
    );
    function finish(error, result) {
      clearTimeout(deadline);
      if (error) reject(error);
      else resolve(result);
      socket.close();
    }
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
    socket.addEventListener("message", ({ data }) => {
      try {
        const response = JSON.parse(data);
        if (response.id !== 1) return;
        if (response.error) {
          finish(new Error(response.error.message ?? "CDP request failed"));
          return;
        }
        finish(null, response.result);
      } catch (error) {
        finish(error);
      }
    });
    socket.addEventListener("error", () =>
      finish(new Error("WebSocket failed"))
    );
    socket.addEventListener("close", () =>
      finish(new Error("WebSocket closed"))
    );
  });
}

export async function readMainFrame(port) {
  const result = await callMainPage(port, "Page.getFrameTree");
  if (result === null) return null;
  const frame = result?.frameTree?.frame;
  if (!isMainPage(frame?.url) || frame.securityOrigin !== "app://-")
    throw new Error("Unverified main frame");
  return { method: "Page.getFrameTree", page, origin: "app://-" };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  // Force a finite lifetime even if the peer never completes the close handshake.
  const hardDeadline = setTimeout(() => process.exit(3), 2 * timeoutMs + 500);
  try {
    const result = await readMainFrame(Number(process.argv[2]));
    if (result === null) process.exitCode = 2;
    else console.log(JSON.stringify(result));
  } catch {
    // Do not relay raw endpoint responses, titles, paths or protocol errors to logs.
    process.exitCode = 3;
  } finally {
    hardDeadline.unref();
  }
}
