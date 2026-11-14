import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { runtimeSource } from "./client-runtime.mjs";
import { callMainPage } from "./read-only-probe.mjs";
import { scanWallpaperLibrary } from "./wallpaper-library.mjs";

const defaultPage = "app://-/index.html";
const bridgeUrl = new URL("./wallpaper-host.mjs", import.meta.url);

async function evaluate(port, page, source) {
  const result = await callMainPage(
    port,
    "Runtime.evaluate",
    { expression: source, returnByValue: true, awaitPromise: true },
    page,
    true
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

async function payloadFor() {
  try {
    const library = await scanWallpaperLibrary({
      assetLimit: 0,
      previewLimit: 0,
    });
    return { version: 1, library: library.entries };
  } catch {
    return { version: 1, library: [] };
  }
}

export async function applyStaticBackground(port, options = {}) {
  const page = options.page ?? defaultPage;
  const payload = options.payload ?? (await payloadFor());
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
    let result = await applyStaticBackground(port, { action });
    if (action === "enable" && result.state === "enabled") {
      const bridge = await startBridge(port);
      if (bridge.bridgePid)
        result = await evaluate(
          port,
          defaultPage,
          "globalThis.__codexWallpaperApi.configureHost()"
        );
      result.bridgePid = bridge.bridgePid;
      if (bridge.bridgeError) result.bridgeError = bridge.bridgeError;
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = String(error?.message || error).replace(
      /[A-Za-z]:\\[^\s"']+/g,
      "<path>"
    );
    console.log(
      JSON.stringify({
        state: "failed",
        error: {
          name: String(error?.name || "Error"),
          message: message.slice(0, 240),
        },
      })
    );
    process.exitCode = 1;
  }
}
