import { access, readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createSteamDiscoveryKit } from "./vendor/dsh-wallpaper-engine/steam-discovery.js";
import { createWallpaperScanKit } from "./vendor/dsh-wallpaper-engine/wallpaper-scan.js";

const WE_APPID = "431960";
const defaultPreviewLimitBytes = 384 * 1024;
const imageLimitBytes = 8 * 1024 * 1024;
const videoLimitBytes = 16 * 1024 * 1024;
const sceneLimitBytes = 64 * 1024 * 1024;
const webHtmlLimitBytes = 512 * 1024;

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function extOf(path) {
  return extname(String(path)).toLowerCase();
}

function schemeToCss(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return `rgb(${parts.map((part) => Math.round(part * 255)).join(" ")})`;
}

function mediaType(path) {
  const ext = extOf(path);
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function dataUrl(path, limit) {
  if (!path) return null;
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > limit) return null;
    const bytes = await readFile(path);
    return {
      url: `data:${mediaType(path)};base64,${bytes.toString("base64")}`,
      size: info.size,
    };
  } catch {
    return null;
  }
}

function publicEntry(entry) {
  return {
    id: String(entry.id),
    title: String(entry.title || entry.id),
    type: entry.type,
    contentrating: entry.contentrating || null,
    schemeColor: entry.schemeColor || null,
    playable: Boolean(entry.assetDataUrl),
    fallback: Boolean(entry.previewDataUrl),
    previewDataUrl: entry.previewDataUrl || null,
    assetDataUrl: entry.assetDataUrl || null,
    webHtml: entry.webHtml || null,
    reason:
      entry.type === "scene"
        ? entry.assetDataUrl
          ? "scene-native"
          : "scene-preview-fallback"
        : entry.type === "web"
          ? entry.webHtml
            ? "web-offline"
            : "web-preview-fallback"
          : entry.playable
            ? null
            : "asset-too-large-or-missing",
  };
}

export async function scanWallpaperLibrary({
  installDir = null,
  libraryDirs = null,
  previewLimit = 200,
  previewLimitBytes = defaultPreviewLimitBytes,
  assetIds = [],
  assetLimit = 4,
  assetBudget = 16 * 1024 * 1024,
} = {}) {
  let resolvedInstallDir = installDir;
  let resolvedLibraryDirs = libraryDirs;
  if (!resolvedInstallDir || !resolvedLibraryDirs) {
    const discovery = createSteamDiscoveryKit({
      WE_APPID,
      pathExistsP: pathExists,
    });
    resolvedInstallDir ??= await discovery.locateWallpaperEngineP();
    resolvedLibraryDirs ??= await discovery.owningLibrariesP();
  }

  if (!resolvedInstallDir) {
    return { entries: [], installAvailable: false };
  }

  const scan = createWallpaperScanKit({
    WE_APPID,
    pathExistsP: pathExists,
    isFileP: isFile,
    isDirectoryP: isDirectory,
    extOf,
    schemeToCss,
  });
  const projects = await scan.enumerateWallpapersAsync(
    resolvedInstallDir,
    resolvedLibraryDirs
  );

  const entries = [];
  let assetsLeft = Math.max(0, assetLimit);
  let assetBytesLeft = Math.max(0, assetBudget);
  const requestedAssets = new Set(assetIds);
  for (const project of projects) {
    if (!(await isFile(project.fileAbs))) continue;
    const preview = await dataUrl(project.previewAbs, previewLimitBytes);
    const perEntryLimit =
      project.type === "image"
        ? imageLimitBytes
        : project.type === "video"
          ? videoLimitBytes
          : project.type === "scene"
            ? sceneLimitBytes
            : 0;
    let asset = null;
    if (
      perEntryLimit > 0 &&
      (requestedAssets.has(String(project.id)) || assetsLeft > 0)
    ) {
      const candidate = await dataUrl(
        project.fileAbs,
        Math.min(perEntryLimit, assetBytesLeft)
      );
      if (candidate) {
        asset = candidate;
        assetBytesLeft -= candidate.size;
        assetsLeft -= 1;
      }
    }
    let webHtml = null;
    if (project.type === "web") {
      try {
        const candidate = await dataUrl(project.fileAbs, webHtmlLimitBytes);
        if (candidate) {
          const encoded = candidate.url.split(",", 2)[1];
          webHtml = Buffer.from(encoded, "base64").toString("utf8");
        }
      } catch {
        webHtml = null;
      }
    }
    entries.push(
      publicEntry({
        ...project,
        previewDataUrl: preview?.url || null,
        assetDataUrl: asset?.url || null,
        webHtml,
      })
    );
  }

  let previewsLeft = Math.max(0, previewLimit);
  for (const entry of entries) {
    if (previewsLeft > 0 && entry.previewDataUrl) previewsLeft -= 1;
    else if (entry.previewDataUrl) {
      entry.previewDataUrl = null;
      entry.fallback = false;
      if (entry.type === "scene" && !entry.playable)
        entry.reason = "scene-unavailable";
      if (entry.type === "web" && !entry.webHtml)
        entry.reason = "web-unavailable";
    }
  }

  return {
    entries,
    installAvailable: true,
  };
}

export async function loadWallpaperAsset(id) {
  const result = await scanWallpaperLibrary({
    assetIds: [String(id)],
    assetLimit: 0,
    assetBudget: 64 * 1024 * 1024,
    previewLimit: 0,
  });
  return result.entries.find((entry) => entry.id === String(id)) || null;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const result = await scanWallpaperLibrary();
  console.log(JSON.stringify(result));
}
