import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createSteamDiscoveryKit } from "./vendor/dsh-wallpaper-engine/steam-discovery.js";
import { createWallpaperScanKit } from "./vendor/dsh-wallpaper-engine/wallpaper-scan.js";

const WE_APPID = "431960";
const defaultPreviewLimitBytes = 2 * 1024 * 1024;
const imageLimitBytes = 16 * 1024 * 1024;
const videoLimitBytes = 256 * 1024 * 1024;
const sceneLimitBytes = 256 * 1024 * 1024;
const webHtmlLimitBytes = 512 * 1024;
export const base64TransferLimitBytes = 512 * 1024 * 1024;
export const videoFilePlaybackLimitBytes = 1024 * 1024 * 1024;
const projectCacheRevalidateMs = 5000;
const projectFullScanMs = 5 * 60 * 1000;
let defaultProjectIndex = null;
let defaultProjectsPromise = null;

async function fileStat(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

async function pathExists(path) {
  return Boolean(await fileStat(path));
}

async function isFile(path) {
  return Boolean((await fileStat(path))?.isFile());
}

async function isDirectory(path) {
  return Boolean((await fileStat(path))?.isDirectory());
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

async function isPathInside(path, root) {
  if (!root) return false;
  try {
    const [resolvedPath, resolvedRoot] = await Promise.all([
      realpath(String(path)),
      realpath(String(root)),
    ]);
    return (
      resolvedPath === resolvedRoot ||
      resolvedPath.startsWith(resolvedRoot + sep)
    );
  } catch {
    return false;
  }
}

async function isPathAllowed(path, snapshot) {
  const roots = [snapshot.installDir, ...(snapshot.libraryDirs || [])].filter(
    Boolean
  );
  return (
    await Promise.all(roots.map((root) => isPathInside(path, root)))
  ).some(Boolean);
}

async function scanProjects(installDir, libraryDirs) {
  return createScanKit().enumerateWallpapersAsync(installDir, libraryDirs);
}

async function scanDefaultProjects(environmentKey) {
  const discovery = createSteamDiscoveryKit({
    WE_APPID,
    pathExistsP: pathExists,
  });
  const installDir = await discovery.locateWallpaperEngineP();
  if (!installDir || !(await isDirectory(installDir))) return null;
  const libraryDirs = await discovery.owningLibrariesP();
  const kit = createScanKit();
  const signature = await kit.scanSignatureP(installDir, libraryDirs);
  const projects = await kit.enumerateWallpapersAsync(installDir, libraryDirs);
  defaultProjectIndex = {
    installDir,
    libraryDirs,
    signature,
    projects,
    environmentKey,
    scannedAt: Date.now(),
    checkedAt: Date.now(),
    revalidationFailed: false,
  };
  return defaultProjectIndex;
}

async function refreshDefaultProjects() {
  if (defaultProjectsPromise) return defaultProjectsPromise;
  const environmentKey = process.env.DSH_WE_STEAM_ROOT || "";
  const previous =
    defaultProjectIndex?.environmentKey === environmentKey
      ? defaultProjectIndex
      : null;
  defaultProjectsPromise = (async () => {
    if (previous) {
      const signature = await createScanKit().scanSignatureP(
        previous.installDir,
        previous.libraryDirs
      );
      if (
        signature === previous.signature &&
        Date.now() - previous.scannedAt < projectFullScanMs
      ) {
        previous.checkedAt = Date.now();
        previous.revalidationFailed = false;
        return previous;
      }
    }
    return scanDefaultProjects(environmentKey);
  })().finally(() => {
    defaultProjectsPromise = null;
  });
  return defaultProjectsPromise;
}

async function readWebHtml(path) {
  const candidate = await dataUrl(path, webHtmlLimitBytes);
  if (!candidate) return null;
  const html = Buffer.from(candidate.url.split(",", 2)[1], "base64").toString(
    "utf8"
  );
  // The offline lane cannot execute scripts; offer the author's preview.
  return /<script(?=[\s/>])/i.test(html) ? null : html;
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
  if (useDefault) {
    const environmentKey = process.env.DSH_WE_STEAM_ROOT || "";
    if (
      !defaultProjectIndex ||
      defaultProjectIndex.environmentKey !== environmentKey
    ) {
      let index = await refreshDefaultProjects();
      if (index?.environmentKey !== environmentKey)
        index = await refreshDefaultProjects();
      return index?.environmentKey === environmentKey ? index : null;
    }
    const index = defaultProjectIndex;
    if (
      Date.now() - defaultProjectIndex.checkedAt >= projectCacheRevalidateMs &&
      !defaultProjectsPromise
    ) {
      if (!(await isDirectory(index.installDir))) {
        index.revalidationFailed = true;
      } else {
        void refreshDefaultProjects()
          .then((refreshed) => {
            if (index === defaultProjectIndex)
              index.revalidationFailed = refreshed === null;
          })
          .catch(() => {
            if (index === defaultProjectIndex) index.revalidationFailed = true;
          });
      }
    }
    return defaultProjectIndex;
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
  return {
    installDir: resolvedInstallDir,
    libraryDirs: resolvedLibraryDirs,
    projects: await scanProjects(resolvedInstallDir, resolvedLibraryDirs),
  };
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
  const snapshot = await enumerateProjects({ installDir, libraryDirs });
  if (!snapshot) {
    return { entries: [], installAvailable: false };
  }

  const entries = [];
  let assetsLeft = Math.max(0, assetLimit);
  let assetBytesLeft = Math.max(0, assetBudget);
  for (const project of snapshot.projects) {
    if (
      !(await isFile(project.fileAbs)) ||
      !(await isPathAllowed(project.fileAbs, snapshot))
    )
      continue;
    const preview =
      previewLimit > 0 && (await isPathAllowed(project.previewAbs, snapshot))
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
    if (!entry.previewDataUrl) continue;
    if (previewsLeft-- > 0) continue;
    entry.previewDataUrl = null;
    entry.fallback = false;
    if (entry.type === "scene" && !entry.playable)
      entry.reason = "scene-unavailable";
    if (entry.type === "web" && !entry.webHtml)
      entry.reason = "web-unavailable";
  }

  return {
    entries,
    installAvailable: true,
    revalidationFailed: Boolean(snapshot.revalidationFailed),
  };
}

export async function loadWallpaperPreview(
  id,
  { installDir = null, libraryDirs = null } = {}
) {
  const snapshot = await enumerateProjects({ installDir, libraryDirs });
  const project = snapshot?.projects.find(
    (entry) => String(entry.id) === String(id)
  );
  if (!project || !(await isPathAllowed(project.previewAbs, snapshot)))
    return null;
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
  const snapshot = await enumerateProjects({ installDir, libraryDirs });
  const project = snapshot?.projects.find(
    (entry) => String(entry.id) === String(id)
  );
  if (!project?.fileAbs) return null;
  if (!(await isPathAllowed(project.fileAbs, snapshot))) return null;
  try {
    const info = await stat(project.fileAbs);
    if (!info.isFile()) return null;
    const preview = (await isPathAllowed(project.previewAbs, snapshot))
      ? await dataUrl(project.previewAbs, defaultPreviewLimitBytes)
      : null;
    const webHtml =
      project.type === "web" ? await readWebHtml(project.fileAbs) : null;
    const playbackLimit =
      project.type === "video"
        ? videoFilePlaybackLimitBytes
        : base64TransferLimitBytes;
    const playable = project.type !== "web" && info.size <= playbackLimit;
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
