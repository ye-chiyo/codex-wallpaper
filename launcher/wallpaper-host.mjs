import { open, readFile, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { openMainPageSession } from "./read-only-probe.mjs";
import { acquireHostLock, releaseHostLock } from "./host-lock.mjs";
import { runtimeSource } from "./client-runtime.mjs";
import { payloadFor } from "./static-background.mjs";
import { prepareMp4VirtualLayout } from "./mp4-layout.mjs";
import {
  base64TransferLimitBytes,
  loadWallpaperPreview,
  prepareWallpaperAsset,
  videoFilePlaybackLimitBytes,
} from "./wallpaper-library.mjs";

const defaultPage = "app://-/index.html";
const bindingName = "__codexWallpaperHostRequest";
const engineUrl = new URL(
  "../node_modules/webwallgl/webwallgl.global.min.js",
  import.meta.url
);

async function evaluateSession(session, expression, returnByValue) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    returnByValue,
    awaitPromise: returnByValue,
  });
  if (result?.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Runtime evaluation failed"
    );
  return result?.result;
}

export async function sessionEvaluate(session, expression) {
  return (await evaluateSession(session, expression, true))?.value;
}

async function sessionEvaluateObjectId(session, expression) {
  const result = await evaluateSession(session, expression, false);
  if (!result?.objectId) throw new Error("DOM object is not available");
  return result.objectId;
}

async function loadPreview(session, id) {
  const entry = await loadWallpaperPreview(id);
  if (!entry) throw new Error("Preview not found");
  await sessionEvaluate(
    session,
    `globalThis.__codexWallpaperApi.receivePreview(${JSON.stringify(entry)})`
  );
}

async function deliverFileAsset(session, entry, requestToken) {
  const { path, mime, size, ...metadata } = entry;
  const layout =
    entry.type === "video" && mime === "video/mp4"
      ? await prepareMp4VirtualLayout(path, size).catch(() => null)
      : null;
  let token = null;
  try {
    token = await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.beginAssetFileTransfer(${JSON.stringify({
        ...metadata,
        mime,
        size,
      })}, ${JSON.stringify(layout)}, ${JSON.stringify(requestToken ?? null)})`
    );
    if (token === null) return false;
    if (!token) return "file-input-unavailable";
    const objectId = await sessionEvaluateObjectId(
      session,
      `document.querySelector("input[data-codex-wallpaper-file=\\"${token}\\"]")`
    );
    try {
      await session.send("DOM.setFileInputFiles", {
        files: [path],
        objectId,
      });
    } finally {
      await session.send("Runtime.releaseObject", { objectId }).catch(() => {});
    }
    const delivered = await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.finishAssetFileTransfer(${JSON.stringify(
        String(token)
      )}, ${JSON.stringify(requestToken ?? null)})`
    );
    if (delivered === null) return "file-input-unavailable";
    return delivered === false ? false : null;
  } catch {
    if (token) {
      const cancelled = await sessionEvaluate(
        session,
        `globalThis.__codexWallpaperApi?.cancelAssetFileTransfer?.(${JSON.stringify(
          String(token)
        )})`
      ).catch(() => {});
      if (cancelled === false) return false;
    }
    return "file-input-failed";
  }
}

