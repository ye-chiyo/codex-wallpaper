import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  openMainPageSession,
  verifyMainFrame,
} from "../../../../launcher/read-only-probe.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";
const api = "globalThis.__codexWallpaperApi";

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text
    );
  return result.result.value;
}

async function waitFor(page, expression, timeoutMilliseconds = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(page, expression)) return Date.now() - startedAt;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function importedCount(page) {
  return evaluate(
    page,
    `(async () => {
      const databases = await indexedDB.databases();
      if (!databases.some((entry) => entry.name === "codex-wallpaper-media"))
        return 0;
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("codex-wallpaper-media", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        if (!db.objectStoreNames.contains("media")) return 0;
        return await new Promise((resolve, reject) => {
          const request = db
            .transaction("media", "readonly")
            .objectStore("media")
            .count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } finally {
        db.close();
      }
    })()`
  );
}

async function applyConfig(page, raw) {
  await evaluate(
    page,
    `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(raw)})`
  );
  await evaluate(page, `${api}.refresh()`);
}

async function hardwareState(page) {
  return evaluate(
    page,
    `({
      state: ${api}.state(),
      root: Boolean(document.querySelector(${JSON.stringify(rootSelector)})),
      media: document.querySelectorAll(${JSON.stringify(
        rootSelector + " .media:not(.staged)"
      )}).length,
      staged: document.querySelectorAll(${JSON.stringify(
        rootSelector + " .media.staged"
      )}).length,
      fileInputs: document.querySelectorAll("[data-codex-wallpaper-file]").length
    })`
  );
}

async function lockOwner(port) {
  try {
    const value = await readFile(
      join(tmpdir(), `codex-wallpaper-host-${port}.lock`),
      "utf8"
    );
    return Number(value.trim());
  } catch {
    return null;
  }
}

async function main() {
  const [portText, configBackupPath, outputPath] = process.argv.slice(2);
  const port = Number(portText);
  if (!Number.isInteger(port) || !configBackupPath || !outputPath)
    throw new Error(
      "Usage: node reset-restore.mjs <cdp-port> <config-backup> <output.json>"
    );

  const original = await readFile(configBackupPath, "utf8");
  const originalConfig = JSON.parse(original);
  const testConfig = JSON.stringify({ ...originalConfig, enabled: true });
  const report = {
    startedAt: new Date().toISOString(),
    port,
    originalConfigHash: hash(original),
    reset: null,
    redelivery: null,
    restored: null,
  };
  const page = await openMainPageSession(port, "app://-/index.html", true);
  try {
    verifyMainFrame(await page.send("Page.getFrameTree"));
    report.identity = await evaluate(page, `${api}.identity()`);
    report.before = await hardwareState(page);
    const imports = await importedCount(page);
    report.importedCount = imports;
    if (imports !== 0) {
      report.skipped = "imported-media-present";
      report.reset = { skipped: true, importedCount: imports };
    } else {
      await evaluate(
        page,
        `(() => {
          const reset = document.querySelector(${JSON.stringify(
            `${controlsSelector} .reset`
          )});
          if (!reset) throw new Error("Reset control is missing");
          reset.click();
        })()`
      );
      await sleep(50);
      await evaluate(
        page,
        `document.querySelector(${JSON.stringify(
          `${controlsSelector} .reset`
        )}).click()`
      );
      await waitFor(
        page,
        `${api}.state().state === "disabled" &&
          !document.querySelector(${JSON.stringify(rootSelector)})`,
        20000
      );
      report.reset = {
        completedAt: new Date().toISOString(),
        state: await hardwareState(page),
        importedCount: await importedCount(page),
      };

      await applyConfig(page, testConfig);
      await waitFor(
        page,
        `(() => {
          const state = ${api}.state();
          const root = document.querySelector(${JSON.stringify(rootSelector)});
          return state.state === "enabled" &&
            state.hostReady === true &&
            state.activeId === ${JSON.stringify(originalConfig.active?.id ?? null)} &&
            Boolean(root) &&
            root.querySelectorAll(".media:not(.staged)").length === 1 &&
            root.querySelectorAll(".media.staged").length === 0;
        })()`,
        45000
      );
      report.redelivery = {
        completedAt: new Date().toISOString(),
        state: await hardwareState(page),
        hostLockOwner: await lockOwner(port),
      };
    }
  } catch (error) {
    report.error = String(error?.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await applyConfig(page, original);
      await waitFor(
        page,
        `localStorage.getItem(${JSON.stringify(configKey)}) === ${JSON.stringify(
          original
        )}`,
        12000
      );
      report.restored = {
        completedAt: new Date().toISOString(),
        state: await hardwareState(page),
        configExact:
          (await evaluate(
            page,
            `localStorage.getItem(${JSON.stringify(configKey)})`
          )) === original,
        hostLockOwner: await lockOwner(port),
      };
    } catch (error) {
      report.restoreError = String(error?.message || error);
      process.exitCode = 1;
    } finally {
      report.finishedAt = new Date().toISOString();
      await writeFile(
        outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        "utf8"
      );
      page.close();
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === new URL(import.meta.url).href
) {
  await main();
}
