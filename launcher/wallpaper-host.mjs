import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callMainPage, openMainPageSession } from "./read-only-probe.mjs";
import { loadWallpaperAsset } from "./wallpaper-library.mjs";

const port = Number(process.argv[2]);
const bindingName = "__codexWallpaperHostRequest";
const page = "app://-/index.html";
const engineUrl = new URL(
  "../node_modules/webwallgl/webwallgl.global.min.js",
  import.meta.url
);
const inFlight = new Set();
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

async function loadAsset(id) {
  const entry = await loadWallpaperAsset(id);
  if (!entry) throw new Error("Wallpaper not found");
  if (entry.type === "scene" && entry.assetDataUrl) {
    const available = await respond("typeof globalThis.WebWallGL === 'object'");
    if (available?.result?.value !== true) {
      const engine = await readFile(engineUrl, "utf8");
      await respond(engine);
    }
  }
  await respond(
    `globalThis.__codexWallpaperApi.receiveAsset(${JSON.stringify(entry)})`
  );
}

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
    if (request.type !== "load-asset" || inFlight.has(request.id)) return;
    inFlight.add(request.id);
    loadAsset(request.id)
      .catch((error) => {
        respond(
          `globalThis.__codexWallpaperApi?.receiveAssetError(${JSON.stringify(
            request.id
          )}, ${JSON.stringify(String(error?.message || error))})`
        );
      })
      .finally(() => inFlight.delete(request.id));
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
