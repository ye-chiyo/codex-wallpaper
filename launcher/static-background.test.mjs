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
      </div></html>`
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
  const options = { page: fixture.url, origin: new URL(fixture.url).origin };
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
  assert.deepEqual(await applyStaticBackground(port, options), {
    state: "enabled",
    backgroundLayers: 1,
    controls: 1,
    styles: 1,
  });
  assert.deepEqual(
    await evaluateInPage(
      port,
      `(() => {
        const root = document.getElementById("${rootId}");
        const background = root.querySelector("[data-codex-wallpaper-background]");
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
    `document.querySelector("#${rootId} button").click()`,
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
  assert.deepEqual(await applyStaticBackground(port, options), {
    state: "disabled",
    backgroundLayers: 0,
    controls: 0,
    styles: 0,
  });
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
});
