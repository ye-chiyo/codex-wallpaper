import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { openMainPageSession } from "../../launcher/read-only-probe.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";

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

async function waitFor(page, expression, timeoutMilliseconds = 12000) {
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

async function replaceText(page, selector, value) {
  await evaluate(
    page,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      input.focus();
      input.select();
    })()`
  );
  await page.send("Input.insertText", { text: value });
  await evaluate(page, "document.activeElement?.blur()");
}

async function changeValue(
  page,
  selector,
  value,
  eventNames = ["input", "change"]
) {
  return evaluate(
    page,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) return null;
      input.value = ${JSON.stringify(String(value))};
      for (const eventName of ${JSON.stringify(eventNames)})
        input.dispatchEvent(new Event(eventName, { bubbles: true }));
      return {
        value: input.value,
        checked: "checked" in input ? input.checked : null
      };
    })()`
  );
}

async function setToggle(page, selector, checked) {
  return evaluate(
    page,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) return null;
      input.checked = ${Boolean(checked)};
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return { checked: input.checked };
    })()`
  );
}

async function openPanel(page) {
  const open = await evaluate(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-panel]`
    )})?.classList.contains("open")`
  );
  if (open) return { alreadyOpen: true, receivesClick: true };
  const target = await click(
    page,
    `${controlsSelector} [data-codex-wallpaper-settings]`
  );
  await waitFor(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-panel].open`
    )}) !== null`
  );
  return target;
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

async function selectPage(page, id) {
  const tab = `${controlsSelector} [data-panel-page="${id}"]`;
  const visible = `${controlsSelector} [data-panel-region="${id}"]:not([hidden])`;
  await click(page, tab);
  await waitFor(
    page,
    `Boolean(document.querySelector(${JSON.stringify(visible)}))`
  );
}

async function chooseCard(page, id) {
  const selector = `${controlsSelector} .card[data-entry-id="${id}"] [data-entry-action="use"]`;
  return click(page, selector);
}

async function readSnapshot(page) {
  return evaluate(
    page,
    `(() => {
      const api = globalThis.__codexWallpaperApi;
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const controls = document.querySelector(${JSON.stringify(controlsSelector)});
      const panel = controls?.querySelector("[data-codex-wallpaper-panel]");
      const activeMedia = root?.querySelector(".media:not(.staged)");
      const saved = JSON.parse(localStorage.getItem(${JSON.stringify(
        configKey
      )}) || "null");
      return {
        visibilityState: document.visibilityState,
        focused: document.hasFocus(),
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        state: api?.state?.() || null,
        identity: api?.identity?.() || null,
        config: saved,
        panelOpen: Boolean(panel?.classList.contains("open")),
        panelScrollTop: panel?.scrollTop ?? null,
        cardCount: panel?.querySelectorAll(".card").length ?? 0,
        visibleCardCount: panel
          ? [...panel.querySelectorAll(".card")].filter((card) => !card.hidden).length
          : 0,
        resultText: panel?.querySelector("[data-library-result]")?.textContent || null,
        statusText: controls?.querySelector(".runtime-status")?.textContent || null,
        activeMedia: activeMedia
          ? {
              className: activeMedia.className,
              marker: activeMedia.dataset.t08Marker || null,
              children: [...activeMedia.querySelectorAll("img,video,canvas,iframe,.scene-host")]
                .map((child) => ({
                  tagName: child.tagName.toLowerCase(),
                  className: child.className || "",
                  ready: child.classList.contains("ready"),
                  paused: "paused" in child ? child.paused : null,
                  readyState: "readyState" in child ? child.readyState : null,
                })),
            }
          : null,
        stagedCount: root?.querySelectorAll(".media.staged").length ?? 0,
        mediaCount: root?.querySelectorAll(".media:not(.staged)").length ?? 0,
        activePresetId: saved?.activePresetId ?? null,
        presetCount: saved?.presets?.length ?? 0,
        favoriteIds: saved?.favorites?.map((item) => item.id) || [],
        playlistIds: saved?.playlist?.map((item) => item.id) || [],
      };
    })()`
  );
}

async function waitForMedia(page, expected) {
  return waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const state = globalThis.__codexWallpaperApi?.state?.();
      const media = root?.querySelector(".media:not(.staged)");
      if (!state || !media || state.activeId !== ${JSON.stringify(
        expected.id
      )}) return false;
      const selector = ${JSON.stringify(expected.selector)};
      const node = media.querySelector(selector);
      if (!node) return false;
      ${
        expected.readyExpression
          ? `if (!(${expected.readyExpression})) return false;`
          : ""
      }
      return root.querySelectorAll(".media:not(.staged)").length === 1;
    })()`,
    18000
  );
}

