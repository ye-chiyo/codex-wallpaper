import { access, readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createSteamDiscoveryKit } from "./vendor/dsh-wallpaper-engine/steam-discovery.js";
import { createWallpaperScanKit } from "./vendor/dsh-wallpaper-engine/wallpaper-scan.js";

const WE_APPID = "431960";
const defaultPreviewLimitBytes = 2 * 1024 * 1024;
const imageLimitBytes = 16 * 1024 * 1024;
const videoLimitBytes = 256 * 1024 * 1024;
const sceneLimitBytes = 256 * 1024 * 1024;
const webHtmlLimitBytes = 512 * 1024;
const transferLimitBytes = 512 * 1024 * 1024;
const projectCacheTtlMs = 5000;
let defaultProjectsCache = null;
let defaultProjectsCachedAt = 0;
let defaultProjectsPromise = null;

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

function createScanKit() {
  return createWallpaperScanKit({
    WE_APPID,
    pathExistsP: pathExists,
    isFileP: isFile,
    isDirectoryP: isDirectory,
    extOf,
    schemeToCss,
  });
}

async function scanProjects(installDir, libraryDirs) {
  return createScanKit().enumerateWallpapersAsync(installDir, libraryDirs);
}

async function discoverProjects() {
  const discovery = createSteamDiscoveryKit({
    WE_APPID,
    pathExistsP: pathExists,
  });
  const installDir = await discovery.locateWallpaperEngineP();
  if (!installDir) return null;
  return scanProjects(installDir, await discovery.owningLibrariesP());
}

async function readWebHtml(path) {
  const candidate = await dataUrl(path, webHtmlLimitBytes);
  return candidate
    ? Buffer.from(candidate.url.split(",", 2)[1], "base64").toString("utf8")
    : null;
}

function mediaReason(
  type,
  { playable, webHtml, fallbackReason = "asset-too-large-or-missing" }
) {
  if (type === "scene")
    return playable ? "scene-native" : "scene-preview-fallback";
  if (type === "web") return webHtml ? "web-offline" : "web-preview-fallback";
  return playable ? null : fallbackReason;
}

async function enumerateProjects({
  installDir = null,
  libraryDirs = null,
} = {}) {
  const useDefault = !installDir && !libraryDirs;
  if (
    useDefault &&
    defaultProjectsCache &&
    Date.now() - defaultProjectsCachedAt < projectCacheTtlMs
  )
    return defaultProjectsCache;
  if (useDefault && defaultProjectsPromise) return defaultProjectsPromise;
  if (useDefault) {
    defaultProjectsPromise = discoverProjects()
      .then((projects) => {
        if (projects) {
          defaultProjectsCache = projects;
          defaultProjectsCachedAt = Date.now();
        }
        return projects;
      })
      .finally(() => {
        defaultProjectsPromise = null;
      });
    return defaultProjectsPromise;
  }
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
  if (!resolvedInstallDir) return null;
  return scanProjects(resolvedInstallDir, resolvedLibraryDirs);
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
    reason: mediaReason(entry.type, {
      playable: Boolean(entry.assetDataUrl),
      webHtml: entry.webHtml,
    }),
  };
}

export async function scanWallpaperLibrary({
  installDir = null,
  libraryDirs = null,
  previewLimit = 200,
  previewLimitBytes = defaultPreviewLimitBytes,
  assetLimit = 4,
  assetBudget = 16 * 1024 * 1024,
} = {}) {
  const projects = await enumerateProjects({ installDir, libraryDirs });
  if (!projects) {
    return { entries: [], installAvailable: false };
  }

  const entries = [];
  let assetsLeft = Math.max(0, assetLimit);
  let assetBytesLeft = Math.max(0, assetBudget);
  for (const project of projects) {
    if (!(await isFile(project.fileAbs))) continue;
    const preview =
      previewLimit > 0
        ? await dataUrl(project.previewAbs, previewLimitBytes)
        : null;
    const perEntryLimit =
      project.type === "image"
        ? imageLimitBytes
        : project.type === "video"
          ? videoLimitBytes
          : project.type === "scene"
            ? sceneLimitBytes
            : 0;
    let asset = null;
    if (perEntryLimit > 0 && assetsLeft > 0) {
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
      webHtml = await readWebHtml(project.fileAbs);
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

export async function loadWallpaperPreview(
  id,
  { installDir = null, libraryDirs = null } = {}
) {
  const projects = await enumerateProjects({ installDir, libraryDirs });
  const project = projects?.find((entry) => String(entry.id) === String(id));
  const preview = await dataUrl(project?.previewAbs, defaultPreviewLimitBytes);
  return preview
    ? {
        id: String(id),
        previewDataUrl: preview.url,
        fallback: true,
      }
    : null;
}

export async function prepareWallpaperAsset(
  id,
  { installDir = null, libraryDirs = null } = {}
) {
  const projects = await enumerateProjects({ installDir, libraryDirs });
  const project = projects?.find((entry) => String(entry.id) === String(id));
  if (!project?.fileAbs) return null;
  try {
    const info = await stat(project.fileAbs);
    if (!info.isFile()) return null;
    const preview = await dataUrl(project.previewAbs, defaultPreviewLimitBytes);
    const webHtml =
      project.type === "web" ? await readWebHtml(project.fileAbs) : null;
    const playable = project.type !== "web" && info.size <= transferLimitBytes;
    return {
      id: String(project.id),
      title: String(project.title || project.id),
      type: project.type,
      contentrating: project.contentrating || null,
      schemeColor: project.schemeColor || null,
      playable,
      fallback: Boolean(preview),
      previewDataUrl: preview?.url || null,
      assetDataUrl: null,
      assetUrl: null,
      webHtml,
      reason: mediaReason(project.type, {
        playable,
        webHtml,
        fallbackReason: "asset-too-large",
      }),
      path: project.fileAbs,
      mime: mediaType(project.fileAbs),
      size: info.size,
    };
  } catch {
    return null;
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const result = await scanWallpaperLibrary();
  console.log(JSON.stringify(result));
}
