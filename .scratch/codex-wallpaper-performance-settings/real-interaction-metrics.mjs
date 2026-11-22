import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  listPages,
  openMainPageSession,
} from "../../launcher/read-only-probe.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";
const imageId = "2817646508";
const videoId = "3787353838";

function fingerprint(value) {
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

async function waitFor(page, expression, timeoutMilliseconds = 18000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(page, expression)) return Date.now() - startedAt;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
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
  return target;
}

async function openPanel(page) {
  if (
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel].open`
      )}) !== null`
    )
  )
    return { receivesClick: true, alreadyOpen: true };
  const result = await click(
    page,
    `${controlsSelector} [data-codex-wallpaper-settings]`
  );
  await waitFor(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-panel].open`
    )}) !== null`
  );
  return result;
}

async function closePanel(page) {
  if (
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel].open`
      )}) !== null`
    )
  )
    await click(
      page,
      `${controlsSelector} [data-codex-wallpaper-panel] header button`
    );
}

async function choose(page, id, selector) {
  await evaluate(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} .card[data-entry-id="${id}"] [data-entry-action="use"]`
    )}).click()`
  );
  return waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const state = globalThis.__codexWallpaperApi.state();
      return (
        state.activeId === ${JSON.stringify(id)} &&
        Boolean(root?.querySelector(${JSON.stringify(
          `.media:not(.staged) ${selector}`
        )})) &&
        root.querySelectorAll(".media:not(.staged)").length === 1 &&
        root.querySelectorAll(".media.staged").length === 0
      );
    })()`
  );
}

async function measurePointerDrag(page, selector) {
  const target = await evaluate(
    page,
    `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const layer = document.querySelector("[data-codex-wallpaper-layer]");
    const media = layer.querySelector(".media:not(.staged)");
    const label = input.closest(".range").querySelector("output");
    input.scrollIntoView({ block: "center" });
    const rect = input.getBoundingClientRect();
    const controller = new AbortController();
    const samples = [];
    const probe = { controller, samples, media };
    globalThis.__t08PointerProbe = probe;
    input.addEventListener("input", (event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      const start = event.timeStamp;
      const value = Number(input.value);
      const sample = {
        value,
        labelMs: label.textContent === value + "%" ? performance.now() - start : null,
        previewMs: Number(layer.style.opacity) === value / 100 ? performance.now() - start : null,
      };
      samples.push(sample);
      const frame = () => document.visibilityState === "visible" &&
        Number(getComputedStyle(layer).opacity) === value / 100
        ? performance.now() - start : null;
      requestAnimationFrame(() => {
        sample.firstFrameMs = frame();
        requestAnimationFrame(() => { sample.secondFrameMs = frame(); });
      });
    }, { signal: controller.signal });
    return { left: rect.left, width: rect.width, y: rect.top + rect.height / 2 };
  })()`
  );
  const send = (type, fraction, pressed) =>
    page.send("Input.dispatchMouseEvent", {
      type,
      x: target.left + target.width * fraction,
      y: target.y,
      button: "left",
      buttons: pressed ? 1 : 0,
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
  try {
    await send("mousePressed", 0.27, true);
    try {
      for (let step = 1; step <= 24; step += 1) {
        await send("mouseMoved", 0.27 + step * 0.023, true);
        await sleep(24);
      }
    } finally {
      await send("mouseReleased", 0.822, false);
    }
    await sleep(200);
    return await evaluate(
      page,
      `(() => {
      const { samples, media } = globalThis.__t08PointerProbe;
      return {
        samples,
        sameMedia: media === document.querySelector("[data-codex-wallpaper-layer] .media:not(.staged)"),
        persistedValue: JSON.parse(localStorage.getItem(${JSON.stringify(configKey)})).settings.opacity,
      };
    })()`
    );
  } finally {
    await evaluate(
      page,
      `(() => {
      globalThis.__t08PointerProbe?.controller.abort();
      delete globalThis.__t08PointerProbe;
    })()`
    );
  }
}

async function metric(page, name) {
  const result = await page.send("Performance.getMetrics");
  return result.metrics.find((entry) => entry.name === name)?.value ?? null;
}

async function armLatency(page, selector, eventName) {
  await evaluate(
    page,
    `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    globalThis.__t08Latency = new Promise((resolve) => {
      element.addEventListener(${JSON.stringify(eventName)}, (event) => {
        const started = performance.now();
        const visible = document.visibilityState === "visible";
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({
          milliseconds: performance.now() - started,
          valid: event.isTrusted && visible && document.visibilityState === "visible"
        })));
      }, {capture: true, once: true});
    });
  })()`
  );
}

export async function runInteractionMetrics({
  port,
  initialConfigPath,
  latencyOnly,
}) {
  const initialConfig = await readFile(initialConfigPath, "utf8");
  const page = await openMainPageSession(port, "app://-/index.html", true);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await sleep(300);
  const result = {
    startedAt: new Date().toISOString(),
    initialConfigHash: fingerprint(initialConfig),
    conditions: null,
    panelLatency: [],
    keyboardLatency: [],
    persistenceWrites: null,
    failureRetention: null,
    crossWindowUpdate: null,
    pacedMediaCycles: null,
    secondaryPages: [],
  };
  let changed = false;
  try {
    const current = await evaluate(
      page,
      `localStorage.getItem(${JSON.stringify(configKey)})`
    );
    if (current !== initialConfig)
      throw new Error("The saved configuration changed since the backup");
    result.conditions = await evaluate(
      page,
      `({
        visibilityState: document.visibilityState,
        focused: document.hasFocus(),
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        theme: document.documentElement.dataset.theme || null,
        identity: globalThis.__codexWallpaperApi.identity()
      })`
    );
    if (result.conditions.visibilityState !== "visible")
      throw new Error("Interaction metrics require a visible main page");
    await page.send("Performance.enable");
    changed = true;
    await openPanel(page);
    if (latencyOnly) await choose(page, videoId, "video");
    const panelButton = `${controlsSelector} [data-codex-wallpaper-settings]`;
    const panelClose = `${controlsSelector} [data-codex-wallpaper-panel] header button`;
    await evaluate(
      page,
      `(() => {
      const list = document.querySelector("${controlsSelector} .wallpaper-list");
      globalThis.__t08CardAdditions = 0;
      globalThis.__t08CardObserver = new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          globalThis.__t08CardAdditions += Number(node.matches(".card")) + node.querySelectorAll(".card").length;
        }
      });
      globalThis.__t08CardObserver.observe(list, {childList:true, subtree:true});
    })()`
    );

    for (let index = 0; index < 11; index += 1) {
      const opening = index % 2 === 0;
      if (opening) await closePanel(page);
      const selector = opening ? panelButton : panelClose;
      await armLatency(page, selector, "click");
      await click(page, selector);
      result.panelLatency.push({
        action: opening ? "open" : "close",
        ...(await evaluate(page, "globalThis.__t08Latency")),
      });
    }
    await openPanel(page);

    const opacitySelector = `${controlsSelector} [data-setting="opacity"]`;
    await click(page, `${controlsSelector} [data-panel-page="appearance"]`);
    await evaluate(
      page,
      `(() => {
        const input = document.querySelector(${JSON.stringify(opacitySelector)});
        input.scrollIntoView({ block: "center" });
        input.value = "60";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
      })()`
    );
    const opacityBefore = await evaluate(
      page,
      `Number(document.querySelector(${JSON.stringify(opacitySelector)}).value)`
    );
    result.sliderFocused = await evaluate(
      page,
      `document.activeElement === document.querySelector(${JSON.stringify(opacitySelector)})`
    );
    for (let index = 0; index < 30; index += 1) {
      await armLatency(page, opacitySelector, "keydown");
      await page.send("Input.dispatchKeyEvent", {
        type: "rawKeyDown",
        key: "ArrowRight",
        code: "ArrowRight",
        windowsVirtualKeyCode: 39,
      });
      await page.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "ArrowRight",
        code: "ArrowRight",
        windowsVirtualKeyCode: 39,
      });
      result.keyboardLatency.push(
        await evaluate(page, "globalThis.__t08Latency")
      );
    }
    const opacityAfter = await evaluate(
      page,
      `Number(document.querySelector(${JSON.stringify(opacitySelector)}).value)`
    );
    result.keyboardRange = { opacityBefore, opacityAfter };
    result.pointerDrag = await measurePointerDrag(page, opacitySelector);
    result.wallpaperCardsAdded = await evaluate(
      page,
      "globalThis.__t08CardAdditions"
    );
    if (latencyOnly) return result;

    const writes = await evaluate(
      page,
      `(async () => {
        const original = Storage.prototype.setItem;
        let writes = 0;
        Storage.prototype.setItem = function(key, value) {
          if (key === ${JSON.stringify(configKey)}) writes += 1;
          return original.call(this, key, value);
        };
        try {
          const input = document.querySelector(${JSON.stringify(opacitySelector)});
          for (let value = 60; value <= 89; value += 1) {
            input.value = String(value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
          input.dispatchEvent(new Event("change", { bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 180));
          input.blur();
          await new Promise((resolve) => setTimeout(resolve, 40));
          return {
            writes,
            finalValue: Number(input.value),
            persistedValue: Number(JSON.parse(
              localStorage.getItem(${JSON.stringify(configKey)})
            ).settings.opacity)
          };
        } finally {
          Storage.prototype.setItem = original;
        }
      })()`
    );
    await closePanel(page);
    await openPanel(page);
    writes.reopenedValue = await evaluate(
      page,
      `Number(document.querySelector(${JSON.stringify(opacitySelector)}).value)`
    );
    result.persistenceWrites = writes;

    await choose(page, imageId, "img");
    const retainedMarker = await evaluate(
      page,
      `(() => {
        const media = document.querySelector(${JSON.stringify(
          `${rootSelector} .media:not(.staged)`
        )});
        const marker = crypto.randomUUID();
        media.dataset.t08FailureMarker = marker;
        return marker;
      })()`
    );
    const failure = await evaluate(
      page,
      `(async () => {
        const api = globalThis.__codexWallpaperApi;
        const originalHost = globalThis.__codexWallpaperHostRequest;
        globalThis.__codexWallpaperHostRequest = (raw) => {
          const request = JSON.parse(raw);
          if (request.type === "load-asset") {
            queueMicrotask(() => api.receiveAssetError(
              request.id,
              "T08 injected host failure"
            ));
            return;
          }
          originalHost?.(raw);
        };
        try {
          document.querySelector(${JSON.stringify(
            `${controlsSelector} .card[data-entry-id="1266437175"] [data-entry-action="use"]`
          )}).click();
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const status = document.querySelector(${JSON.stringify(
              `${controlsSelector} .runtime-status`
            )})?.textContent || "";
            if (status.includes("素材加载失败")) break;
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          const media = document.querySelector(${JSON.stringify(
            `${rootSelector} .media:not(.staged)`
          )});
          return {
            activeId: api.state().activeId,
            retainedMarker:
              media?.dataset.t08FailureMarker === ${JSON.stringify(
                retainedMarker
              )},
            mediaCount: document.querySelectorAll(${JSON.stringify(
              `${rootSelector} .media:not(.staged)`
            )}).length,
            stagedCount: document.querySelectorAll(${JSON.stringify(
              `${rootSelector} .media.staged`
            )}).length,
            status: document.querySelector(${JSON.stringify(
              `${controlsSelector} .runtime-status`
            )})?.textContent || null
          };
        } finally {
          globalThis.__codexWallpaperHostRequest = originalHost;
        }
      })()`
    );
    result.failureRetention = failure;

    await choose(page, imageId, "img");
    const beforeSync = await evaluate(
      page,
      `(() => {
        const media = document.querySelector(${JSON.stringify(
          `${rootSelector} .media:not(.staged)`
        )});
        const panel = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel]`
        )});
        const card = panel.querySelector(${JSON.stringify(
          `.card[data-entry-id="${imageId}"]`
        )});
        media.dataset.t08SyncMarker = crypto.randomUUID();
        card.dataset.t08SyncMarker = crypto.randomUUID();
        return {
          media: media.dataset.t08SyncMarker,
          card: card.dataset.t08SyncMarker,
          cards: panel.querySelectorAll(".card").length
        };
      })()`
    );
    const targets = (await listPages(port)).filter(
      (target) =>
        target.type === "page" &&
        [
          "app://-/index.html?initialRoute=%2Favatar-overlay",
          "app://-/detached-window.html?initialRoute=%2Fdetached-window",
        ].includes(target.url)
    );
    const sourcePage = targets.find(({ url }) =>
      url.includes("detached-window")
    );
    let syncMode = "simulated storage event";
    let sender = page;
    if (sourcePage) {
      const auxiliary = await openMainPageSession(port, sourcePage.url, true);
      const sharesSettings = await evaluate(
        auxiliary,
        `Boolean(localStorage.getItem(${JSON.stringify(configKey)}))`
      ).catch(() => false);
      if (sharesSettings) {
        sender = auxiliary;
        syncMode = "native storage event from existing detached page";
      } else auxiliary.close();
    }
    try {
      await evaluate(
        sender,
        `(() => {
        const previous = localStorage.getItem(${JSON.stringify(configKey)});
        const next = JSON.parse(previous);
        if (!next || next.settings.opacity !== 89) throw new Error("Unexpected storage state");
        next.settings.opacity = 66;
        next.settings.volume = 3;
        next.favorites = [...next.favorites, { kind: "workshop", id: ${JSON.stringify(
          imageId
        )} }].filter((item, index, all) =>
          all.findIndex((candidate) => candidate.kind === item.kind && candidate.id === item.id) === index
        );
        const serialized = JSON.stringify(next);
        localStorage.setItem(${JSON.stringify(configKey)}, serialized);
        if (${sender === page}) dispatchEvent(new StorageEvent("storage", {
          key: ${JSON.stringify(configKey)},
          oldValue: previous,
          newValue: serialized,
          storageArea: localStorage
        }));
      })()`
      );
    } finally {
      if (sender !== page) sender.close();
    }
    await waitFor(
      page,
      `document.querySelector(${JSON.stringify(opacitySelector)}).value === "66"`,
      5000
    );
    result.crossWindowUpdate = await evaluate(
      page,
      `(() => {
        const media = document.querySelector(${JSON.stringify(
          `${rootSelector} .media:not(.staged)`
        )});
        const panel = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel]`
        )});
        const card = panel.querySelector(${JSON.stringify(
          `.card[data-entry-id="${imageId}"]`
        )});
        return {
          mode: ${JSON.stringify(syncMode)},
          opacityApplied: Number(document.querySelector(${JSON.stringify(opacitySelector)}).value),
          mediaSame: media?.dataset.t08SyncMarker === ${JSON.stringify(
            beforeSync.media
          )},
          cardsSame: card?.dataset.t08SyncMarker === ${JSON.stringify(
            beforeSync.card
          )},
          cardCountBefore: ${beforeSync.cards},
          cardCountAfter: panel.querySelectorAll(".card").length,
          stagedCount: document.querySelectorAll(${JSON.stringify(
            `${rootSelector} .media.staged`
          )}).length
        };
      })()`
    );

    await closePanel(page);
    await choose(page, videoId, "video");
    const heapStart = await metric(page, "JSHeapUsedSize");
    const cycleEndpoints = [];
    for (let index = 0; index < 10; index += 1) {
      const imageMilliseconds = await choose(page, imageId, "img");
      const videoMilliseconds = await choose(page, videoId, "video");
      const endpoint = await evaluate(
        page,
        `({
          activeId: globalThis.__codexWallpaperApi.state().activeId,
          mediaCount: document.querySelectorAll(${JSON.stringify(
            `${rootSelector} .media:not(.staged)`
          )}).length,
          stagedCount: document.querySelectorAll(${JSON.stringify(
            `${rootSelector} .media.staged`
          )}).length,
          players: globalThis.__codexWallpaperApi.state().playerCount
        })`
      );
      cycleEndpoints.push({
        index: index + 1,
        imageMilliseconds,
        videoMilliseconds,
        ...endpoint,
        heap: await metric(page, "JSHeapUsedSize"),
      });
    }
    const heapEnd = await metric(page, "JSHeapUsedSize");
    result.pacedMediaCycles = {
      cycles: 10,
      heapStart,
      heapEnd,
      heapDelta: heapEnd - heapStart,
      endpoints: cycleEndpoints,
    };
    await page.send("Performance.disable");

    for (const target of targets) {
      const auxiliary = await openMainPageSession(port, target.url, true);
      try {
        result.secondaryPages.push({
          route: new URL(target.url).searchParams.get("initialRoute"),
          ...(await evaluate(
            auxiliary,
            `({
            adapterLoaded: Boolean(globalThis.__codexWallpaperApi),
            playerCount: document.querySelectorAll("#codex-wallpaper-p1 video,#codex-wallpaper-p1 canvas,#codex-wallpaper-p1 iframe").length
          })`
          )),
        });
      } finally {
        auxiliary.close();
      }
    }
    result.completedAt = new Date().toISOString();
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  } finally {
    await page.send("Performance.disable").catch(() => {});
    try {
      if (changed) {
        await evaluate(
          page,
          `(() => {
          globalThis.__t08CardObserver?.disconnect();
          delete globalThis.__t08CardObserver;
          delete globalThis.__t08CardAdditions;
          delete globalThis.__t08Latency;
          document.querySelector("${controlsSelector} [data-codex-wallpaper-panel]")?.classList.remove("open");
          document.activeElement?.blur();
        })()`
        );
        await evaluate(
          page,
          `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(initialConfig)})`
        );
        await evaluate(page, "globalThis.__codexWallpaperApi.refresh()");
      }
    } finally {
      page.close();
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const [portValue, initialConfigPath, outputPath, mode] =
    process.argv.slice(2);
  const port = Number(portValue);
  if (!Number.isInteger(port) || !initialConfigPath || !outputPath) {
    console.error(
      "Usage: node real-interaction-metrics.mjs <cdp-port> <initial-config> <output-json>"
    );
    process.exit(1);
  }
  const result = await runInteractionMetrics({
    port,
    initialConfigPath,
    latencyOnly: mode === "latency",
  });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (result.error) process.exitCode = 1;
}