async function performanceMarker(page) {
  return evaluate(
    page,
    `(() => {
      const media = document.querySelector(${JSON.stringify(
        `${rootSelector} .media:not(.staged)`
      )});
      if (!media) return null;
      const marker = crypto.randomUUID();
      media.dataset.t08Marker = marker;
      return marker;
    })()`
  );
}

async function dispatchHotkey(page) {
  await page.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "W",
    code: "KeyW",
    windowsVirtualKeyCode: 87,
    modifiers: 1 | 8,
  });
  await page.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "W",
    code: "KeyW",
    windowsVirtualKeyCode: 87,
    modifiers: 1 | 8,
  });
}

async function inspectSecondaryPages(port) {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
    (response) => response.json()
  );
  return targets
    .filter(
      (target) =>
        target.type === "page" &&
        target.url.startsWith("app://-/") &&
        target.url !== "app://-/index.html"
    )
    .map((target) => ({
      title: target.title,
      route: new URL(target.url).pathname,
      lifecycle: target.url.includes("avatar-overlay")
        ? "avatar-overlay"
        : target.url.includes("detached-window")
          ? "detached-window"
          : "other",
    }));
}

export async function runFunctionalAcceptance({ port, initialConfigPath }) {
  const initialConfig = await readFile(initialConfigPath, "utf8");
  const page = await openMainPageSession(port, "app://-/index.html", true);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await sleep(300);
  const results = {
    startedAt: new Date().toISOString(),
    initialConfigHash: fingerprint(initialConfig),
    identity: null,
    panel: null,
    searchAndFilter: null,
    media: {},
    rapidSelection: null,
    failureRetention: null,
    playbackAndAppearance: null,
    presets: null,
    keyboardInputScroll: null,
    tenCycles: null,
    lifecycle: null,
    secondaryPages: [],
    finalState: null,
  };
  try {
    const identity = await evaluate(
      page,
      "globalThis.__codexWallpaperApi?.identity?.() || null"
    );
    if (!identity) throw new Error("Candidate identity API is unavailable");
    results.identity = identity;

    const openTarget = await openPanel(page);
    await selectPage(page, "library");
    const openSnapshot = await readSnapshot(page);
    const panelIdentity = await evaluate(
      page,
      `(() => {
        const panel = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel]`
        )});
        const marker = crypto.randomUUID();
        panel.dataset.t08Identity = marker;
        return { marker, firstCardPresent: Boolean(panel.querySelector(".card")) };
      })()`
    );
    await closePanel(page);
    await openPanel(page);
    const reopenSnapshot = await readSnapshot(page);
    const reopenedPanelIdentity = await evaluate(
      page,
      `(() => {
        const panel = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-codex-wallpaper-panel]`
        )});
        return {
          marker: panel?.dataset.t08Identity || null,
          firstCardPresent: Boolean(panel?.querySelector(".card"))
        };
      })()`
    );
    results.panel = {
      openReceivesClick: openTarget.receivesClick,
      opened: openSnapshot.panelOpen,
      reopened: reopenSnapshot.panelOpen,
      panelPreserved:
        reopenedPanelIdentity.marker === panelIdentity.marker &&
        reopenSnapshot.cardCount === openSnapshot.cardCount,
      cardPresent: panelIdentity.firstCardPresent,
      cardCountStable: openSnapshot.cardCount === reopenSnapshot.cardCount,
    };

    await replaceText(
      page,
      `${controlsSelector} [data-library-search]`,
      "deepseek"
    );
    const searchSnapshot = await readSnapshot(page);
    await changeValue(
      page,
      `${controlsSelector} [data-library-type]`,
      "video",
      ["change"]
    );
    const videoFilterSnapshot = await readSnapshot(page);

    const favoriteSelector = `${controlsSelector} .card[data-entry-id="3809295036"] [data-entry-action="favorite"]`;
    const favoriteClick = await click(page, favoriteSelector);
    await setToggle(page, `${controlsSelector} [data-library-favorites]`, true);
    const favoriteSnapshot = await readSnapshot(page);
    await setToggle(
      page,
      `${controlsSelector} [data-library-favorites]`,
      false
    );
    await changeValue(page, `${controlsSelector} [data-library-type]`, "all", [
      "change",
    ]);
    await replaceText(page, `${controlsSelector} [data-library-search]`, "");
    results.searchAndFilter = {
      favoriteClickReceivesClick: favoriteClick.receivesClick,
      search: {
        cardCount: searchSnapshot.cardCount,
        visibleCardCount: searchSnapshot.visibleCardCount,
        resultText: searchSnapshot.resultText,
      },
      videoFilter: {
        visibleCardCount: videoFilterSnapshot.visibleCardCount,
        resultText: videoFilterSnapshot.resultText,
      },
      favoritesOnly: {
        visibleCardCount: favoriteSnapshot.visibleCardCount,
        containsToggledFavorite:
          favoriteSnapshot.favoriteIds.includes("3809295036"),
      },
    };

    const mediaCases = [
      {
        name: "image",
        id: "2817646508",
        selector: "img",
        readyExpression: "node.complete && node.naturalWidth > 0",
      },
      {
        name: "scene",
        id: "2788691565",
        selector: ".scene-host.ready",
      },
      {
        name: "video",
        id: "3787353838",
        selector: "video",
        readyExpression: "node.readyState >= 2",
      },
      {
        name: "web",
        id: "2179153203",
        selector: "img",
        readyExpression: "node.complete && node.naturalWidth > 0",
      },
    ];
    for (const mediaCase of mediaCases) {
      const clickResult = await chooseCard(page, mediaCase.id);
      const settleMilliseconds = await waitForMedia(page, mediaCase);
      const snapshot = await readSnapshot(page);
      results.media[mediaCase.name] = {
        clickReceivesClick: clickResult.receivesClick,
        settleMilliseconds,
        activeId: snapshot.state?.activeId,
        mediaCount: snapshot.mediaCount,
        stagedCount: snapshot.stagedCount,
        playerCount: snapshot.state?.playerCount,
        statusText: snapshot.statusText,
        activeMedia: snapshot.activeMedia,
      };
    }

    const imageClick = await chooseCard(page, "2817646508");
    await waitForMedia(page, mediaCases[0]);
    const beforeFailureMarker = await performanceMarker(page);
    const failureClick = await chooseCard(page, "3014214275");
    await waitFor(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} .runtime-status`
      )})?.textContent.includes("失败")`,
      12000
    ).catch(() => null);
    const failureSnapshot = await readSnapshot(page);
    results.failureRetention = {
      clickReceivesClick:
        imageClick.receivesClick && failureClick.receivesClick,
      previousMediaMarker: beforeFailureMarker,
      retainedMarker:
        failureSnapshot.activeMedia?.marker === beforeFailureMarker,
      activeIdAfterFailure: failureSnapshot.state?.activeId,
      mediaCount: failureSnapshot.mediaCount,
      stagedCount: failureSnapshot.stagedCount,
      statusText: failureSnapshot.statusText,
    };

    const finalScene = mediaCases[1];
    const rapidResult = await evaluate(
      page,
      `(async () => {
        const controls = document.querySelector(${JSON.stringify(controlsSelector)});
        const select = (id) => controls
          .querySelector(\`.card[data-entry-id="\${id}"] [data-entry-action="use"]\`)
          .click();
        select("2817646508");
        await new Promise((resolve) => setTimeout(resolve, 20));
        select("3787353838");
        await new Promise((resolve) => setTimeout(resolve, 20));
        select("2788691565");
        return true;
      })()`
    );
    const rapidSettleMilliseconds = await waitForMedia(page, finalScene);
    const rapidSnapshot = await readSnapshot(page);
    results.rapidSelection = {
      dispatched: rapidResult,
      settleMilliseconds: rapidSettleMilliseconds,
      activeId: rapidSnapshot.state?.activeId,
      mediaCount: rapidSnapshot.mediaCount,
      stagedCount: rapidSnapshot.stagedCount,
    };

    const beforeSettingsMarker = await performanceMarker(page);
    await selectPage(page, "playback");
    await changeValue(
      page,
      `${controlsSelector} [data-playback-profile]`,
      "performance",
      ["change"]
    );
    const performanceProfile = await readSnapshot(page);
    await changeValue(
      page,
      `${controlsSelector} [data-playback-profile]`,
      "balanced",
      ["change"]
    );
    await selectPage(page, "appearance");
    await changeValue(page, `${controlsSelector} [data-setting="dim"]`, 34);
    await changeValue(page, `${controlsSelector} [data-setting="blur"]`, 2);
    await changeValue(page, `${controlsSelector} [data-setting="opacity"]`, 88);
    await changeValue(
      page,
      `${controlsSelector} [data-setting="surfaceOpacity"]`,
      58
    );
    await changeValue(
      page,
      `${controlsSelector} [data-setting="fitMode"]`,
      "contain",
      ["change"]
    );
    await changeValue(
      page,
      `${controlsSelector} [data-setting="interfaceBlur"]`,
      3
    );
    await setToggle(
      page,
      `${controlsSelector} [data-setting-toggle="interfaceBorders"]`,
      false
    );
    await click(page, `${controlsSelector} .settings-grid details > summary`);
    await setToggle(
      page,
      `${controlsSelector} [data-surface-override="chat"]`,
      true
    );
    await changeValue(
      page,
      `${controlsSelector} [data-surface-override-value="chat"]`,
      55
    );
    const appearanceSnapshot = await readSnapshot(page);
    results.playbackAndAppearance = {
      performanceProfileFps: performanceProfile.state?.fpsCap,
      performanceProfilePauseWhenHidden:
        performanceProfile.config?.settings?.pauseWhenHidden,
      balancedProfileFps: appearanceSnapshot.state?.fpsCap,
      mediaPreserved:
        appearanceSnapshot.activeMedia?.marker === beforeSettingsMarker,
      settings: appearanceSnapshot.config?.settings,
      mediaCount: appearanceSnapshot.mediaCount,
      stagedCount: appearanceSnapshot.stagedCount,
    };

    await replaceText(
      page,
      `${controlsSelector} [data-preset-name-input]`,
      "T08 Acceptance"
    );
    await click(page, `${controlsSelector} [data-preset-save]`);
    const presetSaved = await readSnapshot(page);
    const exportedText = await evaluate(
      page,
      `(async () => {
        const originalCreate = URL.createObjectURL;
        let blob = null;
        URL.createObjectURL = (candidate) => {
          blob = candidate;
          return "blob:t08-settings";
        };
        try {
          document.querySelector(${JSON.stringify(
            `${controlsSelector} [data-settings-export]`
          )}).click();
          return await blob.text();
        } finally {
          URL.createObjectURL = originalCreate;
        }
      })()`
    );
    const exported = JSON.parse(exportedText);
    const importStatus = await evaluate(
      page,
      `(async () => {
        const input = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-settings-import]`
        )});
        const status = document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-settings-status]`
        )});
        status.textContent = "";
        const transfer = new DataTransfer();
        transfer.items.add(new File(
          [${JSON.stringify(exportedText)}],
          "t08-settings.json",
          { type: "application/json" }
        ));
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        for (let attempt = 0; attempt < 80; attempt += 1) {
          if (status.textContent) return status.textContent;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        return null;
      })()`
    );
    await changeValue(page, `${controlsSelector} [data-setting="opacity"]`, 73);
    await click(
      page,
      `${controlsSelector} [data-preset-apply="${presetSaved.activePresetId}"]`
    );
    await closePanel(page);
    await openPanel(page);
    const reopenedPreset = await readSnapshot(page);
    results.presets = {
      savedPresetCount: presetSaved.presetCount,
      activePresetId: presetSaved.activePresetId,
      exportedVersion: exported.version,
      exportHasSettingsOnly: !(
        "favorites" in exported ||
        "playlist" in exported ||
        "active" in exported
      ),
      importStatus,
      opacityAfterApply: reopenedPreset.config?.settings?.opacity,
      presetStillPresent:
        reopenedPreset.presetCount === presetSaved.presetCount,
    };

    await selectPage(page, "library");
    await replaceText(page, `${controlsSelector} [data-library-search]`, "ark");
    const keyboardInputSnapshot = await evaluate(
      page,
      `({
        searchValue: document.querySelector(${JSON.stringify(
          `${controlsSelector} [data-library-search]`
        )}).value,
        visibleCards: [...document.querySelectorAll(${JSON.stringify(
          `${controlsSelector} .card`
        )})].filter((card) => !card.hidden).length
      })`
    );
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel]`
      )}).scrollTop = 420`
    );
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 1300,
      y: 700,
      deltaY: 240,
      deltaX: 0,
    });
    const scrollTop = await evaluate(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-codex-wallpaper-panel]`
      )}).scrollTop`
    );
    await replaceText(page, `${controlsSelector} [data-library-search]`, "");
    await selectPage(page, "appearance");
    await changeValue(page, `${controlsSelector} [data-setting="opacity"]`, 80);
    const opacityBeforeKeyboard = await readSnapshot(page);
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-setting="opacity"]`
      )}).focus()`
    );
    await page.send("Input.dispatchKeyEvent", {
      type: "keyDown",
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
    const opacityAfterKeyboard = await readSnapshot(page);
    results.keyboardInputScroll = {
      typedSearch: keyboardInputSnapshot.searchValue,
      searchVisibleCards: keyboardInputSnapshot.visibleCards,
      panelScrolled: scrollTop > 0,
      keyboardChangedOpacity:
        opacityAfterKeyboard.config?.settings?.opacity !==
        opacityBeforeKeyboard.config?.settings?.opacity,
      opacityBefore: opacityBeforeKeyboard.config?.settings?.opacity,
      opacityAfter: opacityAfterKeyboard.config?.settings?.opacity,
    };

    await closePanel(page);
    const cycleMarkers = [];
    const cycleHeap = [];
    for (let index = 0; index < 10; index += 1) {
      await click(page, "[data-app-shell-main-surface]");
      await page.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: 850,
        y: 500,
        deltaY: 120,
        deltaX: 0,
      });
      await openPanel(page);
      await changeValue(
        page,
        `${controlsSelector} [data-setting="opacity"]`,
        80 + index
      );
      const marker = await performanceMarker(page);
      const heap = await evaluate(
        page,
        `performance.memory?.usedJSHeapSize ?? null`
      );
      cycleMarkers.push(marker);
      cycleHeap.push(heap);
      await closePanel(page);
    }
    const tenCycleSnapshot = await readSnapshot(page);
    results.tenCycles = {
      cycles: 10,
      markersCreated: cycleMarkers.filter(Boolean).length,
      heapStart: cycleHeap[0],
      heapEnd: cycleHeap.at(-1),
      heapDelta: cycleHeap.at(-1) - cycleHeap[0],
      finalOpacity: tenCycleSnapshot.config?.settings?.opacity,
      mediaCount: tenCycleSnapshot.mediaCount,
      stagedCount: tenCycleSnapshot.stagedCount,
    };

    const disableStart = Date.now();
    const disableClick = await click(
      page,
      `${controlsSelector} [data-codex-wallpaper-toggle]`
    );
    await waitFor(
      page,
      `globalThis.__codexWallpaperApi?.state?.().state === "disabled" && !document.querySelector(${JSON.stringify(
        rootSelector
      )})`,
      1500
    );
    const disabledMilliseconds = Date.now() - disableStart;
    const disabledSnapshot = await readSnapshot(page);
    const enableStart = Date.now();
    await dispatchHotkey(page);
    await waitFor(
      page,
      `globalThis.__codexWallpaperApi?.state?.().state === "enabled" && document.querySelector(${JSON.stringify(
        rootSelector
      )}) !== null`,
      5000
    );
    const enabledMilliseconds = Date.now() - enableStart;
    const enabledSnapshot = await readSnapshot(page);
    results.lifecycle = {
      disableReceivesClick: disableClick.receivesClick,
      disabledMilliseconds,
      disabledState: disabledSnapshot.state?.state,
      disabledRootRemoved: disabledSnapshot.mediaCount === 0,
      enabledMilliseconds,
      enabledState: enabledSnapshot.state?.state,
      enabledLayers: enabledSnapshot.state?.backgroundLayers,
      enabledPlayers: enabledSnapshot.state?.playerCount,
    };
    results.secondaryPages = await inspectSecondaryPages(port);
    results.finalState = await readSnapshot(page);
    results.completedAt = new Date().toISOString();
    return results;
  } finally {
    await evaluate(
      page,
      `(() => {
        localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(
          initialConfig
        )});
        return true;
      })()`
    ).catch(() => {});
    await evaluate(page, "globalThis.__codexWallpaperApi?.refresh?.()").catch(
      () => {}
    );
    page.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const [portValue, initialConfigPath, outputPath] = process.argv.slice(2);
  const port = Number(portValue);
  if (!Number.isInteger(port) || !initialConfigPath || !outputPath) {
    console.error(
      "Usage: node real-functional-acceptance.mjs <cdp-port> <initial-config> <output-json>"
    );
    process.exit(1);
  }
  const results = await runFunctionalAcceptance({
    port,
    initialConfigPath,
  });
  await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(results, null, 2));
}
