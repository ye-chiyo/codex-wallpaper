import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  openMainPageSession,
  verifyMainFrame,
} from "../../../launcher/read-only-probe.mjs";
import {
  candidateIdentity,
  runtimeSource,
} from "../../../launcher/client-runtime.mjs";
import { payloadFor } from "../../../launcher/static-background.mjs";
import { prepareMp4VirtualLayout } from "../../../launcher/mp4-layout.mjs";
import { prepareWallpaperAsset } from "../../../launcher/wallpaper-library.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";
const api = "globalThis.__codexWallpaperApi";
const imageId = "2817646508";
const frontMoovId = "1791074903";
const tailMoovId = "1986730797";
const missingId = "missing-live-probe";

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

async function waitFor(page, expression, timeoutMilliseconds = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(page, expression)) return Date.now() - startedAt;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function clickSelector(page, selector, move = true, settle = 0) {
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
        disabled: Boolean(control.disabled),
      };
    })()`
  );
  if (!target) throw new Error(`Missing click target ${selector}`);
  if (!target.receivesClick || target.disabled)
    throw new Error(`Target is not interactive: ${selector}`);
  if (move)
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: target.x,
      y: target.y,
      button: "none",
      clickCount: 0,
    });
  if (settle) await sleep(settle);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.send("Input.dispatchMouseEvent", {
      type,
      x: target.x,
      y: target.y,
      button: "left",
      clickCount: 1,
    });
  }
  return target;
}

async function openPanel(page) {
  const open = await evaluate(
    page,
    `Boolean(document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-panel].open`
    )}))`
  );
  if (!open)
    await clickSelector(
      page,
      `${controlsSelector} [data-codex-wallpaper-settings]`
    );
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
      const search = controls.querySelector("[data-library-search]");
      if (search) {
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const type = controls.querySelector("[data-library-type]");
      if (type) {
        type.value = "all";
        type.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const favorites = controls.querySelector("[data-library-favorites]");
      if (favorites) {
        favorites.checked = false;
        favorites.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`
  );
}

async function setConfig(page, raw) {
  await evaluate(
    page,
    `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(raw)})`
  );
  await evaluate(page, `${api}.refresh()`);
}

async function startProbe(page, traceHandoff = false, traceFeedback = false) {
  await evaluate(
    page,
    `(() => {
      const api = ${api};
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const listeners = new AbortController();
      const probe = globalThis.__liveSwitchProbe = {
        events: [],
        click: null,
        selectedAt: null,
        feedbackAt: null,
        committedAt: null,
        dynamic: null,
        warm: null,
        baseMedia: document.querySelector(
          ${JSON.stringify(rootSelector)} + " .media:not(.staged)"
        ),
        transfer: { file: 0, base64: 0, finished: 0, failed: 0 },
        native: {},
      };
      const record = (type, detail = null) => probe.events.push({
        type,
        at: performance.now(),
        detail,
      });
      const timings = [];
      const observers = [];
      if (${traceFeedback}) {
        for (const type of ["event", "long-animation-frame"]) {
          if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "event" && entry.name !== "click") continue;
              timings.push({
                type, start: entry.startTime, duration: entry.duration,
                processingStart: entry.processingStart, processingEnd: entry.processingEnd,
                renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart,
                scripts: entry.scripts?.map(({ duration, invokerType }) => ({ duration, invokerType })),
              });
            }
          });
          observer.observe({ type, durationThreshold: 16 });
          observers.push(observer);
        }
        probe.timings = timings;
      }
      const nativeRequestFrame = HTMLVideoElement.prototype.requestVideoFrameCallback;
      if (${traceHandoff}) {
        HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) {
          if (!this.matches(${JSON.stringify(rootSelector + " .media.staged video")}))
            return nativeRequestFrame.call(this, callback);
          const sample = () => ({
            width: this.videoWidth, height: this.videoHeight,
            readyState: this.readyState, mediaTime: this.currentTime,
          });
          const events = probe.events;
          record("handoff-frame-request", sample());
          return nativeRequestFrame.call(this, (now, metadata) => {
            if (events === probe.events)
              record("handoff-frame-delivered", { ...sample(), presented: metadata.presentedFrames });
            callback(now, metadata);
          });
        };
        for (const type of ["loadedmetadata", "loadeddata", "playing", "error"]) {
          root.addEventListener(type, (event) => {
            const video = event.target;
            if (video.matches?.(".media.staged video"))
              record("handoff-" + type, { readyState: video.readyState, width: video.videoWidth });
          }, { capture: true, signal: listeners.signal });
        }
      }
      const original = {
        beginAssetFileTransfer: api.beginAssetFileTransfer,
        finishAssetFileTransfer: api.finishAssetFileTransfer,
        appendAssetTransferChunk: api.appendAssetTransferChunk,
        receiveAssetError: api.receiveAssetError,
        receiveWarmError: api.receiveWarmError,
      };
      api.beginAssetFileTransfer = function (...args) {
        probe.transfer.file += 1;
        record("file-transfer-begin");
        return original.beginAssetFileTransfer.apply(this, args);
      };
      api.finishAssetFileTransfer = function (...args) {
        probe.transfer.finished += 1;
        record("file-transfer-finish");
        return original.finishAssetFileTransfer.apply(this, args);
      };
      api.appendAssetTransferChunk = function (...args) {
        probe.transfer.base64 += 1;
        record("base64-transfer");
        return original.appendAssetTransferChunk.apply(this, args);
      };
      for (const method of ["receiveAssetError", "receiveWarmError"].filter(
        (method) => typeof original[method] === "function"
      )) {
        api[method] = function (id) {
          probe.transfer.failed += 1;
          record(method, { id });
          return original[method].apply(this, arguments);
        };
      }
      const idOf = (element) => {
        const button = element?.closest?.("[data-entry-action='use']");
        return button?.closest(".card")?.dataset.entryId || null;
      };
      document.addEventListener("pointerdown", (event) => {
        const id = idOf(event.target);
        if (id && event.isTrusted) {
          probe.click = { id, at: event.timeStamp || performance.now(), trusted: true };
          probe.selectedAt = null;
          probe.feedbackAt = null;
          probe.committedAt = null;
          probe.dynamic = null;
          probe.baseMedia = document.querySelector(
            ${JSON.stringify(rootSelector)} + " .media:not(.staged)"
          );
          record("pointerdown", { id });
        }
      }, { capture: true, signal: listeners.signal });
      document.addEventListener("click", (event) => {
        const id = idOf(event.target);
        if (id && (event.isTrusted || ${traceFeedback})) {
          const click = probe.click = { id, downAt: probe.click?.at, at: event.timeStamp, trusted: event.isTrusted };
          record("click", { id, inputDelay: performance.now() - click.at });
          if (${traceFeedback} && probe.trace && probe.experimentFor === id)
            console.timeStamp("wallpaper-feedback-click");
          requestAnimationFrame(() => {
            const card = document.querySelector(
              ${JSON.stringify(controlsSelector)} +
              " .card[data-entry-kind='workshop'][data-entry-id='" + probe.click.id + "']"
            );
            if (probe.click === click && card?.dataset.selected === "true" &&
                card.querySelector(".card-current")?.hidden === false && probe.feedbackAt === null) {
              probe.feedbackAt = performance.now();
              record("selected-feedback-frame", { id: probe.click.id });
              if (${traceFeedback} && probe.trace && probe.experimentFor === id)
                console.timeStamp("wallpaper-feedback-frame");
            }
          });
        }
      }, { capture: true, signal: listeners.signal });
      const selectedObserver = new MutationObserver(() => {
        const id = probe.click?.id;
        if (!id || probe.selectedAt !== null) return;
        const card = document.querySelector(
          ${JSON.stringify(controlsSelector)} +
          " .card[data-entry-kind='workshop'][data-entry-id='" + id + "']"
        );
        if (card?.dataset.selected === "true") {
          probe.selectedAt = performance.now();
          record("selected", { id });
        }
      });
      selectedObserver.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-selected"],
      });
      const mediaObserver = new MutationObserver(() => {
        const current = document.querySelector(
          ${JSON.stringify(rootSelector)} + " .media:not(.staged)"
        );
        if (current && current !== probe.baseMedia && !probe.committedAt && probe.click) {
          const video = current.querySelector("video");
          const image = current.querySelector("img");
          probe.committedAt = performance.now();
          probe.native = {
            tag: video ? "video" : image ? "img" : current.className,
            readyState: video?.readyState ?? null,
            paused: video?.paused ?? null,
            width: video?.videoWidth ?? image?.naturalWidth ?? null,
            height: video?.videoHeight ?? image?.naturalHeight ?? null,
          };
          record("media-committed", probe.native);
          if (video) {
            const click = probe.click;
            let first = null;
            let callbackCount = 0;
            const onFrame = (now, metadata) => {
              if (probe.click !== click || !video.isConnected) return;
              callbackCount += 1;
              if (!first) {
                first = { at: now, mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames };
                video.requestVideoFrameCallback(onFrame);
                return;
              }
              if (metadata.mediaTime > first.mediaTime) {
                probe.dynamic = {
                  at: now,
                  elapsed: now - click.at,
                  first,
                  second: { at: now, mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames },
                  readyState: video.readyState,
                  paused: video.paused,
                  visible: document.visibilityState === "visible" && document.hasFocus(),
                  width: video.videoWidth,
                  height: video.videoHeight,
                  callbackCount,
                };
                record("dynamic-frame", probe.dynamic);
              } else {
                video.requestVideoFrameCallback(onFrame);
              }
            };
            video.requestVideoFrameCallback(onFrame);
          }
        }
      });
      mediaObserver.observe(root, { subtree: true, childList: true, attributes: true });
      const warmObserver = new MutationObserver(() => {
        const node = document.querySelector(
          ${JSON.stringify(rootSelector)} + " video[data-codex-wallpaper-warm]"
        );
        if (!node || probe.warm) return;
        probe.warm = {
          seenAt: performance.now(),
          id: node.dataset.codexWallpaperWarm,
          preload: node.preload,
          srcPrefix: String(node.src || "").split(":", 1)[0] || null,
          readyState: node.readyState,
          networkState: node.networkState,
          error: null,
          loadedMetadata: false,
        };
        node.addEventListener(
          "loadedmetadata",
          () => {
            if (probe.warm) probe.warm.loadedMetadata = true;
          },
          { once: true }
        );
        node.addEventListener(
          "error",
          () => {
            if (probe.warm) probe.warm.error = node.error?.code || "media-error";
          },
          { once: true }
        );
      });
      warmObserver.observe(root, { subtree: true, childList: true });
      probe.cleanup = () => {
        listeners.abort();
        for (const observer of observers) observer.disconnect();
        if (${traceHandoff}) {
          HTMLVideoElement.prototype.requestVideoFrameCallback = nativeRequestFrame;
          document.querySelector("#live-wallpaper-handoff-opacity")?.remove();
        }
        probe.click = null;
        selectedObserver.disconnect();
        mediaObserver.disconnect();
        warmObserver.disconnect();
        api.beginAssetFileTransfer = original.beginAssetFileTransfer;
        api.finishAssetFileTransfer = original.finishAssetFileTransfer;
        api.appendAssetTransferChunk = original.appendAssetTransferChunk;
        api.receiveAssetError = original.receiveAssetError;
        if (original.receiveWarmError) api.receiveWarmError = original.receiveWarmError;
        delete globalThis.__liveSwitchProbe;
      };
      return true;
    })()`
  );
}

async function hoverWarm(page, cardSelector, awaitMetadata = true) {
  const target = await evaluate(
    page,
    `(() => {
      const card = document.querySelector(${JSON.stringify(cardSelector)});
      if (!card) return null;
      card.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = card.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`
  );
  if (!target) throw new Error("Warm target is missing");
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: target.x,
    y: target.y,
    button: "none",
    clickCount: 0,
  });
  const hit = await evaluate(
    page,
    `(() => {
      const card = document.querySelector(${JSON.stringify(cardSelector)});
      const rect = card?.getBoundingClientRect();
      if (!rect) return false;
      const node = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return Boolean(node && (node === card || card.contains(node)));
    })()`
  );
  if (!hit) throw new Error("Warm target did not receive the pointer");
  if (!awaitMetadata) return;
  await waitFor(
    page,
    "Boolean(globalThis.__liveSwitchProbe?.warm?.loadedMetadata || globalThis.__liveSwitchProbe?.warm?.error)",
    2500
  );
  const result = await evaluate(
    page,
    `(() => {
      const observed = globalThis.__liveSwitchProbe?.warm || null;
      const nodes = [...document.querySelectorAll(${JSON.stringify(
        `${rootSelector} video[data-codex-wallpaper-warm]`
      )})];
      return {
        observed,
        count: nodes.length,
        items: nodes.map((node) => ({
          id: node.dataset.codexWallpaperWarm,
          preload: node.preload,
          srcPrefix: String(node.src || "").split(":", 1)[0] || null,
          readyState: node.readyState,
          networkState: node.networkState,
          error: node.error?.code || null,
          paused: node.paused,
        })),
      };
    })()`
  );
  return result;
}

async function readResult(page, targetId, startedAt) {
  return evaluate(
    page,
    `(() => {
      const probe = globalThis.__liveSwitchProbe;
      const state = ${api}.state();
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const video = root?.querySelector(".media:not(.staged) video");
      const pendingVideo = root?.querySelector(".media.staged video");
      const selected = document.querySelector(${JSON.stringify(
        `${controlsSelector} .card[data-entry-id="${targetId}"]`
      )})?.dataset.selected;
      return {
        targetId: ${JSON.stringify(targetId)},
        wallMilliseconds: performance.now() - ${startedAt},
        state: { activeId: state.activeId, state: state.state, playerCount: state.playerCount },
        selected,
        status: document.querySelector("${controlsSelector} .runtime-status")?.textContent ?? null,
        fileInputs: root?.querySelectorAll("[data-codex-wallpaper-file]").length ?? 0,
        staged: root?.querySelectorAll(".media.staged").length ?? 0,
        pendingMedia: pendingVideo ? {
          readyState: pendingVideo.readyState, paused: pendingVideo.paused,
          currentTime: pendingVideo.currentTime, width: pendingVideo.videoWidth, height: pendingVideo.videoHeight,
          decoded: pendingVideo.getVideoPlaybackQuality().totalVideoFrames,
          srcProtocol: String(pendingVideo.src).split(":", 1)[0],
          error: pendingVideo.error?.code ?? null, opacity: getComputedStyle(pendingVideo.parentElement).opacity,
          focus: document.hasFocus(),
        } : null,
        click: probe?.click,
        selectedMilliseconds: probe?.selectedAt != null && probe.click
          ? probe.selectedAt - probe.click.at : null,
        feedbackMilliseconds: probe?.feedbackAt != null && probe.click
          ? probe.feedbackAt - probe.click.at : null,
        committedMilliseconds: probe?.committedAt != null && probe.click
          ? probe.committedAt - probe.click.at : null,
        dynamic: probe?.dynamic,
        native: probe?.native,
        warm: probe?.warm,
        transfer: probe?.transfer,
        events: probe?.events || [],
        media: {
          tag: video ? "video" : root?.querySelector(".media:not(.staged) img") ? "img" : null,
          readyState: video?.readyState ?? null,
          paused: video?.paused ?? null,
          width: video?.videoWidth ?? null,
          height: video?.videoHeight ?? null,
          currentTime: video?.currentTime ?? null,
          visibility: document.visibilityState,
        },
      };
    })()`
  );
}

async function resetProbe(page) {
  await evaluate(
    page,
    `(() => {
      const probe = globalThis.__liveSwitchProbe;
      if (!probe) return;
      probe.click = null;
      probe.selectedAt = null;
      probe.feedbackAt = null;
      probe.committedAt = null;
      probe.dynamic = null;
      probe.warm = null;
      probe.baseMedia = document.querySelector(
        ${JSON.stringify(rootSelector)} + " .media:not(.staged)"
      );
      probe.events = [];
      probe.transfer = { file: 0, base64: 0, finished: 0, failed: 0 };
      probe.native = {};
    })()`
  );
}

async function runSelect(
  page,
  selector,
  targetId,
  { video = false, timeout = 6500, prewarm = false } = {}
) {
  await resetProbe(page);
  let hover = null;
  if (prewarm)
    hover = await hoverWarm(
      page,
      selector.replace(/ \[data-entry-action.*$/, "")
    );
  const startedAt = await evaluate(page, "performance.now()");
  await clickSelector(page, selector, !video || !prewarm);
  await waitFor(
    page,
    `(() => {
      const state = ${api}.state();
      return state.activeId === ${JSON.stringify(targetId)} &&
        Boolean(globalThis.__liveSwitchProbe?.committedAt);
    })()`,
    timeout
  );
  if (video)
    await waitFor(
      page,
      `Boolean(globalThis.__liveSwitchProbe?.dynamic || globalThis.__liveSwitchProbe?.native?.tag !== "video")`,
      4000
    );
  await sleep(50);
  return { ...(await readResult(page, targetId, startedAt)), hover };
}

async function switchToImage(page) {
  const selector = `${controlsSelector} .card[data-entry-id="${imageId}"] [data-entry-action="use"]`;
  if (
    !(await evaluate(
      page,
      `${api}.state().activeId === ${JSON.stringify(imageId)}`
    ))
  )
    await runSelect(page, selector, imageId);
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const img = root?.querySelector(".media:not(.staged) img");
      return Boolean(img && img.complete && img.naturalWidth > 0 && root.querySelectorAll(".media.staged").length === 0);
    })()`
  );
}