async function failWithPreview(session, entry, message) {
  if (entry.previewDataUrl)
    await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.receivePreview(${JSON.stringify({
        id: entry.id,
        previewDataUrl: entry.previewDataUrl,
        fallback: true,
      })})`
    );
  throw new Error(message);
}

async function loadAsset(session, id, requestToken) {
  const entry = await prepareWallpaperAsset(id);
  if (!entry) throw new Error("Wallpaper not found");
  if (entry.type !== "web" && !entry.playable)
    await failWithPreview(
      session,
      entry,
      entry.type === "video"
        ? `Video exceeds the ${videoFilePlaybackLimitBytes / 1024 ** 3} GiB File playback limit`
        : `Wallpaper exceeds the ${base64TransferLimitBytes / 1024 ** 2} MiB transfer limit`
    );
  if (entry.type === "scene") {
    const available = await sessionEvaluate(
      session,
      "typeof globalThis.WebWallGL === 'object'"
    );
    if (available !== true) {
      const engine = await readFile(engineUrl, "utf8");
      await sessionEvaluate(session, engine);
    }
  }
  const { path, mime, size, ...metadata } = entry;
  if (entry.type === "web") {
    await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.receiveAsset(${JSON.stringify(metadata)}, ${JSON.stringify(requestToken ?? null)})`
    );
    return;
  }

  const fileFallbackReason = await deliverFileAsset(
    session,
    entry,
    requestToken
  );
  if (fileFallbackReason === false) return false;
  if (fileFallbackReason === null) return;
  if (entry.size > base64TransferLimitBytes)
    await failWithPreview(
      session,
      entry,
      `File playback is unavailable for assets larger than ${base64TransferLimitBytes / 1024 ** 2} MiB`
    );

  const handle = await open(path, "r");
  try {
    const opened = await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.beginAssetTransfer(${JSON.stringify({
        ...metadata,
        mime,
        size,
        fileFallbackReason,
      })}, ${JSON.stringify(requestToken ?? null)})`
    );
    if (opened === false) return false;
    const chunkSize = 4 * 1024 * 1024;
    for (let offset = 0; offset < size; offset += chunkSize) {
      const length = Math.min(chunkSize, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead <= 0) throw new Error("Asset transfer ended early");
      const received = await sessionEvaluate(
        session,
        `globalThis.__codexWallpaperApi.appendAssetTransferChunk(${JSON.stringify(
          String(id)
        )}, ${JSON.stringify(
          buffer.subarray(0, bytesRead).toString("base64")
        )}, ${JSON.stringify(requestToken ?? null)})`
      );
      if (received === false) return false;
    }
    return await sessionEvaluate(
      session,
      `globalThis.__codexWallpaperApi.finishAssetTransfer(${JSON.stringify(
        String(id)
      )}, ${JSON.stringify(requestToken ?? null)})`
    );
  } finally {
    await handle.close();
  }
}

const requestHandlers = {
  "load-preview": { run: loadPreview, error: "receivePreviewError" },
  "load-asset": { run: loadAsset, error: "receiveAssetError" },
};

export async function attachWallpaperHost({
  port,
  session,
  page = defaultPage,
  source = null,
  updateStartupPreview = null,
}) {
  const acquired = await acquireHostLock(port);
  if (!acquired.acquired) return null;
  const lock = acquired.lock;
  const inFlight = new Map();
  let stopped = false;
  let stopRequested = false;
  let cleanup;
  let startupMotionTransfer = null;
  function release() {
    stopped = true;
    return (cleanup ??= releaseHostLock(lock));
  }
  session.onClose(() => {
    void release().catch(() => {});
  });

  session.on("Runtime.bindingCalled", async ({ name, payload: raw }) => {
    if (name !== bindingName || stopped) return;
    let request;
    try {
      request = JSON.parse(raw);
    } catch {
      return;
    }
    if (request.type === "stop") {
      stopRequested = true;
      stopped = true;
      session.close();
      return;
    }
    if (request.type === "startup-preview") {
      await updateStartupPreview?.(request).catch(() => {});
      return;
    }
    if (request.type === "startup-motion-needed") {
      if (
        !updateStartupPreview?.hasMotion ||
        !Number.isSafeInteger(request.token)
      )
        return;
      const needed = !(await updateStartupPreview.hasMotion(request));
      if (stopped) return;
      startupMotionTransfer = needed
        ? { composition: request, chunks: [], length: 0 }
        : null;
      await sessionEvaluate(
        session,
        `globalThis.__codexWallpaperApi?.startupMotionDecision(${request.token}, ${needed})`
      ).catch(() => {});
      return;
    }
    if (request.type === "startup-motion-chunk") {
      const transfer = startupMotionTransfer;
      if (
        !transfer ||
        transfer.composition.token !== request.token ||
        request.index !== transfer.chunks.length ||
        request.index >= 42 ||
        typeof request.data !== "string" ||
        request.data.length > 192 * 1024
      )
        return;
      const chunk = Buffer.from(request.data, "base64");
      transfer.length += chunk.length;
      if (transfer.length > 6_000_000) {
        startupMotionTransfer = null;
        return;
      }
      transfer.chunks.push(chunk);
      if (request.last === true) {
        startupMotionTransfer = null;
        await updateStartupPreview
          .saveMotion(
            transfer.composition,
            request,
            Buffer.concat(transfer.chunks, transfer.length)
          )
          .catch(() => {});
      }
      return;
    }
    const handler = requestHandlers[request.type];
    if (!handler) return;
    const key = `${request.type}:${request.id}`;
    const running = inFlight.get(key);
    if (running) {
      if (request.type === "load-asset") {
        running.requestToken = request.request ?? null;
        running.requestVersion += 1;
      }
      return;
    }
    const flight = {
      requestToken: request.request ?? null,
      requestVersion: 0,
    };
    inFlight.set(key, flight);
    let attemptToken = flight.requestToken;
    const deliver = async () => {
      while (!stopped) {
        attemptToken = flight.requestToken;
        const requestVersion = flight.requestVersion;
        let delivered;
        try {
          delivered = await handler.run(session, request.id, attemptToken);
        } catch (error) {
          if (flight.requestVersion !== requestVersion && !stopped) continue;
          throw error;
        }
        if (flight.requestVersion !== requestVersion && !stopped) continue;
        if (delivered !== false) return;
      }
    };
    deliver()
      .catch(async (error) => {
        await sessionEvaluate(
          session,
          `globalThis.__codexWallpaperApi?.${handler.error}(${JSON.stringify(
            String(request.id)
          )}, ${JSON.stringify(String(error?.message || error))}, ${JSON.stringify(attemptToken ?? null)})`
        ).catch(() => {});
      })
      .finally(() => inFlight.delete(key));
  });

  try {
    await session.send("Runtime.enable");
    await session.send("Runtime.addBinding", { name: bindingName });
    source ??= runtimeSource(await payloadFor());
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        if (window.top !== window || location.href !== ${JSON.stringify(page)}) return;
        document.addEventListener("DOMContentLoaded", async () => {
          if (location.href !== ${JSON.stringify(page)} || globalThis.__codexWallpaperApi) return;
          const state = await ${source};
          if (!state.hostReady) await globalThis.__codexWallpaperApi.configureHost();
        }, { once: true });
      })()`,
    });
  } catch (error) {
    await release();
    throw error;
  }

  return {
    get stopRequested() {
      return stopRequested;
    },
    stop: async () => {
      session.close();
      await release();
    },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === new URL(import.meta.url).href
) {
  const port = Number(process.argv[2]);
  let session;
  try {
    session = await openMainPageSession(port, defaultPage, true);
    const host = await attachWallpaperHost({ port, session });
    if (!host) session.close();
    else console.log(JSON.stringify({ ready: true, pid: process.pid }));
  } catch (error) {
    process.exitCode = 1;
    session?.close();
    const reason =
      error?.code === "ambiguous-main-page"
        ? "ambiguous-main-page"
        : error?.code === "ECONNREFUSED"
          ? "port-unreachable"
          : /discovery status|discovery response|unexpected websocket|invalid target|main page/i.test(
                error?.message || ""
              )
            ? "port-not-codex-main-page"
            : "host-start-failed";
    console.error(JSON.stringify({ state: "error", reason }));
  }
}
