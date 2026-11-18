import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callMainPage, openMainPageSession } from "./read-only-probe.mjs";
import {
  loadWallpaperPreview,
  prepareWallpaperAsset,
} from "./wallpaper-library.mjs";

const port = Number(process.argv[2]);
const bindingName = "__codexWallpaperHostRequest";
const page = "app://-/index.html";
const engineUrl = new URL(
  "../node_modules/webwallgl/webwallgl.global.min.js",
  import.meta.url
);
const inFlight = new Map();
let stopped = false;
const lockPath = join(tmpdir(), `codex-wallpaper-host-${port}.lock`);
let lockHandle = null;

async function acquireLock() {
  try {
    lockHandle = await open(lockPath, "wx");
    await lockHandle.writeFile(String(process.pid));
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    try {
      const owner = Number(await readFile(lockPath, "utf8"));
      process.kill(owner, 0);
      return false;
    } catch {
      await unlink(lockPath).catch(() => {});
      lockHandle = await open(lockPath, "wx");
      await lockHandle.writeFile(String(process.pid));
      return true;
    }
  }
}

async function releaseLock() {
  lockHandle?.close();
  lockHandle = null;
  await unlink(lockPath).catch(() => {});
}

async function respond(expression) {
  return callMainPage(
    port,
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    page,
    true
  );
}

async function sessionEvaluate(expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Runtime evaluation failed"
    );
  return result?.result?.value;
}

async function loadPreview(id) {
  const entry = await loadWallpaperPreview(id);
  if (!entry) throw new Error("Preview not found");
  await sessionEvaluate(
    `globalThis.__codexWallpaperApi.receivePreview(${JSON.stringify(entry)})`
  );
}

async function loadAsset(id) {
  const entry = await prepareWallpaperAsset(id);
  if (!entry) throw new Error("Wallpaper not found");
  if (entry.type !== "web" && !entry.playable) {
    if (entry.previewDataUrl)
      await sessionEvaluate(
        `globalThis.__codexWallpaperApi.receivePreview(${JSON.stringify({
          id: entry.id,
          previewDataUrl: entry.previewDataUrl,
          fallback: true,
        })})`
      );
    throw new Error("Wallpaper exceeds the 512 MiB transfer limit");
  }
  if (entry.type === "scene") {
    const available = await respond("typeof globalThis.WebWallGL === 'object'");
    if (available?.result?.value !== true) {
      const engine = await readFile(engineUrl, "utf8");
      await respond(engine);
    }
  }
  const { path, mime, size, ...metadata } = entry;
  if (entry.type === "web") {
    await sessionEvaluate(
      `globalThis.__codexWallpaperApi.receiveAsset(${JSON.stringify(metadata)})`
    );
    return;
  }
  const handle = await open(path, "r");
  try {
    const opened = await sessionEvaluate(
      `globalThis.__codexWallpaperApi.beginAssetTransfer(${JSON.stringify({
        ...metadata,
        mime,
        size,
      })})`
    );
    if (opened === false) return false;
    const chunkSize = 4 * 1024 * 1024;
    for (let offset = 0; offset < size; offset += chunkSize) {
      const length = Math.min(chunkSize, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead <= 0) throw new Error("Asset transfer ended early");
      const received = await sessionEvaluate(
        `globalThis.__codexWallpaperApi.appendAssetTransferChunk(${JSON.stringify(
          String(id)
        )}, ${JSON.stringify(buffer.subarray(0, bytesRead).toString("base64"))})`
      );
      if (received === false) return false;
    }
    return await sessionEvaluate(
      `globalThis.__codexWallpaperApi.finishAssetTransfer(${JSON.stringify(
        String(id)
      )})`
    );
  } finally {
    await handle.close();
  }
}

const requestHandlers = {
  "load-preview": { run: loadPreview, error: "receivePreviewError" },
  "load-asset": { run: loadAsset, error: "receiveAssetError" },
};

let session;
try {
  if (!(await acquireLock())) process.exit(0);
  session = await openMainPageSession(port, page, true);
  session.onClose(releaseLock);
  session.on("Runtime.bindingCalled", ({ name, payload }) => {
    if (name !== bindingName || stopped) return;
    let request;
    try {
      request = JSON.parse(payload);
    } catch {
      return;
    }
    if (request.type === "stop") {
      stopped = true;
      session.close();
      return;
    }
    const handler = requestHandlers[request.type];
    if (!handler) return;
    const key = `${request.type}:${request.id}`;
    const running = inFlight.get(key);
    if (running) {
      if (request.type === "load-asset") running.replacementRequested = true;
      return;
    }
    const flight = { replacementRequested: false };
    inFlight.set(key, flight);
    const deliver = async () => {
      do {
        flight.replacementRequested = false;
        if ((await handler.run(request.id)) !== false) return;
      } while (flight.replacementRequested && !stopped);
    };
    deliver()
      .catch((error) => {
        sessionEvaluate(
          `globalThis.__codexWallpaperApi?.${handler.error}(${JSON.stringify(
            String(request.id)
          )}, ${JSON.stringify(String(error?.message || error))})`
        ).catch(() => {});
      })
      .finally(() => inFlight.delete(key));
  });
  await session.send("Runtime.enable");
  await session.send("Runtime.addBinding", { name: bindingName });
  console.log(JSON.stringify({ ready: true, pid: process.pid }));
} catch {
  stopped = true;
  session?.close();
  process.exitCode = 1;
  await releaseLock();
}