function addSelectMetrics(report, label, raw) {
  const selected = raw.selectedMilliseconds;
  const committed = raw.committedMilliseconds;
  const dynamic = raw.dynamic;
  report.switches[label] = {
    click: raw.click,
    events: raw.events,
    selectedId: raw.state.activeId,
    selectedMilliseconds: selected,
    feedbackMilliseconds: raw.feedbackMilliseconds,
    committedMilliseconds: committed,
    dynamicMilliseconds: dynamic?.elapsed ?? null,
    dynamicValid: Boolean(
      dynamic &&
      dynamic.visible &&
      !dynamic.paused &&
      dynamic.readyState >= 2 &&
      dynamic.second.mediaTime > dynamic.first.mediaTime &&
      dynamic.width > 0 &&
      dynamic.height > 0
    ),
    dynamic: dynamic
      ? {
          firstMediaTime: dynamic.first.mediaTime,
          secondMediaTime: dynamic.second.mediaTime,
          presentedFrames: dynamic.second.presentedFrames,
          readyState: dynamic.readyState,
          paused: dynamic.paused,
          visible: dynamic.visible,
          width: dynamic.width,
          height: dynamic.height,
        }
      : null,
    native: raw.native,
    transfer: raw.transfer,
    media: raw.media,
  };
}

