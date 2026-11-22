import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  openMainPageSession,
  verifyMainFrame,
} from "../../../../launcher/read-only-probe.mjs";
import { candidateIdentity } from "../../../../launcher/client-runtime.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";
const api = "globalThis.__codexWallpaperApi";

const assets = [
  { id: "2817646508", title: "ordinary image", type: "image" },
  {
    id: "1791074903",
    title: "115,500,404 B front moov",
    type: "video",
  },
  {
    id: "1986730797",
    title: "75,689,196 B tail moov",
    type: "video",
  },
  {
    id: "3403349435",
    title: "564,467,901 B bridge",
    type: "video",
  },
  { id: "3813100090", title: "4K video", type: "video" },
];

const transition = {
  from: { id: "3809295036", title: "4K90" },
  to: { id: "3272086010", title: "《鸣潮》今昔" },
};

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

async function waitFor(page, expression, timeoutMilliseconds = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(page, expression)) return Date.now() - startedAt;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function ensureVisible(page) {
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await sleep(300);
}

async function click(page, selector) {
  const target = await evaluate(
    page,
    `(() => {
      const control = document.querySelector(${JSON.stringify(selector)});
      if (!control) return null;
      control.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = control.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        x,
        y,
        receivesClick: hit === control || control.contains(hit),
        disabled: Boolean(control.disabled)
      };
    })()`
  );
  if (!target) throw new Error(`Missing click target ${selector}`);
  if (!target.receivesClick || target.disabled)
    throw new Error(`Unreachable click target ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"])
    await page.send("Input.dispatchMouseEvent", {
      type,
      x: target.x,
      y: target.y,
      button: "left",
      clickCount: 1,
    });
}

async function openPanel(page) {
  if (
    await evaluate(
      page,
      `Boolean(document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel].open`
      )}))`
    )
  )
    return;
  await click(page, `${controlsSelector} [data-codex-wallpaper-settings]`);
  await waitFor(
    page,
    `Boolean(document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-panel].open`
    )}))`
  );
}

async function clearFilters(page) {
  await evaluate(
    page,
    `(() => {
      const controls = document.querySelector(${JSON.stringify(controlsSelector)});
      for (const [selector, key, value] of [
        ["[data-library-search]", "value", ""],
        ["[data-library-type]", "value", "all"],
        ["[data-library-favorites]", "checked", false],
      ]) {
        const control = controls.querySelector(selector);
        if (!control) continue;
        control[key] = value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`
  );
}

async function installCounters(page) {
  await evaluate(
    page,
    `(() => {
      const target = ${api};
      if (globalThis.__task12Counters?.restore) globalThis.__task12Counters.restore();
      const counters = { file: 0, base64: 0, finished: 0, errors: 0 };
      const original = {
        beginAssetFileTransfer: target.beginAssetFileTransfer,
        appendAssetTransferChunk: target.appendAssetTransferChunk,
        finishAssetFileTransfer: target.finishAssetFileTransfer,
        receiveAssetError: target.receiveAssetError,
      };
      target.beginAssetFileTransfer = function (...args) {
        counters.file += 1;
        return original.beginAssetFileTransfer.apply(this, args);
      };
      target.appendAssetTransferChunk = function (...args) {
        counters.base64 += 1;
        return original.appendAssetTransferChunk.apply(this, args);
      };
      target.finishAssetFileTransfer = function (...args) {
        counters.finished += 1;
        return original.finishAssetFileTransfer.apply(this, args);
      };
      target.receiveAssetError = function (...args) {
        counters.errors += 1;
        return original.receiveAssetError.apply(this, args);
      };
      globalThis.__task12Counters = {
        counters,
        reset() {
          for (const key of Object.keys(counters)) counters[key] = 0;
        },
        restore() {
          for (const [key, value] of Object.entries(original)) target[key] = value;
        },
      };
    })()`
  );
}

async function resetCounters(page) {
  await evaluate(page, "globalThis.__task12Counters.reset()");
}

async function readCounters(page) {
  return evaluate(
    page,
    `({
      ...globalThis.__task12Counters.counters,
      staged: document.querySelectorAll(${JSON.stringify(rootSelector + " .media.staged")}).length,
      temporaryInputs: document.querySelectorAll("[data-codex-wallpaper-file]").length
    })`
  );
}

async function settle(page) {
  await sleep(800);
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      return Boolean(root) &&
        root.querySelectorAll(".media.staged").length === 0 &&
        document.querySelectorAll("[data-codex-wallpaper-file]").length === 0;
    })()`,
    8000
  );
}

async function sampleMotion(page) {
  return evaluate(
    page,
    `(async () => {
      const video = document.querySelector(${JSON.stringify(
        rootSelector + " .media:not(.staged) video"
      )});
      if (!video) return { valid: false, reason: "missing-video" };
      return new Promise((resolve) => {
        let first = null;
        let count = 0;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve({
            ...value,
            count,
            readyState: video.readyState,
            paused: video.paused,
            width: video.videoWidth,
            height: video.videoHeight,
            error: video.error?.message ?? null,
            visible: document.visibilityState === "visible" && document.hasFocus(),
          });
        };
        const timeout = setTimeout(
          () => finish({ valid: false, reason: "callback-timeout" }),
          8000
        );
        const onFrame = (now, metadata) => {
          count += 1;
          if (!first) {
            first = { now, mediaTime: metadata.mediaTime };
            video.requestVideoFrameCallback(onFrame);
            return;
          }
          if (metadata.mediaTime > first.mediaTime) {
            finish({
              valid: true,
              first,
              second: { now, mediaTime: metadata.mediaTime },
            });
            return;
          }
          if (count < 300) video.requestVideoFrameCallback(onFrame);
          else finish({ valid: false, reason: "media-time-not-advancing" });
        };
        video.requestVideoFrameCallback(onFrame);
      });
    })()`
  );
}

async function clickAsset(page, asset) {
  await openPanel(page);
  await clearFilters(page);
  const selector = `${controlsSelector} .card[data-entry-id="${asset.id}"] [data-entry-action="use"]`;
  await waitFor(
    page,
    `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
    12000
  );
  const startedAt = await evaluate(page, "performance.now()");
  await click(page, selector);
  const currentSelector =
    asset.type === "image"
      ? ".media:not(.staged) img"
      : ".media:not(.staged) video";
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const node = root?.querySelector(${JSON.stringify(currentSelector)});
      return ${api}.state().activeId === ${JSON.stringify(asset.id)} &&
        Boolean(node) &&
        root.querySelectorAll(".media:not(.staged)").length === 1 &&
        root.querySelectorAll(".media.staged").length === 0;
    })()`
  );
  const committedAt = await evaluate(page, "performance.now()");
  return {
    startedAt,
    committedAt,
    commitMilliseconds: committedAt - startedAt,
  };
}

async function main() {
  const [portText, initialConfigPath, outputDirectory] = process.argv.slice(2);
  const port = Number(portText);
  if (!Number.isInteger(port) || !initialConfigPath || !outputDirectory)
    throw new Error(
      "Usage: node four-assets.mjs <cdp-port> <initial-config> <output-directory>"
    );

  const original = await readFile(initialConfigPath, "utf8");
  const report = {
    startedAt: new Date().toISOString(),
    port,
    expectedIdentity: candidateIdentity(),
    assets: {},
    transition: null,
  };
  const page = await openMainPageSession(port, "app://-/index.html", true);
  let changed = false;
  try {
    await ensureVisible(page);
    verifyMainFrame(await page.send("Page.getFrameTree"));
    report.identity = await evaluate(page, `${api}.identity()`);
    if (
      report.identity.runtimeHash !== report.expectedIdentity.runtimeHash ||
      report.identity.styleHash !== report.expectedIdentity.styleHash
    )
      throw new Error("Live page does not have the expected candidate");
    const current = await evaluate(
      page,
      `localStorage.getItem(${JSON.stringify(configKey)})`
    );
    if (current !== original) {
      await evaluate(
        page,
        `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(original)})`
      );
      await evaluate(page, `${api}.refresh()`);
      changed = true;
    }
    await installCounters(page);
    await openPanel(page);
    for (const asset of assets) {
      await settle(page);
      await resetCounters(page);
      const timing = await clickAsset(page, asset);
      const motion = asset.type === "video" ? await sampleMotion(page) : null;
      await settle(page);
      const counters = await readCounters(page);
      report.assets[asset.id] = {
        ...asset,
        ...timing,
        motion,
        counters,
        status: await evaluate(
          page,
          `document.querySelector(${JSON.stringify(
            `${controlsSelector} .runtime-status`
          )})?.textContent || null`
        ),
      };
    }

    await clickAsset(page, { ...transition.from, type: "video" });
    await sampleMotion(page);
    await settle(page);
    await resetCounters(page);
    const from = await evaluate(
      page,
      `Boolean(document.querySelector(${JSON.stringify(
        rootSelector + " .media:not(.staged) video"
      )}))`
    );
    const timing = await clickAsset(page, { ...transition.to, type: "video" });
    const motion = await sampleMotion(page);
    await settle(page);
    const counters = await readCounters(page);
    report.transition = {
      from: transition.from,
      to: transition.to,
      oldLayerExisted: Boolean(from),
      ...timing,
      motion,
      counters,
    };
  } catch (error) {
    report.error = String(error?.message || error);
    process.exitCode = 1;
  } finally {
    try {
      await evaluate(
        page,
        `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(original)})`
      );
      await evaluate(page, `${api}.refresh()`);
      await waitFor(
        page,
        `localStorage.getItem(${JSON.stringify(configKey)}) === ${JSON.stringify(original)} &&
          ${api}.state().state === "enabled"`,
        12000
      );
      report.restored = {
        configExact:
          (await evaluate(
            page,
            `localStorage.getItem(${JSON.stringify(configKey)})`
          )) === original,
        activeId: await evaluate(page, `${api}.state().activeId`),
        hostReady: await evaluate(page, `${api}.state().hostReady`),
      };
    } catch (error) {
      report.restoreError = String(error?.message || error);
      process.exitCode = 1;
    } finally {
      await evaluate(page, "globalThis.__task12Counters?.restore?.()").catch(
        () => {}
      );
      report.changed = changed;
      report.finishedAt = new Date().toISOString();
      await writeFile(
        `${outputDirectory}/four-assets.json`,
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
