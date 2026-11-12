import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { applyStaticBackground, evaluateInPage } from "./static-background.mjs";

const edge =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const rootId = "codex-wallpaper-p1";

async function startFixture() {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html>
      <html data-theme="dark">
      <title>wallpaper fixture</title>
      <style>
        :root {
          --app-color-background-surface: rgb(24 24 28);
          --app-color-background-surface-under: rgb(12 12 16);
          color-scheme: dark;
        }
        :root[data-theme="light"] {
          --app-color-background-surface: rgb(247 247 249);
          --app-color-background-surface-under: rgb(232 232 237);
          color-scheme: light;
        }
        body { margin: 0; min-height: 1200px; color: rgb(245 245 250); }
        [data-app-shell-main-surface] { min-height: 100vh; background: transparent; }
        [data-testid="webmcp-tool-scroll"] { display: block; padding: 24px; }
        [data-testid="diff-preview-scroll"] { display: block; padding: 24px; }
        [data-composer-surface-variant] { display: block; padding: 24px; }
      </style>
      <div data-app-shell-main-surface>
        <main>
          <article id="message" data-markdown-text-style="assistant-message">
            ${"Long assistant response ".repeat(40)}
          </article>
          <section data-testid="webmcp-tool-scroll" class="bg-surface">
            <button id="tool-action" type="button">Toggle tool</button>
            <div id="tool-details">Tool details</div>
          </section>
          <section data-testid="diff-preview-scroll">
            <pre><code id="code">const visible = true;</code></pre>
          </section>
          <form data-composer-surface-variant="inline">
            <textarea id="composer">Composer text</textarea>
          </form>
        </main>
      </div>
      <aside data-app-shell-page-sidebar><button id="project-action">Project</button></aside>
      <aside data-app-shell-trailing-sidebar><pre id="terminal">terminal</pre></aside>
      <div data-app-shell-pane-content-viewport><pre id="editor">editor</pre></div>
      <section role="dialog" id="settings-dialog"><button id="dialog-action">Dialog</button></section>
      </html>`
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}/`,
  };
}

async function waitForPort(profile) {
  const file = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
      return Number(port);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Edge did not expose CDP");
}

async function waitForPage(port, options) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const href = await evaluateInPage(port, "location.href", options);
    if (href === options.page) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Edge did not load the fixture page");
}