async function replaceRuntime(page, source) {
  await evaluate(
    page,
    `(async () => {
    await ${api}?.discardStartup();
    return await ${source};
  })()`
  );
}

function processSample() {
  const ids = process.env.WALLPAPER_MEASURE_PIDS ?? "";
  if (!/^\d+(,\d+)*$/.test(ids))
    throw new Error("Missing measured process IDs");
  return JSON.parse(
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `@{at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(); processes=@(Get-Process -Id ${ids} -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet64, PrivateMemorySize64)} | ConvertTo-Json -Compress`,
      ],
      { encoding: "utf8", windowsHide: true }
    )
  );
}

async function interactionSample(page) {
  const setup = await evaluate(
    page,
    `(() => {
    const visible = (selector) => [...document.querySelectorAll(selector)].find((element) =>
      element.getBoundingClientRect().width > 0);
    const editor = visible(".ProseMirror[contenteditable=true]");
    const chatScroll = visible("[data-app-action-timeline-scroll]");
    const scroll = chatScroll && chatScroll.scrollHeight > chatScroll.clientHeight
      ? chatScroll : visible("[data-app-action-sidebar-scroll]");
    if (!editor || !scroll || scroll.scrollHeight <= scroll.clientHeight || !document.hasFocus())
      return null;
    const origin = scroll.scrollTop;
    const focus = document.activeElement;
    const selection = document.getSelection();
    const priorSelection = [
      selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset,
    ];
    const caretOnly = Boolean(editor.innerText.trim());
    const draft = editor.innerText;
    const textNodes = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let caretText = null;
    if (caretOnly) {
      while ((caretText = textNodes.nextNode()) && caretText.length < 3) {}
      if (!caretText) return null;
    }
    const listeners = new AbortController();
    const options = { capture: true, passive: true, signal: listeners.signal };
    const probe = globalThis.__wallpaperInteraction = { input: [], wheel: [] };
    probe.draftUnchanged = () => editor.innerText === draft;
    probe.prepareWheel = () => {
      wheel = null;
      const extent = scroll.scrollHeight - scroll.clientHeight;
      scroll.scrollTop = extent / 2;
      const box = scroll.getBoundingClientRect();
      const y = box.top + box.height / 2;
      const x = [box.right - 18, box.left + 14, box.left + box.width / 2].find((x) => {
        const hit = document.elementFromPoint(x, y);
        if (!scroll.contains(hit)) return false;
        for (let node = hit; node && node !== scroll; node = node.parentElement)
          if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY))
            return false;
        return true;
      });
      return x == null || extent < 8 ? null : { x, y, delta: Math.min(64, Math.floor(extent / 4)) };
    };
    let wheel;
    let caretInput;
    const painted = (event, sink) => {
      requestAnimationFrame(() => requestAnimationFrame((now) => sink.push(now - event.timeStamp)));
    };
    editor.addEventListener("input", (event) => {
      if (!caretOnly && event.isTrusted && event.inputType === "insertText") painted(event, probe.input);
    }, options);
    if (caretOnly) {
      editor.addEventListener("keydown", (event) => {
        if (event.isTrusted && (event.key === "ArrowLeft" || event.key === "ArrowRight"))
          caretInput = { event, from: selection.anchorOffset };
      }, options);
      document.addEventListener("selectionchange", () => {
        if (caretInput && selection.anchorNode === caretText && selection.anchorOffset !== caretInput.from) {
          painted(caretInput.event, probe.input);
          caretInput = null;
        }
      }, options);
    }
    addEventListener("wheel", (event) => {
      if (event.isTrusted && scroll.contains(event.target)) wheel = event;
    }, options);
    scroll.addEventListener("scroll", () => {
      if (!wheel) return;
      painted(wheel, probe.wheel);
      wheel = null;
    }, options);
    probe.cleanup = () => {
      listeners.abort();
      scroll.scrollTop = origin;
      focus?.focus?.({ preventScroll: true });
      if (priorSelection[0]?.isConnected && priorSelection[2]?.isConnected)
        selection.setBaseAndExtent(...priorSelection);
      delete globalThis.__wallpaperInteraction;
    };
    editor.focus({ preventScroll: true });
    if (caretOnly) selection.collapse(caretText, 2);
    return {
      caretOnly,
      scrollArea: scroll === chatScroll ? "conversation" : "sidebar",
    };
  })()`
  );
  if (!setup)
    return {
      skipped:
        "Requires a visible composer, scrollable chat, and foreground focus",
    };
  const samples = 16;
  let wheelCount = 0;
  let scrollMisses = 0;
  let inserted = false;
  const eraseProbeText = async () => {
    for (const type of ["rawKeyDown", "keyUp"]) {
      await page.send("Input.dispatchKeyEvent", {
        type,
        key: "Backspace",
        code: "Backspace",
        windowsVirtualKeyCode: 8,
      });
    }
    inserted = false;
  };
  const ownText = () =>
    evaluate(
      page,
      `document.activeElement.matches(".ProseMirror[contenteditable=true]") && document.activeElement.innerText.trim() === "x"`
    );
  try {
    for (let index = 0; index < samples; index += 1) {
      const safe = await evaluate(
        page,
        `document.hasFocus() &&
        document.activeElement.matches(".ProseMirror[contenteditable=true]") &&
        (${setup.caretOnly} || !document.activeElement.innerText.trim())`
      );
      if (!safe)
        throw new Error("The composer is unavailable for the input sample");
      if (setup.caretOnly) {
        const key = index % 2 ? "ArrowRight" : "ArrowLeft";
        for (const type of ["rawKeyDown", "keyUp"])
          await page.send("Input.dispatchKeyEvent", {
            type,
            key,
            code: key,
            windowsVirtualKeyCode: index % 2 ? 39 : 37,
          });
      } else {
        await page.send("Input.insertText", { text: "x" });
        inserted = true;
      }
      await waitFor(
        page,
        `globalThis.__wallpaperInteraction.input.length === ${index + 1}`
      );
      if (!setup.caretOnly) {
        if (!(await ownText())) throw new Error("Unexpected composer contents");
        await eraseProbeText();
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const point = await evaluate(
          page,
          `new Promise((resolve) => {
          const point = globalThis.__wallpaperInteraction.prepareWheel();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(point)));
        })`
        );
        if (!point) break;
        await page.send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x: point.x,
          y: point.y,
          deltaX: 0,
          deltaY: (index + attempt) % 2 ? -point.delta : point.delta,
        });
        const next = await waitFor(
          page,
          `globalThis.__wallpaperInteraction.wheel.length > ${wheelCount}`,
          650
        ).then(
          () => true,
          () => false
        );
        if (next) {
          wheelCount = await evaluate(
            page,
            "globalThis.__wallpaperInteraction.wheel.length"
          );
          break;
        }
        scrollMisses += 1;
      }
    }
    return await evaluate(
      page,
      `(() => {
      const { input, wheel, draftUnchanged } = globalThis.__wallpaperInteraction;
      return {
        input, wheel, draftUnchanged: draftUnchanged(),
        scrollMisses: ${scrollMisses},
        inputMode: "${setup.caretOnly ? "caret" : "insertText"}",
        scrollArea: "${setup.scrollArea}",
      };
    })()`
    );
  } finally {
    if (inserted && (await ownText())) await eraseProbeText();
    await evaluate(page, `globalThis.__wallpaperInteraction?.cleanup()`);
  }
}

