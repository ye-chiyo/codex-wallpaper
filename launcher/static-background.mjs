import { pathToFileURL } from "node:url";
import { callMainPage } from "./read-only-probe.mjs";

const defaultPage = "app://-/index.html";
const rootId = "codex-wallpaper-p1";
const styleId = "codex-wallpaper-p1-style";
const disabledKey = "codex-wallpaper-p1-disabled";

function expression(action) {
  return `(() => {
    const rootId = ${JSON.stringify(rootId)};
    const styleId = ${JSON.stringify(styleId)};
    const disabledKey = ${JSON.stringify(disabledKey)};
    const state = () => ({
      state: localStorage.getItem(disabledKey) === "1" ? "disabled" : "enabled",
      backgroundLayers: document.querySelectorAll("#" + rootId + " [data-codex-wallpaper-background]").length,
      controls: document.querySelectorAll("#" + rootId + " button").length,
      styles: document.querySelectorAll("#" + styleId).length
    });
    const registerHotkey = () => {
      if (globalThis.__codexWallpaperHotkey) return;
      globalThis.__codexWallpaperHotkey = (event) => {
        if (!event.altKey || !event.shiftKey || event.code !== "KeyW") return;
        if (localStorage.getItem(disabledKey) === "1") enable(true);
        else disable();
      };
      addEventListener("keydown", globalThis.__codexWallpaperHotkey);
    };
    const enable = (force = false) => {
      registerHotkey();
      if (!force && localStorage.getItem(disabledKey) === "1") {
        return state();
      }
      localStorage.setItem(disabledKey, "0");
      if (document.getElementById(rootId)) return state();
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "#" + rootId + " { position: fixed; inset: 0; pointer-events: none; }",
        "#" + rootId + " [data-codex-wallpaper-background] { position: fixed; inset: 0; z-index: 0; opacity: .24; mix-blend-mode: soft-light; background: radial-gradient(circle at 18% 20%, #57d7ff 0, transparent 36%), radial-gradient(circle at 82% 78%, #ff9ac6 0, transparent 38%), linear-gradient(135deg, #1b2ab5, #5d32b8 48%, #d44c87); }",
        "body :where([data-app-shell-main-surface], [data-app-shell-page-surface]) { position: relative; z-index: 1; background-color: color-mix(in srgb, var(--app-color-background-surface, rgb(24 24 28)) 88%, transparent) !important; backdrop-filter: blur(10px) saturate(.85); }",
        "body :is([data-app-shell-main-surface], [data-app-shell-page-surface]) :where([class~='bg-surface'], [data-testid='diff-preview-scroll'], [data-composer-surface-variant], pre) { background-color: color-mix(in srgb, var(--app-color-background-surface-under, rgb(12 12 16)) 92%, transparent) !important; }",
        "#" + rootId + " button { position: fixed; right: 14px; bottom: 14px; z-index: 2147483647; padding: 7px 11px; border: 1px solid rgb(255 255 255 / .32); border-radius: 999px; background: rgb(20 20 24 / .78); color: white; font: 12px/1.2 system-ui, sans-serif; cursor: pointer; pointer-events: auto; }"
      ].join("\\n");
      const root = document.createElement("div");
      root.id = rootId;
      const background = document.createElement("div");
      background.dataset.codexWallpaperBackground = "";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "停用壁纸 (Alt+Shift+W)";
      button.addEventListener("click", disable);
      root.append(background, button);
      document.documentElement.append(style, root);
      return state();
    };
    const disable = () => {
      registerHotkey();
      localStorage.setItem(disabledKey, "1");
      document.getElementById(rootId)?.remove();
      document.getElementById(styleId)?.remove();
      return state();
    };
    return ${JSON.stringify(action)} === "disable" ? disable() : enable();
  })()`;
}

async function evaluate(port, page, source) {
  const result = await callMainPage(
    port,
    "Runtime.evaluate",
    { expression: source, returnByValue: true },
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

export async function applyStaticBackground(port, options = {}) {
  const resolved = {
    page: options.page ?? defaultPage,
    action: options.action ?? "enable",
  };
  const result = await evaluate(
    port,
    resolved.page,
    expression(resolved.action)
  );
  if (!result || result.state === undefined)
    throw new Error("Missing wallpaper state");
  return result;
}

export async function evaluateInPage(port, source, options = {}) {
  return evaluate(port, options.page ?? defaultPage, source);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const port = Number(process.argv[2]);
  const action = process.argv[3] === "disable" ? "disable" : "enable";
  try {
    const result = await applyStaticBackground(port, { action });
    console.log(JSON.stringify(result));
  } catch {
    process.exitCode = 1;
  }
}
