import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, join } from "node:path";
import {
  loadWallpaperPreview,
  prepareWallpaperAsset,
} from "./wallpaper-library.mjs";

const imagePattern =
  /^data:image\/(?:jpeg|png|gif|bmp);base64,[A-Za-z0-9+/]+=*$/;
const motionPattern = /^startup-motion-[0-9a-f-]{36}\.webm$/;

function dimensions({ width, height } = {}) {
  return [width, height].every(
    (size) => Number.isInteger(size) && size >= 16 && size <= 8192
  )
    ? { motionWidth: width, motionHeight: height }
    : null;
}

function sameComposition(saved, { kind, id, fitMode, aspect }) {
  return (
    saved?.enabled === true &&
    saved.kind === kind &&
    saved.id === id &&
    saved.fitMode === fitMode &&
    saved.aspect === aspect
  );
}

function validPoster(value) {
  return (
    typeof value === "string" &&
    value.length <= 5_600_000 &&
    imagePattern.test(value)
  );
}

export function createStartupPreviewStore(
  path,
  previewFor = loadWallpaperPreview,
  assetFor = prepareWallpaperAsset
) {
  let revision = 0;
  let writes = Promise.resolve();
  const folder = dirname(path);

  function write(version, resolve) {
    const next = writes
      .catch(() => {})
      .then(async () => {
        if (revision !== version) return;
        const temporary = `${path}.${randomUUID()}.tmp`;
        const previous = await readFile(path, "utf8")
          .then(JSON.parse)
          .catch(() => null);
        const result = resolve(previous);
        if (!result || revision !== version) return;
        const { preview, clip } = result;
        let written = false;
        try {
          await mkdir(folder, { recursive: true });
          if (clip)
            await writeFile(join(folder, preview.motionFile), clip, {
              flag: "wx",
            });
          await writeFile(temporary, JSON.stringify(preview), { flag: "wx" });
          if (revision !== version) return;
          await rename(temporary, path);
          written = true;
          if (
            motionPattern.test(previous?.motionFile) &&
            previous.motionFile !== preview.motionFile
          )
            await unlink(join(folder, previous.motionFile)).catch(() => {});
        } finally {
          await unlink(temporary).catch(() => {});
          if (clip && !written)
            await unlink(join(folder, preview.motionFile)).catch(() => {});
        }
      });
    writes = next;
    return next;
  }

  async function update({
    enabled,
    kind,
    id,
    poster,
    source,
    dim,
    opacity,
    fitMode,
    video,
    aspect,
  }) {
    const version = ++revision;
    const percent = (value, fallback) =>
      Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
    if (enabled !== true)
      return write(version, () => ({ preview: { enabled: false } }));
    const settings = {
      enabled: true,
      kind,
      id,
      dim: percent(dim, 0),
      opacity: percent(opacity, 100),
      fitMode: fitMode === "contain" ? "contain" : "cover",
    };
    const workshop = kind === "workshop" && /^\d{1,20}$/.test(id);
    let playback = null;
    const originalVideo = video && dimensions(video);
    if (workshop && originalVideo) {
      const asset = await assetFor(id).catch(() => null);
      if (
        asset?.type === "video" &&
        asset.playable &&
        asset.path &&
        /\.(mp4|webm)$/i.test(extname(asset.path))
      )
        playback = { ...originalVideo, videoPath: asset.path };
    }
    const posterSource = source === "scene-frame" ? source : "media";
    if (validPoster(poster)) {
      return write(version, (previous) => {
        const same = sameComposition(previous, { ...settings, aspect });
        const retained =
          same && motionPattern.test(previous.motionFile)
            ? {
                motionFile: previous.motionFile,
                motionWidth: previous.motionWidth,
                motionHeight: previous.motionHeight,
              }
            : {};
        return {
          preview: {
            ...settings,
            source: posterSource,
            poster,
            aspect,
            ...(playback ?? retained),
          },
        };
      });
    }
    let keptScene = false;
    await write(version, (previous) => {
      if (workshop || kind === "imported") {
        if (
          previous?.enabled === true &&
          (previous.source === "scene-frame" ||
            previous.motionFile ||
            previous.videoPath) &&
          previous.kind === kind &&
          previous.id === id &&
          previous.fitMode === settings.fitMode &&
          validPoster(previous.poster)
        ) {
          keptScene = true;
          return {
            preview: { ...previous, ...settings },
          };
        }
      }
      return { preview: { enabled: false } };
    });
    if (revision !== version || keptScene || !workshop) return;
    const preview = await previewFor(id);
    if (validPoster(preview?.previewDataUrl))
      await write(version, () => ({
        preview: {
          ...settings,
          source: "workshop-preview",
          poster: preview.previewDataUrl,
        },
      }));
  }

  update.hasMotion = async (composition) => {
    await writes.catch(() => {});
    const saved = await readFile(path, "utf8")
      .then(JSON.parse)
      .catch(() => null);
    return (
      sameComposition(saved, composition) &&
      motionPattern.test(saved.motionFile) &&
      (await access(join(folder, saved.motionFile)).then(
        () => true,
        () => false
      ))
    );
  };

  update.saveMotion = (composition, geometry, clip) => {
    const size = dimensions(geometry);
    if (
      !size ||
      clip.length > 6_000_000 ||
      clip.length <= 4 ||
      clip.readUInt32BE() !== 0x1a45dfa3
    )
      return Promise.resolve();
    return write(revision, (previous) => {
      if (
        !sameComposition(previous, composition) ||
        !validPoster(previous.poster) ||
        (previous.source !== "scene-frame" && previous.kind !== "imported")
      )
        return null;
      return {
        clip,
        preview: {
          ...previous,
          ...size,
          motionFile: `startup-motion-${randomUUID()}.webm`,
        },
      };
    });
  };
  return update;
}