async function captureMotion(page, directory, id) {
  await mkdir(directory, { recursive: true });
  const clip = await evaluate(
    page,
    `({
    x: innerWidth - 186, y: 215, width: 162, height: 245, scale: 1
  })`
  );
  const sequence = [];
  for (let index = 0; index < 12; index += 1) {
    const state = await evaluate(
      page,
      `(() => {
      const video = document.querySelector("#codex-wallpaper-p1 .media:not(.staged) video");
      return {
        at: performance.now(), mediaTime: video?.currentTime,
        readyState: video?.readyState, paused: video?.paused,
        visible: document.visibilityState === "visible" && document.hasFocus(),
      };
    })()`
    );
    if (!state.visible || state.paused !== false || state.readyState < 2)
      throw new Error("Motion capture lost foreground playback");
    const { data } = await page.send("Page.captureScreenshot", {
      format: "png",
      clip,
      fromSurface: true,
    });
    await writeFile(
      join(directory, `${id}-${String(index).padStart(2, "0")}.png`),
      Buffer.from(data, "base64")
    );
    sequence.push(state);
    await sleep(85);
  }
  return { clip, sequence };
}

async function main() {
  const [portText, output, configBackup, mode] = process.argv.slice(2);
  const port = Number(portText);
  if (!Number.isInteger(port) || !output || !configBackup)
    throw new Error(
      "Usage: node 20261119-live-switch-probe.mjs <port> <output.json> <config-backup.json>"
    );

  const page = await openMainPageSession(port, "app://-/index.html", true);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await sleep(300);
  const report = {
    startedAt: new Date().toISOString(),
    port,
    identity: null,
    assets: {},
    configHash: null,
    warm: null,
    switches: {},
    rapid: {},
    disableDuringSwitch: null,
    failureRetention: null,
    restored: null,
  };
  let original = null;
  let panelWasOpen = false;
  let changed = false;
  const comparison = mode === "plan-a-baseline" || mode === "plan-a-candidate";
  const candidateLifecycle = mode === "plan-a-lifecycle";
  const interactionOnly =
    mode === "plan-a-interaction-before" || mode === "plan-a-interaction-after";
  const feedbackAcceptance =
    mode === "plan-a-feedback-before" || mode === "plan-a-feedback-after";
  const feedback = mode === "plan-a-feedback" || feedbackAcceptance;
  const styleOnly = mode === "plan-a-style";
  let baseline;
  let payload;
  let temporaryRuntime = false;
  try {
    verifyMainFrame(await page.send("Page.getFrameTree"));
    if (
      comparison ||
      candidateLifecycle ||
      feedback ||
      styleOnly ||
      interactionOnly
    ) {
      baseline = await import(
        pathToFileURL(process.env.WALLPAPER_BASELINE_RUNTIME)
      );
    }
    const expected = baseline?.candidateIdentity() ?? candidateIdentity();
    report.identity = await evaluate(page, `${api}.identity()`);
    if (
      report.identity.runtimeHash !== expected.runtimeHash ||
      report.identity.styleHash !== expected.styleHash
    )
      throw new Error("Live page does not have the expected candidate");
    const visibility = await evaluate(
      page,
      `[innerWidth, innerHeight, devicePixelRatio, document.visibilityState, document.documentElement.dataset.theme]`
    );
    report.conditions = {
      viewport: visibility.slice(0, 3),
      visibility: visibility[3],
      theme: visibility[4],
      startupCardCount: await evaluate(
        page,
        `document.querySelectorAll("${controlsSelector} .card").length`
      ),
    };
    if (
      !styleOnly &&
      (visibility[3] !== "visible" ||
        !(await evaluate(page, "document.hasFocus()")))
    )
      throw new Error("Main page must be visible for frame measurements");
    original = await evaluate(
      page,
      `localStorage.getItem(${JSON.stringify(configKey)})`
    );
    if (!original) throw new Error("Saved wallpaper config is missing");
    report.configHash = hash(original);
    await writeFile(configBackup, original, { encoding: "utf8", flag: "wx" });
    panelWasOpen = await evaluate(
      page,
      `Boolean(document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel].open`
      )}))`
    );
    if (
      mode === "plan-a-candidate" ||
      candidateLifecycle ||
      feedback ||
      styleOnly ||
      interactionOnly
    ) {
      payload = await payloadFor();
      const candidate = mode.endsWith("-before")
        ? await import(pathToFileURL(process.env.WALLPAPER_FEEDBACK_CONTROL))
        : { runtimeSource, candidateIdentity };
      temporaryRuntime = true;
      await replaceRuntime(page, candidate.runtimeSource(payload, true));
      report.identity = await evaluate(page, `${api}.identity()`);
      const expectedCandidate = candidate.candidateIdentity();
      if (
        report.identity.runtimeHash !== expectedCandidate.runtimeHash ||
        report.identity.styleHash !== expectedCandidate.styleHash
      )
        throw new Error("Candidate runtime was not loaded");
      report.temporaryRuntime = true;
    }

    if (styleOnly) {
      const groups = JSON.parse(process.env.WALLPAPER_FEEDBACK_RULES ?? "[]");
      report.style = await evaluate(
        page,
        `(() => {
        const panel = document.querySelector("[data-codex-wallpaper-panel]");
        if (!panel.classList.contains("open"))
          document.querySelector("[data-codex-wallpaper-settings]").click();
        const card = panel.querySelector('.card[data-entry-id="${frontMoovId}"]');
        card.scrollIntoView({ block: "center" });
        const button = card.querySelector("[data-entry-action=use]");
        const badge = card.querySelector(".card-current");
        const previous = { selected: card.dataset.selected, hidden: badge.hidden };
        const sheet = document.querySelector("#codex-wallpaper-p1-style").sheet;
        const rules = [...sheet.cssRules];
        const rows = [];
        const groups = ${JSON.stringify(groups)};
        for (const variant of groups.length ? ["plain", ...groups, "plain"] :
          ["plain", "contained-cards", "no-global-has", "no-adapter-body", "plain"]) {
          const temporary = document.createElement("style");
          if (variant === "contained-cards") {
            temporary.textContent = "#codex-wallpaper-p1-controls .card { content-visibility: auto; contain-intrinsic-size: auto 164px; }";
            document.head.append(temporary);
          }
          const edited = [];
          for (const [index, rule] of rules.entries()) {
            const selector = rule.selectorText;
            if (variant === "no-global-has" && selector?.startsWith("html:has([data-composer-surface-variant])")) {
              edited.push([rule, selector]);
              rule.selectorText = selector.replace("html:has([data-composer-surface-variant]) ", "");
            }
            if ((variant === "no-adapter-body" && selector?.startsWith("body ") && !rule.style.getPropertyValue("anchor-name")) ||
                (Array.isArray(variant) && variant.includes(index))) {
              edited.push([rule, selector]);
              rule.selectorText = ":not(*)";
            }
            if (variant?.selector && selector?.includes("[data-settings-nav-scroll-container]")) {
              edited.push([rule, selector]);
              rule.selectorText = variant.selector;
            }
            if (variant === "css-scope" && selector?.includes("[data-settings-nav-scroll-container]")) {
              temporary.textContent = "@scope (" + selector + ") {" +
                [...rule.cssRules].map(child => child.cssText.replace(/^&\\s+/, ":scope ")).join(" ") + "}";
              document.head.append(temporary);
              edited.push([rule, selector]);
              rule.selectorText = ":not(*)";
            }
            if (variant === "style-query" && selector?.includes("[data-settings-nav-scroll-container]")) {
              temporary.textContent = selector + " { --test-native-settings: active; } " +
                "@container style(--test-native-settings: active) {" +
                [...rule.cssRules].map(child => child.cssText.replace(/^&\\s+/, "body ")).join(" ") + "}";
              document.head.append(temporary);
              edited.push([rule, selector]);
              rule.selectorText = ":not(*)";
            }
          }
          try {
            document.body.offsetWidth;
            for (let index = 0; index < (groups.length ? 2 : 4); index += 1) {
              const begin = performance.now();
              card.dataset.selected = String(!(index % 2));
              badge.hidden = Boolean(index % 2);
              button.getBoundingClientRect();
              rows.push({
                variant, elapsed: performance.now() - begin,
                settingsMatch: variant?.selector ? document.querySelectorAll(variant.selector).length : null,
              });
            }
          } finally {
            temporary.remove();
            for (const [rule, selector] of edited) rule.selectorText = selector;
          }
        }
        card.dataset.selected = previous.selected;
        badge.hidden = previous.hidden;
        return rows;
      })()`
      );
      return;
    }

    for (const id of [imageId, frontMoovId, tailMoovId]) {
      const entry = await prepareWallpaperAsset(id);
      const layout =
        entry?.type === "video" && entry?.mime === "video/mp4"
          ? await prepareMp4VirtualLayout(entry.path, entry.size)
          : null;
      report.assets[id] = entry
        ? {
            id,
            title: entry.title,
            type: entry.type,
            size: entry.size,
            mime: entry.mime,
            layout: layout
              ? {
                  kind: layout.layout,
                  moovSize: layout.moovSize,
                  offsetCount: layout.offsetCount,
                  segments: layout.segments.length,
                }
              : null,
          }
        : null;
    }

    await openPanel(page);
    await clearFilters(page);
    report.conditions.openedCardCount = await evaluate(
      page,
      `document.querySelectorAll("${controlsSelector} .card").length`
    );
    report.conditions.domElements = await evaluate(
      page,
      'document.querySelectorAll("*").length'
    );
    const config = JSON.parse(original);
    config.enabled = true;
    config.active = { kind: "workshop", id: imageId };
    config.activePresetId = null;
    Object.assign(config.settings, {
      rotationMinutes: 0,
      performanceProfile: "balanced",
      fps: 30,
      pauseWhenHidden: true,
      fitMode: "cover",
      blur: 0,
      dim: 0,
      opacity: 100,
      volume: 0,
      muted: true,
    });
    changed = true;
    await setConfig(page, JSON.stringify(config));
    await waitFor(
      page,
      `(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)});
        const img = root?.querySelector(".media:not(.staged) img");
        return Boolean(img && img.complete && img.naturalWidth > 0);
      })()`
    );
    await sleep(500);

    await startProbe(page, mode === "handoff", feedback);
    const frontSelector = `${controlsSelector} .card[data-entry-id="${frontMoovId}"] [data-entry-action="use"]`;
    const tailSelector = `${controlsSelector} .card[data-entry-id="${tailMoovId}"] [data-entry-action="use"]`;
    const imageSelector = `${controlsSelector} .card[data-entry-id="${imageId}"] [data-entry-action="use"]`;

    if (interactionOnly) {
      await runSelect(page, tailSelector, tailMoovId, { video: true });
      await clickSelector(
        page,
        `${controlsSelector} [data-codex-wallpaper-settings]`
      );
      await sleep(700);
      report.interactions = await interactionSample(page);
      return;
    }

    if (feedback) {
      report.feedback = [];
      report.feedbackEnvironment = await evaluate(
        page,
        `(() => {
        const panel = document.querySelector("[data-codex-wallpaper-panel]");
        return {
          backdrop: getComputedStyle(panel).backdropFilter,
          wallpaper: document.querySelector("#codex-wallpaper-p1 .media:not(.staged)")?.firstElementChild?.tagName,
          thumbnails: panel.querySelectorAll(".thumb video").length,
          focus: document.hasFocus(),
        };
      })()`
      );
      const diagnostic = process.env.WALLPAPER_FEEDBACK_TRACE === "1";
      const traceEvents = [];
      const clickTimings = [];
      const traceDone = Promise.withResolvers();
      if (diagnostic || feedbackAcceptance) {
        page.on("Tracing.dataCollected", ({ value }) => {
          for (const item of value) {
            const mark = item.args?.data?.message;
            if (
              item.name === "TimeStamp" &&
              typeof mark === "string" &&
              mark.startsWith("wallpaper-feedback-")
            )
              traceEvents.push({
                ts: item.ts,
                pid: item.pid,
                tid: item.tid,
                name: mark,
              });
            else if (
              item.name === "EventTiming" &&
              (item.ph === "b" || item.ph === "e")
            ) {
              const data = item.args?.data;
              clickTimings.push({
                ts: item.ts,
                pid: item.pid,
                phase: item.ph,
                type: data?.type,
                duration: data?.duration,
              });
            } else if (
              diagnostic &&
              (item.dur >= 1000 ||
                /Presentation|UpdateLayoutTree|Commit|Paint/.test(item.name))
            ) {
              traceEvents.push({
                ts: item.ts,
                pid: item.pid,
                tid: item.tid,
                name: item.name,
                dur: item.dur,
                elements: item.args?.elementCount,
              });
            }
          }
        });
        page.on("Tracing.tracingComplete", traceDone.resolve);
        await page.send("Tracing.start", {
          categories: diagnostic
            ? "devtools.timeline,toplevel,cc,viz,benchmark"
            : "devtools.timeline",
        });
        await evaluate(page, "globalThis.__liveSwitchProbe.trace = true");
      }
      try {
        if (feedbackAcceptance) {
          for (let index = 0; index < (diagnostic ? 4 : 20); index += 1) {
            for (const [name, selector, id] of [
              ["front", frontSelector, frontMoovId],
              ["tail", tailSelector, tailMoovId],
            ]) {
              await switchToImage(page);
              await evaluate(
                page,
                `globalThis.__liveSwitchProbe.experimentFor = "${id}"`
              );
              let sample;
              try {
                sample = await runSelect(page, selector, id, {
                  video: true,
                  timeout: 1800,
                });
              } catch (error) {
                sample = {
                  ...(await readResult(page, id, 0)),
                  error: error.message,
                };
              }
              report.feedback.push({ name, ...sample });
            }
          }
        } else {
          for (let index = 0; index < 6; index += 1) {
            for (const method of diagnostic
              ? ["cdp", "ui-only", "contained-cards", "no-global-has"]
              : ["cdp", "cdp-settled", "dom-diagnostic"]) {
              await switchToImage(page);
              await resetProbe(page);
              if (diagnostic) {
                await evaluate(
                  page,
                  `(() => {
              const panel = document.querySelector("[data-codex-wallpaper-panel]");
              const probe = globalThis.__liveSwitchProbe;
              probe.restoreExperiment?.();
              const method = ${JSON.stringify(method)};
              probe.experimentFor = ${JSON.stringify(frontMoovId)};
              const temporary = document.createElement("style");
              if (method === "contained-cards") temporary.textContent =
                "#codex-wallpaper-p1-controls .card { content-visibility: auto; contain-intrinsic-size: auto 164px; }";
              if (method === "no-global-has") temporary.textContent =
                "#codex-wallpaper-p1-controls .panel { position-anchor: --codex-wallpaper-composer !important; }";
              if (temporary.textContent) document.head.append(temporary);
              const rules = [...document.querySelector("#codex-wallpaper-p1-style").sheet.cssRules];
              const globalRules = method === "no-global-has"
                ? rules.filter(rule => rule.selectorText?.startsWith("html:has([data-composer-surface-variant])"))
                : [];
              for (const rule of globalRules)
                rule.selectorText = rule.selectorText.replace("html:has([data-composer-surface-variant]) ", "");
              const listeners = new AbortController();
              if (method === "ui-only") {
                const button = document.querySelector(${JSON.stringify(frontSelector)});
                button.addEventListener("click", (event) => {
                  event.stopImmediatePropagation();
                  const card = button.closest(".card");
                  card.dataset.selected = "true";
                  card.querySelector(".card-current").hidden = false;
                }, { capture: true, once: true, signal: listeners.signal });
              }
              probe.restoreExperiment = () => {
                listeners.abort();
                probe.experimentFor = null;
                temporary.remove();
                for (const rule of globalRules)
                  rule.selectorText = "html:has([data-composer-surface-variant]) " + rule.selectorText;
                if (method === "ui-only") {
                  const card = document.querySelector(${JSON.stringify(frontSelector)}).closest(".card");
                  card.dataset.selected = "false";
                  card.querySelector(".card-current").hidden = true;
                }
              };
            })()`
                );
              }
              if (method === "dom-diagnostic") {
                await evaluate(
                  page,
                  `(() => {
              const button = document.querySelector(${JSON.stringify(frontSelector)});
              button.scrollIntoView({ block: "center" });
              button.click();
            })()`
                );
              } else {
                await clickSelector(
                  page,
                  frontSelector,
                  true,
                  method === "cdp-settled" ? 180 : 0
                );
              }
              const error = await waitFor(
                page,
                "Boolean(globalThis.__liveSwitchProbe?.feedbackAt)",
                1000
              ).then(
                () => undefined,
                (error) => error.message
              );
              await sleep(110);
              const sample = await readResult(page, frontMoovId, 0);
              sample.timingEntries = await evaluate(
                page,
                `(() => {
            const probe = globalThis.__liveSwitchProbe;
            return probe.timings.filter((entry) =>
              entry.start + entry.duration >= probe.click.at && entry.start <= probe.feedbackAt + 60);
          })()`
              );
              report.feedback.push({ method, ...sample, error });
              if (diagnostic)
                await evaluate(
                  page,
                  "globalThis.__liveSwitchProbe.restoreExperiment?.()"
                );
            }
            if (diagnostic && index >= 2) break;
          }
        }
      } finally {
        if (diagnostic) {
          await evaluate(
            page,
            "globalThis.__liveSwitchProbe.restoreExperiment?.()"
          );
        }
        if (diagnostic || feedbackAcceptance) {
          await page.send("Tracing.end");
          await Promise.race([traceDone.promise, sleep(5000)]);
          const marks = traceEvents.filter(
            (event) => event.name === "wallpaper-feedback-click"
          );
          if (feedbackAcceptance) {
            const ends = clickTimings.filter((event) => event.phase === "e");
            report.presentation = marks.map(({ ts }, index) => {
              const click = report.feedback[index]?.click;
              const events = clickTimings.filter(
                (event) =>
                  event.phase === "b" &&
                  event.type === "click" &&
                  event.ts >= ts - 50000 &&
                  event.ts <= ts + 500
              );
              const begin = events.at(-1);
              const end =
                begin &&
                ends.find(
                  (event) =>
                    event.pid === begin.pid &&
                    Math.abs(event.ts - (begin.ts + begin.duration * 1000)) < 3
                )?.ts;
              const frame =
                traceEvents.find(
                  (event) =>
                    event.name === "wallpaper-feedback-frame" &&
                    event.ts >= ts &&
                    event.ts <= ts + 160000
                )?.ts ?? null;
              return {
                name: report.feedback[index]?.name,
                trusted: click?.trusted,
                feedbackFrame: frame,
                elapsed:
                  end == null || frame == null || end < frame
                    ? null
                    : (end - begin.ts) / 1000,
                start: begin?.ts,
                end,
                traceDuration: begin?.duration,
              };
            });
          }
          if (diagnostic)
            report.trace = marks.map(({ ts, pid, tid }, index) => {
              const end = ts + 160000;
              return {
                method: report.feedback[index]?.method,
                renderer: { pid, tid },
                events: traceEvents
                  .filter(
                    (event) =>
                      event.ts >= ts - 10000 &&
                      event.ts < end &&
                      ((event.pid === pid && event.tid === tid) ||
                        /BeginFrame|DrawFrame|Presentation/.test(event.name))
                  )
                  .map(({ ts: time, ...event }) => ({
                    ...event,
                    ms: (time - ts) / 1000,
                  })),
              };
            });
        }
      }
      if (feedbackAcceptance && !diagnostic) {
        await clickSelector(
          page,
          `${controlsSelector} [data-codex-wallpaper-settings]`
        );
        await sleep(1000);
        report.interactions = await interactionSample(page);
      }
      return;
    }

    if (comparison) {
      report.samples = { front: [], tail: [] };
      report.workloads = {};
      report.resources = { before: processSample() };
      await resetProbe(page);
      for (let index = 0; index < 8; index += 1) {
        const id = index % 2 ? tailMoovId : frontMoovId;
        await hoverWarm(
          page,
          `${controlsSelector} .card[data-entry-id="${id}"]`,
          false
        );
        await sleep(150);
      }
      report.workloads.hover = await readResult(page, imageId, 0);
      report.resources.afterHover = processSample();
      for (let index = 0; index < 20; index += 1) {
        for (const [name, selector, id] of [
          ["front", frontSelector, frontMoovId],
          ["tail", tailSelector, tailMoovId],
        ]) {
          await switchToImage(page);
          let result;
          try {
            result = await runSelect(page, selector, id, {
              video: true,
              timeout: 1500,
            });
          } catch (error) {
            result = {
              ...(await readResult(page, id, 0)),
              error: String(error),
            };
          }
          report.samples[name].push(result);
        }
      }
      report.resources.afterSwitches = processSample();
      if (report.samples.tail.at(-1)?.dynamic?.visible) {
        await clickSelector(
          page,
          `${controlsSelector} [data-codex-wallpaper-settings]`
        );
        await sleep(1000);
        report.resources.beforePlaying = processSample();
        report.workloads.playing = await interactionSample(page);
        report.resources.afterPlaying = processSample();
      }
      const motionDirectory = process.env.WALLPAPER_MOTION_CAPTURE;
      if (mode === "plan-a-candidate" && motionDirectory) {
        report.motion = {};
        for (const [name, selector, id] of [
          ["front", frontSelector, frontMoovId],
          ["tail", tailSelector, tailMoovId],
        ]) {
          await openPanel(page);
          await switchToImage(page);
          const sample = await runSelect(page, selector, id, { video: true });
          if (!sample.dynamic?.visible)
            throw new Error(`No comparable motion for ${id}`);
          await clickSelector(
            page,
            `${controlsSelector} [data-codex-wallpaper-settings]`
          );
          report.motion[name] = await captureMotion(page, motionDirectory, id);
        }
      }
      return;
    }

    if (mode === "handoff") {
      report.handoff = [];
      for (let index = 0; index < 12; index += 1) {
        await switchToImage(page);
        const nearTransparent = index % 2 === 1;
        await evaluate(
          page,
          `(() => {
          document.querySelector("#live-wallpaper-handoff-opacity")?.remove();
          if (${nearTransparent}) {
            const rule = document.createElement("style");
            rule.id = "live-wallpaper-handoff-opacity";
            rule.textContent = "#codex-wallpaper-p1#codex-wallpaper-p1 .media.staged { opacity: 0.01 }";
            document.head.append(rule);
          }
        })()`
        );
        let result;
        try {
          result = await runSelect(page, frontSelector, frontMoovId, {
            video: true,
            prewarm: true,
            timeout: 2000,
          });
        } catch (error) {
          result = {
            ...(await readResult(page, frontMoovId, 0)),
            error: String(error),
          };
        }
        report.handoff.push({ nearTransparent, ...result });
      }
      return;
    }

    if (candidateLifecycle) {
      for (const [label, middle, last, id] of [
        ["abc", tailSelector, imageSelector, imageId],
        ["aba", tailSelector, frontSelector, frontMoovId],
      ]) {
        await switchToImage(page);
        await resetProbe(page);
        const startedAt = await evaluate(page, "performance.now()");
        await clickSelector(page, frontSelector);
        await clickSelector(page, middle);
        await clickSelector(page, last);
        try {
          await waitFor(
            page,
            `${api}.state().activeId === "${id}" &&
              Boolean(globalThis.__liveSwitchProbe.committedAt) &&
              (${id === imageId} || Boolean(globalThis.__liveSwitchProbe.dynamic))`,
            2000
          );
          report.rapid[label] = await readResult(page, id, startedAt);
        } catch (error) {
          report.rapid[label] = {
            ...(await readResult(page, id, startedAt)),
            error: String(error),
          };
        }
      }
    }

    if (mode !== "lifecycle" && !candidateLifecycle) {
      for (const [label, selector, id] of [
        ["frontCold", frontSelector, frontMoovId],
        ["tailCold", tailSelector, tailMoovId],
      ]) {
        await switchToImage(page);
        try {
          addSelectMetrics(
            report,
            label,
            await runSelect(page, selector, id, { video: true })
          );
        } catch (error) {
          report.switches[label] = {
            ...(await readResult(page, id, 0)),
            error: String(error),
          };
        }
      }

      if (!(
        report.switches.frontCold.dynamicValid &&
        report.switches.tailCold.dynamicValid
      )) {
        report.blocker =
          "At least one video did not produce a valid dynamic frame in the first selection";
        return;
      }

      report.warmSamples = { front: [], tail: [] };
      for (let sample = 0; sample < 20; sample += 1) {
        for (const [kind, selector, id] of [
          ["front", frontSelector, frontMoovId],
          ["tail", tailSelector, tailMoovId],
        ]) {
          await switchToImage(page);
          try {
            report.warmSamples[kind].push(
              await runSelect(page, selector, id, {
                video: true,
              })
            );
          } catch (error) {
            report.warmSamples[kind].push({
              ...(await readResult(page, id, 0)),
              error: String(error),
            });
          }
        }
      }

      await switchToImage(page);
      const rapidStarted = await evaluate(page, "performance.now()");
      await clickSelector(page, frontSelector);
      await sleep(35);
      await clickSelector(page, tailSelector);
      await sleep(35);
      await clickSelector(page, imageSelector);
      await waitFor(
        page,
        `${api}.state().activeId === ${JSON.stringify(imageId)}`
      );
      await waitFor(
        page,
        `(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)});
        return Boolean(root?.querySelector(".media:not(.staged) img") && root.querySelectorAll(".media.staged").length === 0);
      })()`
      );
      report.rapid.abc = await readResult(page, imageId, rapidStarted);

      await runSelect(page, frontSelector, frontMoovId, { video: true });
      const abaStarted = await evaluate(page, "performance.now()");
      await clickSelector(page, frontSelector, false);
      await sleep(35);
      await clickSelector(page, imageSelector);
      await sleep(35);
      await clickSelector(page, frontSelector, false);
      await waitFor(
        page,
        `${api}.state().activeId === ${JSON.stringify(frontMoovId)}`
      );
      await waitFor(
        page,
        `(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)});
        return Boolean(root?.querySelector(".media:not(.staged) video") && root.querySelectorAll(".media.staged").length === 0);
      })()`
      );
      report.rapid.aba = await readResult(page, frontMoovId, abaStarted);
    }

    await switchToImage(page);
    const disableStart = await evaluate(page, "performance.now()");
    await clickSelector(page, frontSelector);
    const beforeDisable = await readResult(page, frontMoovId, disableStart);
    await evaluate(
      page,
      `(() => {
        addEventListener("keydown", (event) => {
          if (event.isTrusted && event.altKey && event.shiftKey && event.code === "KeyW")
            globalThis.__liveDisableClick = performance.now();
        }, { capture: true, once: true });
      })()`
    );
    await page.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "W",
      code: "KeyW",
      windowsVirtualKeyCode: 87,
      modifiers: 9,
    });
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "W",
      code: "KeyW",
      windowsVirtualKeyCode: 87,
    });
    await waitFor(
      page,
      `(() => {
        const state = ${api}.state();
        return state.state === "disabled" && !document.querySelector(${JSON.stringify(rootSelector)});
      })()`,
      1500
    );
    const disableEnd = await evaluate(page, "performance.now()");
    const disableClick = await evaluate(
      page,
      `globalThis.__liveDisableClick ?? null`
    );
    await evaluate(page, `delete globalThis.__liveDisableClick`);
    await sleep(30000);
    report.disableDuringSwitch = {
      beforeDisable,
      dispatchToCleanupMilliseconds:
        disableClick === null ? null : disableEnd - disableClick,
      totalMilliseconds: disableEnd - disableStart,
      afterThirtySeconds: await evaluate(
        page,
        `({
          state: ${api}.state().state,
          root: Boolean(document.querySelector(${JSON.stringify(rootSelector)})),
          players: document.querySelectorAll(${JSON.stringify(rootSelector)} + " video").length,
          warm: document.querySelectorAll(${JSON.stringify(rootSelector)} + " video[data-codex-wallpaper-warm]").length
          , fileInputs: document.querySelectorAll("[data-codex-wallpaper-file]").length
        })`
      ),
    };

    await setConfig(page, JSON.stringify(config));
    await waitFor(
      page,
      `(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)});
        const img = root?.querySelector(".media:not(.staged) img");
        return ${api}.state().state === "enabled" &&
          ${api}.state().activeId === ${JSON.stringify(imageId)} &&
          Boolean(img && img.complete && img.naturalWidth > 0);
      })()`
    );
    await openPanel(page);
    await clearFilters(page);
    await resetProbe(page);
    const failureStart = await evaluate(page, "performance.now()");
    const beforeFailure = await readResult(page, imageId, failureStart);
    const missingConfig = JSON.parse(original);
    missingConfig.enabled = true;
    missingConfig.active = { kind: "workshop", id: missingId };
    await setConfig(page, JSON.stringify(missingConfig));
    await sleep(600);
    const afterFailure = await evaluate(
      page,
      `(() => {
        const root = document.querySelector(${JSON.stringify(rootSelector)});
        return {
          activeId: ${api}.state().activeId,
          mediaCount: root?.querySelectorAll(".media:not(.staged)").length ?? 0,
          staged: root?.querySelectorAll(".media.staged").length ?? 0,
          tag: root?.querySelector(".media:not(.staged) img") ? "img" : null,
          previousNodeRetained: root?.querySelector(".media:not(.staged)") === globalThis.__liveSwitchProbe?.baseMedia,
          status: document.querySelector(${JSON.stringify(
            `${controlsSelector} .runtime-status`
          )})?.textContent || null,
        };
      })()`
    );
    report.failureRetention = {
      previous: beforeFailure.media,
      after: afterFailure,
    };

    await setConfig(page, original);
    changed = false;
    await sleep(500);
    if (panelWasOpen) await openPanel(page);
    else
      await evaluate(
        page,
        `document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel]`
        )})?.classList.remove("open")`
      );
    report.restored = {
      configExact:
        (await evaluate(
          page,
          `localStorage.getItem(${JSON.stringify(configKey)})`
        )) === original,
      activeId: await evaluate(page, `${api}.state().activeId`),
      panelOpen: await evaluate(
        page,
        `Boolean(document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel].open`
        )}))`
      ),
    };
  } catch (error) {
    report.error = String(error?.message || error);
    report.lastSample = await readResult(page, "", 0).catch(() => null);
    process.exitCode = 1;
  } finally {
    try {
      await evaluate(page, `globalThis.__liveSwitchProbe?.cleanup?.()`).catch(
        () => {}
      );
      if (temporaryRuntime && original) {
        await evaluate(
          page,
          `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(original)})`
        );
        await replaceRuntime(page, baseline.runtimeSource(payload, true));
        report.restoredRuntime = await evaluate(page, `${api}.identity()`);
      }
      if ((changed || temporaryRuntime) && original) {
        await setConfig(page, original).catch(() => {});
        if (panelWasOpen) await openPanel(page).catch(() => {});
        else
          await evaluate(
            page,
            `document.querySelector(${JSON.stringify(
              `${controlsSelector} [data-codex-wallpaper-panel]`
            )})?.classList.remove("open")`
          ).catch(() => {});
        report.restored = {
          configExact:
            (await evaluate(
              page,
              `localStorage.getItem(${JSON.stringify(configKey)})`
            )) === original,
          activeId: await evaluate(page, `${api}.state().activeId`),
        };
      }
      report.finishedAt = new Date().toISOString();
      await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    } finally {
      page.close();
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await main();
}
