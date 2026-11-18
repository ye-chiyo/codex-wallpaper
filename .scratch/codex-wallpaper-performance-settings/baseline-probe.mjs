import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { openMainPageSession } from "../../launcher/read-only-probe.mjs";

function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function idHash(value) {
  return value ? fingerprint(value).slice(0, 16) : null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mediaState(value) {
  const text = String(value || "").toLowerCase();
  const type = text.match(/\b(image|video|scene|web)\b/)?.[1] || "unknown";
  const modes = ["on-demand", "native", "offline", "fallback", "missing"];
  return [type, ...modes.filter((mode) => text.includes(mode))].join(":");
}

export function sanitizeBaselineSnapshot(raw) {
  const settings = raw?.config?.settings || {};
  const selectedSettings = Object.fromEntries(
    ["dim", "blur", "opacity", "fps", "volume", "rotationMinutes"].map(
      (key) => [key, number(settings[key])]
    )
  );
  const viewport = raw?.viewport || raw?.size || {};
  return {
    viewport: {
      width: number(viewport.width),
      height: number(viewport.height),
      dpr: number(viewport.dpr ?? viewport.devicePixelRatio),
    },
    theme: ["light", "dark"].includes(raw?.theme) ? raw.theme : null,
    visibilityState: raw?.visibilityState === "hidden" ? "hidden" : "visible",
    config: {
      enabled: Boolean(raw?.config?.enabled),
      active: {
        kind: String(raw?.config?.active?.kind || "unknown"),
        idHash: idHash(raw?.config?.active?.id),
      },
      favoriteCount: Array.isArray(raw?.config?.favorites)
        ? raw.config.favorites.length
        : 0,
      playlistCount: Array.isArray(raw?.config?.playlist)
        ? raw.config.playlist.length
        : 0,
      settings: selectedSettings,
    },
    runtimeState: raw?.runtimeState
      ? {
          state: String(raw.runtimeState.state || "unknown"),
          activeKind: String(raw.runtimeState.activeKind || "unknown"),
          activeIdHash: idHash(raw.runtimeState.activeId),
          playerCount: number(raw.runtimeState.playerCount),
          backgroundLayers: number(raw.runtimeState.backgroundLayers),
          styles: number(raw.runtimeState.styles),
          libraryCount: number(raw.runtimeState.libraryCount),
          importedCount: number(raw.runtimeState.importedCount),
          visible: Boolean(raw.runtimeState.visible),
          measuredFps: number(raw.runtimeState.measuredFps),
          fpsCap: number(raw.runtimeState.fpsCap),
          volume: number(raw.runtimeState.volume),
          hostReady: Boolean(raw.runtimeState.hostReady),
        }
      : null,
    runtimeIdentity: raw?.runtimeIdentity
      ? {
          runtimeHash: String(raw.runtimeIdentity.runtimeHash || ""),
          styleHash: String(raw.runtimeIdentity.styleHash || ""),
        }
      : null,
    activeMedia: (raw?.activeMedia || []).map((media) => ({
      className: String(media.className || ""),
      children: (media.children || []).map((child) => ({
        tagName: String(child.tagName || "").toLowerCase(),
        className: String(child.className || ""),
        width: number(child.width),
        height: number(child.height),
        videoWidth: number(child.videoWidth),
        videoHeight: number(child.videoHeight),
        duration: number(child.duration),
        currentTime: number(child.currentTime),
        paused: Boolean(child.paused),
        readyState: number(child.readyState),
        srcType: child.srcType ? String(child.srcType) : null,
      })),
    })),
    cards: (raw?.cards || []).map((card) => ({
      kind: String(card.kind || "unknown"),
      idHash: idHash(card.id),
      state: mediaState(card.meta),
      selected: card.selected === "true",
    })),
  };
}

async function evaluate(session, expression) {
  const result = await session.send("Runtime.evaluate", {
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

export async function captureSnapshot(port) {
  const session = await openMainPageSession(port, "app://-/index.html", true);
  try {
    const snapshot = await evaluate(
      session,
      `(() => {
        const style = document.getElementById("codex-wallpaper-p1-style");
        let config = null;
        try {
          config = JSON.parse(
            localStorage.getItem("codex-wallpaper-p1-config") || "null"
          );
        } catch {}
        return {
          theme: document.documentElement.dataset.theme,
          viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
          visibilityState: document.visibilityState,
          styleText: style?.textContent || null,
          runtimeState: globalThis.__codexWallpaperApi?.state?.() || null,
          runtimeIdentity:
            globalThis.__codexWallpaperApi?.identity?.() || null,
          config,
          activeMedia: [...document.querySelectorAll(
            "#codex-wallpaper-p1 .media:not(.staged)"
          )].map((media) => ({
            className: media.className,
            children: [...media.children].map((child) => ({
              tagName: child.tagName,
              className: child.className,
              width: child.width,
              height: child.height,
              videoWidth: child.videoWidth,
              videoHeight: child.videoHeight,
              duration: child.duration,
              currentTime: child.currentTime,
              paused: child.paused,
              readyState: child.readyState,
              srcType: child.src?.split(":")[0] || null,
            })),
          })),
          cards: [...document.querySelectorAll(
            "#codex-wallpaper-p1-controls .card"
          )].map((card) => ({
            kind: card.dataset.entryKind,
            id: card.dataset.entryId,
            title: card.querySelector("strong")?.textContent || "",
            meta: card.querySelector("small")?.textContent || "",
            selected: card.dataset.selected,
          })),
        };
      })()`
    );
    const styleHash = snapshot.styleText
      ? fingerprint(snapshot.styleText)
      : null;
    const styleLength = snapshot.styleText?.length || 0;
    delete snapshot.styleText;
    return {
      capturedAt: new Date().toISOString(),
      styleHash,
      styleLength,
      ...sanitizeBaselineSnapshot(snapshot),
    };
  } finally {
    session.close();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error("Usage: node baseline-probe.mjs <cdp-port>");
    process.exit(1);
  }
  console.log(JSON.stringify(await captureSnapshot(port), null, 2));
}
