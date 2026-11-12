import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { runtimeSource } from "./client-runtime.mjs";
import { callMainPage } from "./read-only-probe.mjs";
import { scanWallpaperLibrary } from "./wallpaper-library.mjs";

const defaultPage = "app://-/index.html";
export const wallpaperConfigKey = "codex-wallpaper-p1-config";
const sceneEngineUrl = new URL(
  "../node_modules/webwallgl/webwallgl.global.min.js",
  import.meta.url
);
const bridgeUrl = new URL("./wallpaper-host.mjs", import.meta.url);

async function evaluate(port, page, source) {
  const result = await callMainPage(
    port,
    "Runtime.evaluate",
    { expression: source, returnByValue: true, awaitPromise: true },
    page
  );
  if (result === null) throw new Error("Main page not uniquely available");
  if (result?.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Evaluation rejected"
    );
  }
  return result?.result?.value;
}

async function activeLibraryId(port, page) {
  const raw = await evaluate(
    port,
    page,
    `localStorage.getItem(${JSON.stringify(wallpaperConfigKey)})`
  );
  try {
    const value = JSON.parse(raw || "null");
    if (
      value?.active?.kind === "workshop" &&
      typeof value.active.id === "string"
    )
      return value.active.id;
  } catch {
    return null;
  }
  return null;
}

async function payloadFor(port, page) {
  const activeId = await activeLibraryId(port, page);
  try {
    const library = await scanWallpaperLibrary({
      assetIds: activeId ? [activeId] : [],
    });
    const active = library.entries.find(
      (entry) => entry.id === activeId && entry.kind !== "imported"
    );
    if (active?.type === "scene" && active.assetDataUrl) {
      const available = await evaluate(
        port,
        page,
        "typeof globalThis.WebWallGL === 'object'"
      );
      if (!available) {
        const engine = await readFile(sceneEngineUrl, "utf8");
        await evaluate(port, page, engine);
      }
    }
    return { version: 1, library: library.entries };
  } catch {
    return { version: 1, library: [] };
  }
}

export async function applyStaticBackground(port, options = {}) {
  const page = options.page ?? defaultPage;
  const payload = options.payload ?? (await payloadFor(port, page));
  const result = await evaluate(port, page, runtimeSource(payload));
  if (!result || result.state === undefined)
    throw new Error("Missing wallpaper state");
  if (options.action === "disable") {
    return evaluate(port, page, "globalThis.__codexWallpaperApi.disable()");
  }
  return result;
}

export async function evaluateInPage(port, source, options = {}) {
  return evaluate(port, options.page ?? defaultPage, source);
}

async function startBridge(port) {
  const child = spawn(
    process.execPath,
    ["--no-use-env-proxy", fileURLToPath(bridgeUrl), String(port)],
    {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }
  );
  try {
    const ready = await new Promise((resolve, reject) => {
      let output = "";
      const deadline = setTimeout(
        () => reject(new Error("Bridge startup timeout")),
        3500
      );
      function cleanup() {
        clearTimeout(deadline);
        child.stdout.destroy();
        child.removeAllListeners("error");
        child.removeAllListeners("exit");
      }
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const line = output.split(/\r?\n/, 1)[0];
        if (!line) return;
        try {
          const value = JSON.parse(line);
          if (value.ready && value.pid) {
            cleanup();
            resolve(value.pid);
          }
        } catch {
          cleanup();
          reject(new Error("Invalid bridge response"));
        }
      });
      child.once("exit", () => {
        cleanup();
        reject(new Error("Bridge exited before ready"));
      });
      child.once("error", (error) => {
        cleanup();
        reject(error);
      });
    });
    child.unref();
    return { bridgePid: ready };
  } catch (error) {
    child.kill();
    return { bridgeError: String(error.message || error) };
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const port = Number(process.argv[2]);
  const action = process.argv[3] === "disable" ? "disable" : "enable";
  try {
    const result = await applyStaticBackground(port, { action });
    if (action === "enable" && result.state === "enabled")
      Object.assign(result, await startBridge(port));
    console.log(JSON.stringify(result));
  } catch {
    process.exitCode = 1;
  }
}