test("static background is single, removable and persists disabled", async (t) => {
  const fixture = await startFixture();
  const profile = await mkdtemp(join(tmpdir(), "codex-wallpaper-edge-"));
  const browser = spawn(
    edge,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--no-proxy-server",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      fixture.url,
    ],
    { stdio: "ignore" }
  );
  t.after(async () => {
    await new Promise((resolve) => {
      if (browser.exitCode !== null) resolve();
      else {
        browser.once("exit", resolve);
        browser.kill();
      }
    });
    await new Promise((resolve) => fixture.server.close(resolve));
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });
  const port = await waitForPort(profile);
  const options = {
    page: fixture.url,
    origin: new URL(fixture.url).origin,
    payload: {
      version: 1,
      library: [
        {
          id: "fixture-image",
          title: "Fixture Image",
          type: "image",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E",
          assetDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%235d32b8'/%3E%3C/svg%3E",
          reason: null,
        },
        {
          id: "fixture-scene",
          title: "Fixture Scene",
          type: "scene",
          playable: true,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: "data:application/octet-stream;base64,AA==",
          reason: "scene-native",
        },
        {
          id: "fixture-web",
          title: "Fixture Web",
          type: "web",
          playable: false,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: null,
          webHtml:
            "<!doctype html><style>body{margin:0;background:linear-gradient(45deg,#123,#abc)}</style>",
          reason: "web-offline",
        },
        {
          id: "fixture-lazy",
          title: "Fixture Lazy",
          type: "image",
          playable: false,
          fallback: true,
          previewDataUrl:
            "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
          assetDataUrl: null,
          reason: "asset-not-loaded",
        },
      ],
    },
  };
  await waitForPage(port, options);

  assert.deepEqual(
    await evaluateInPage(
      port,
      "({ href: location.href, origin: location.origin, ready: document.readyState })",
      options
    ),
    {
      href: fixture.url,
      origin: new URL(fixture.url).origin,
      ready: "complete",
    }
  );
  await assert.rejects(
    applyStaticBackground(port, { ...options, page: `${fixture.url}other` }),
    /Main page not uniquely available/
  );
  await evaluateInPage(
    port,
    `(() => {
      globalThis.WebWallGL = {
        bytesSource: () => ({}),
        createScene: () => ({
          load: async () => {
            globalThis.__sceneLoaded = true;
          },
          pause: () => {
            globalThis.__scenePaused = true;
          },
          resume: () => {
            globalThis.__sceneResumed = true;
          },
          setFps: (fps) => {
            globalThis.__sceneFps = fps;
          },
          setVolume: (volume) => {
            globalThis.__sceneVolume = volume;
          },
          destroy() {}
        })
      };
    })()`,
    options
  );
  const initial = await applyStaticBackground(port, options);
  assert.equal(initial.state, "enabled");
  assert.equal(initial.backgroundLayers, 1);
  assert.equal(initial.styles, 1);
  assert.equal(initial.libraryCount, 4);
  assert.equal(initial.volume, 0);
  assert.equal(initial.fpsCap, 30);
  assert.equal(initial.visible, true);
  assert.ok(initial.controls >= 2);
  assert.deepEqual(
    await evaluateInPage(
      port,
      `document.querySelector("#${rootId} [data-codex-wallpaper-settings]").click(),
       (() => {
         const panel = document.querySelector("#${rootId} [data-codex-wallpaper-panel]");
         return {
           open: panel.classList.contains("open"),
           cards: panel.querySelectorAll(".card").length
         };
       })()`,
      options
    ),
    { open: true, cards: 4 }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        globalThis.__codexWallpaperHostRequest = (raw) => {
          const request = JSON.parse(raw);
          if (request.type !== "load-asset") return;
          setTimeout(
            () => globalThis.__codexWallpaperApi.receiveAsset({
              id: request.id,
              title: "Fixture Lazy",
              type: "image",
              playable: true,
              fallback: true,
              previewDataUrl:
                "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/%3E",
              assetDataUrl:
                "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9'%3E%3Crect width='16' height='9' fill='%23123456'/%3E%3C/svg%3E",
              reason: null
            }),
            0
          );
        };
        const root = document.getElementById("${rootId}");
        const lazyCard = [...root.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Lazy"
        );
        lazyCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 80));
        return {
          active: globalThis.__codexWallpaperApi.state().activeId,
          rendered:
            root.querySelector("[data-codex-wallpaper-layer] img") instanceof
            HTMLImageElement
        };
      })()`,
      options
    ),
    { active: "fixture-lazy", rendered: true }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const sceneCard = [...root.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Scene"
        );
        sceneCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 80));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible"
        });
        document.dispatchEvent(new Event("visibilitychange"));
        const ranges = root.querySelectorAll(".range input");
        ranges[3].value = "15";
        ranges[3].dispatchEvent(new Event("input", { bubbles: true }));
        ranges[4].value = "40";
        ranges[4].dispatchEvent(new Event("input", { bubbles: true }));
        return {
          loaded: globalThis.__sceneLoaded,
          paused: globalThis.__scenePaused,
          resumed: globalThis.__sceneResumed,
          fps: globalThis.__sceneFps,
          volume: globalThis.__sceneVolume
        };
      })()`,
      options
    ),
    { loaded: true, paused: true, resumed: true, fps: 15, volume: 0.4 }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const webCard = [...root.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Web"
        );
        webCard.querySelector(".card-actions button").click();
        await new Promise((resolve) => setTimeout(resolve, 40));
        const frame = root.querySelector("[data-codex-wallpaper-layer] iframe");
        return {
          sandbox: frame.getAttribute("sandbox"),
          offlineDocument: frame.srcdoc.includes("linear-gradient"),
          networkBlocked: frame.srcdoc.includes("default-src 'none'")
        };
      })()`,
      options
    ),
    {
      sandbox: "allow-scripts",
      offlineDocument: true,
      networkBlocked: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const imageCard = [...root.querySelectorAll(".card")].find(
          (card) => card.querySelector("strong")?.textContent === "Fixture Image"
        );
        imageCard.querySelector(".card-actions button").click();
        imageCard.querySelectorAll(".card-actions button")[1].click();
        imageCard.querySelectorAll(".card-actions button")[2].click();
        const opacity = root.querySelectorAll(".range input")[2];
        opacity.value = "66";
        opacity.dispatchEvent(new Event("input", { bubbles: true }));
        const input = root.querySelector(".import-row input");
        const transfer = new DataTransfer();
        transfer.items.add(
          new File(
            ["<svg xmlns='http://www.w3.org/2000/svg' width='16' height='9'/>"],
            "Imported.svg",
            { type: "image/svg+xml" }
          )
        );
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (globalThis.__codexWallpaperApi.state().importedCount > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          imageVisible:
            root.querySelector("[data-codex-wallpaper-layer] img") instanceof
            HTMLImageElement,
          favorite: saved.favorites.length,
          playlist: saved.playlist.length,
          opacity: saved.settings.opacity,
          imported: globalThis.__codexWallpaperApi.state().importedCount,
          importedActive: saved.active.kind === "imported"
        };
      })()`,
      options
    ),
    {
      imageVisible: true,
      favorite: 1,
      playlist: 1,
      opacity: 66,
      imported: 1,
      importedActive: true,
    }
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        const root = document.getElementById("${rootId}");
        const reset = root.querySelector(".reset");
        reset.click();
        reset.click();
        for (let attempt = 0; attempt < 40; attempt += 1) {
          if (globalThis.__codexWallpaperApi.state().importedCount === 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const saved = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        return {
          activeKind: saved.active.kind,
          imported: globalThis.__codexWallpaperApi.state().importedCount,
          state: globalThis.__codexWallpaperApi.state().state,
          root: document.querySelectorAll("#${rootId}").length
        };
      })()`,
      options
    ),
    { activeKind: "builtin", imported: 0, state: "disabled", root: 0 }
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const root = document.getElementById("${rootId}");
        const background = root.querySelector("[data-codex-wallpaper-layer]");
        const surface = document.querySelector("[data-app-shell-main-surface]");
        const tool = document.querySelector("#tool-action");
        const details = document.querySelector("#tool-details");
        const toolSurface = tool.closest("[data-testid='webmcp-tool-scroll']");
        const diffSurface = document.querySelector(
          "[data-testid='diff-preview-scroll']"
        );
        const codeSurface = document.querySelector("pre");
        const composerSurface = document.querySelector(
          "[data-composer-surface-variant]"
        );
        const leftPanel = document.querySelector("[data-app-shell-page-sidebar]");
        const rightPanel = document.querySelector(
          "[data-app-shell-trailing-sidebar]"
        );
        const pane = document.querySelector(
          "[data-app-shell-pane-content-viewport]"
        );
        const dialog = document.querySelector("#settings-dialog");
        const dialogAction = document.querySelector("#dialog-action");
        dialogAction.focus();
        const dialogHasFocus = document.activeElement === dialogAction;
        tool.addEventListener("click", () => {
          details.hidden = !details.hidden;
        });
        tool.scrollIntoView({ block: "center" });
        const rect = tool.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
        const toolInitiallyHidden = details.hidden;
        hit.click();
        let toolToggleWorked = details.hidden !== toolInitiallyHidden;
        hit.click();
        toolToggleWorked &&= details.hidden === toolInitiallyHidden;
        const composer = document.querySelector("#composer");
        composer.focus();
        composer.setSelectionRange(0, 8);
        let keyboardWorked = false;
        composer.addEventListener("keydown", (event) => {
          keyboardWorked = event.key === "a";
        });
        composer.dispatchEvent(
          new KeyboardEvent("keydown", { key: "a", bubbles: true })
        );
        const range = document.createRange();
        range.selectNodeContents(document.querySelector("#message"));
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const streamed = document.createElement("p");
        streamed.id = "streamed-message";
        streamed.textContent = "Streamed response";
        document.querySelector("#message").append(streamed);
        streamed.scrollIntoView({ block: "center" });
        const themeBases = ["dark", "light"].map((theme) => {
          document.documentElement.dataset.theme = theme;
          return [surface, toolSurface, diffSurface, codeSurface, composerSurface]
            .every(
              (element) =>
                getComputedStyle(element).backgroundColor !==
                "rgba(0, 0, 0, 0)"
            );
        });
        return {
          surfaceAboveBackground:
            Number.parseInt(getComputedStyle(surface).zIndex, 10) >
            Number.parseInt(getComputedStyle(background).zIndex, 10),
          surfaceHasReadabilityBase:
            getComputedStyle(surface).backgroundColor !== "rgba(0, 0, 0, 0)",
          contentHasReadabilityBases: [
            toolSurface,
            diffSurface,
            codeSurface,
            composerSurface
          ].every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
              "rgba(0, 0, 0, 0)"
          ),
          themesHaveReadabilityBases: themeBases.every(Boolean),
          panelSurfacesHaveReadability: [
            leftPanel,
            rightPanel,
            pane,
            dialog
          ].every(
            (element) =>
              getComputedStyle(element).backgroundColor !==
                "rgba(0, 0, 0, 0)" &&
              Number.parseInt(getComputedStyle(element).zIndex, 10) >= 1
          ),
          dialogHasFocus,
          backgroundIgnoresPointers:
            getComputedStyle(background).pointerEvents === "none",
          toolReceivesClick: hit === tool && toolToggleWorked,
          composerHasFocus: document.activeElement === composer,
          messageIsSelectable: selection.toString().startsWith("Long assistant response"),
          keyboardReachesComposer: keyboardWorked,
          pageScrolled: scrollY > 0,
          streamedMessageIsHitTestable:
            document.elementFromPoint(
              streamed.getBoundingClientRect().left + 1,
              streamed.getBoundingClientRect().top + 1
            ) === streamed
        };
      })()`,
      options
    ),
    {
      surfaceAboveBackground: true,
      surfaceHasReadabilityBase: true,
      contentHasReadabilityBases: true,
      themesHaveReadabilityBases: true,
      panelSurfacesHaveReadability: true,
      dialogHasFocus: true,
      backgroundIgnoresPointers: true,
      toolReceivesClick: true,
      composerHasFocus: true,
      messageIsSelectable: true,
      keyboardReachesComposer: true,
      pageScrolled: true,
      streamedMessageIsHitTestable: true,
    }
  );
  assert.equal(
    (await applyStaticBackground(port, options)).backgroundLayers,
    1
  );
  await evaluateInPage(
    port,
    `document.querySelector("#${rootId} [data-codex-wallpaper-toggle]").click()`,
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({ root: document.querySelectorAll("#${rootId}").length, styles: document.querySelectorAll("#${rootId}-style").length })`,
      options
    ),
    { root: 0, styles: 0 }
  );
  const disabled = await applyStaticBackground(port, options);
  assert.equal(disabled.state, "disabled");
  assert.equal(disabled.backgroundLayers, 0);
  assert.equal(disabled.styles, 0);
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.equal(
    (await applyStaticBackground(port, options)).backgroundLayers,
    1
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({ root: document.querySelectorAll("#${rootId}").length, styles: document.querySelectorAll("#${rootId}-style").length })`,
      options
    ),
    { root: 0, styles: 0 }
  );
  await evaluateInPage(
    port,
    'dispatchEvent(new KeyboardEvent("keydown", { altKey: true, shiftKey: true, code: "KeyW" }))',
    options
  );
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const value = JSON.parse(
          localStorage.getItem("codex-wallpaper-p1-config")
        );
        value.enabled = false;
        const next = JSON.stringify(value);
        localStorage.setItem("codex-wallpaper-p1-config", next);
        dispatchEvent(
          new StorageEvent("storage", {
            key: "codex-wallpaper-p1-config",
            newValue: next,
            storageArea: localStorage
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      })()`,
      options
    ),
    true
  );
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(
    await evaluateInPage(
      port,
      `({ root: document.querySelectorAll("#${rootId}").length, styles: document.querySelectorAll("#${rootId}-style").length })`,
      options
    ),
    { root: 0, styles: 0 }
  );
});
