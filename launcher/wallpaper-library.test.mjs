import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  loadWallpaperPreview,
  prepareWallpaperAsset,
  scanWallpaperLibrary,
} from "./wallpaper-library.mjs";

test("scans local Wallpaper Engine projects without exposing paths", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-library-"));
  const installDir = join(root, "wallpaper_engine");
  const libraryDir = join(root, "steam-library");
  const localRoot = join(installDir, "projects", "myprojects");
  const workshopRoot = join(
    libraryDir,
    "steamapps",
    "workshop",
    "content",
    "431960"
  );
  t.after(() => rm(root, { recursive: true, force: true }));

  async function project(parent, id, manifest, files = {}) {
    const directory = join(parent, id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "project.json"),
      JSON.stringify(manifest),
      "utf8"
    );
    for (const [name, content] of Object.entries(files)) {
      await writeFile(join(directory, name), content);
    }
  }

  await project(
    localRoot,
    "picture",
    {
      title: "Picture",
      type: "image",
      file: "image.png",
      preview: "preview.png",
    },
    {
      "image.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      "preview.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 2]),
    }
  );
  await project(
    workshopRoot,
    "9001",
    {
      title: "Video",
      type: "video",
      file: "clip.mp4",
      preview: "preview.jpg",
    },
    {
      "clip.mp4": Buffer.from("video"),
      "preview.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    }
  );
  await project(
    workshopRoot,
    "9002",
    {
      title: "Scene",
      type: "scene",
      file: "scene.pkg",
      preview: "preview.png",
    },
    {
      "scene.pkg": Buffer.from("scene"),
      "preview.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    }
  );
  await project(
    workshopRoot,
    "9003",
    {
      title: "Web",
      type: "web",
      file: "index.html",
      preview: "preview.png",
    },
    {
      "index.html": "<main>web</main>",
      "preview.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 3]),
    }
  );
  await project(workshopRoot, "broken", {
    title: "Broken",
    type: "video",
    file: "missing.mp4",
  });
  await project(
    workshopRoot,
    "escape",
    {
      title: "Escape",
      type: "image",
      file: "../outside.png",
      preview: "../outside.png",
    },
    { "inside.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]) }
  );
  await writeFile(join(root, "outside.png"), Buffer.from([1, 2, 3]));

  const result = await scanWallpaperLibrary({
    installDir,
    libraryDirs: [libraryDir],
    previewLimit: 3,
  });

  assert.deepEqual(
    result.entries.map(({ id, title, type, playable, fallback }) => ({
      id,
      title,
      type,
      playable,
      fallback,
    })),
    [
      {
        id: "picture",
        title: "Picture",
        type: "image",
        playable: true,
        fallback: true,
      },
      {
        id: "9002",
        title: "Scene",
        type: "scene",
        playable: true,
        fallback: true,
      },
      {
        id: "9001",
        title: "Video",
        type: "video",
        playable: true,
        fallback: true,
      },
      {
        id: "9003",
        title: "Web",
        type: "web",
        playable: false,
        fallback: false,
      },
    ]
  );
  assert.equal(
    result.entries.filter((entry) => entry.previewDataUrl).length,
    3
  );
  assert.equal(
    result.entries.find((entry) => entry.id === "9003").webHtml,
    "<main>web</main>"
  );
  assert.ok(result.entries.every((entry) => !("dirAbs" in entry)));
  assert.ok(result.entries.every((entry) => !("fileAbs" in entry)));
  const preview = await loadWallpaperPreview("picture", {
    installDir,
    libraryDirs: [libraryDir],
  });
  assert.equal(preview.id, "picture");
  assert.match(preview.previewDataUrl, /^data:image\/png;base64,/);
  const prepared = await prepareWallpaperAsset("picture", {
    installDir,
    libraryDirs: [libraryDir],
  });
  assert.equal(prepared.mime, "image/png");
  assert.equal(prepared.size, 4);
  assert.equal(prepared.playable, true);
  await project(
    workshopRoot,
    "script-web",
    {
      title: "Script Web",
      type: "web",
      file: "index.html",
      preview: "preview.png",
    },
    {
      "index.html": '<canvas></canvas><script src="bundle.js"></script>',
      "preview.png": Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    }
  );
  const webOptions = { installDir, libraryDirs: [libraryDir] };
  const scriptWeb = (await scanWallpaperLibrary(webOptions)).entries.find(
    (entry) => entry.id === "script-web"
  );
  for (const entry of [
    scriptWeb,
    await prepareWallpaperAsset("script-web", webOptions),
  ]) {
    assert.equal(entry.reason, "web-preview-fallback");
    assert.equal(entry.webHtml, null);
    assert.match(entry.previewDataUrl, /^data:image\/png;base64,/);
  }
  await project(workshopRoot, "large-video", {
    title: "Large video",
    type: "video",
    file: "large-video.mp4",
  });
  const largeVideoPath = join(workshopRoot, "large-video", "large-video.mp4");
  await writeFile(largeVideoPath, Buffer.alloc(0));
  await truncate(largeVideoPath, 512 * 1024 * 1024 + 1);
  const largeVideo = await prepareWallpaperAsset("large-video", {
    installDir,
    libraryDirs: [libraryDir],
  });
  assert.equal(largeVideo.playable, true);
  assert.equal(largeVideo.reason, null);
  await truncate(largeVideoPath, 1024 * 1024 * 1024 + 1);
  const huge = await prepareWallpaperAsset("large-video", {
    installDir,
    libraryDirs: [libraryDir],
  });
  assert.equal(huge.playable, false);
  assert.equal(huge.reason, "asset-too-large");
  const outside = join(root, "outside");
  const linkedProject = join(workshopRoot, "linked-video");
  await mkdir(outside, { recursive: true });
  await mkdir(linkedProject, { recursive: true });
  await writeFile(join(outside, "clip.mp4"), Buffer.from([0]));
  await symlink(
    outside,
    join(linkedProject, "media"),
    process.platform === "win32" ? "junction" : "dir"
  );
  await writeFile(
    join(linkedProject, "project.json"),
    JSON.stringify({ type: "video", file: "media/clip.mp4" })
  );
  assert.equal(
    await prepareWallpaperAsset("linked-video", {
      installDir,
      libraryDirs: [libraryDir],
    }),
    null
  );
});

test("serves the cached library while a changed scan signature revalidates", async (t) => {
  const steamRoot = await mkdtemp(join(tmpdir(), "codex-wallpaper-cache-"));
  const distribution = join(
    steamRoot,
    "steamapps",
    "common",
    "wallpaper_engine",
    "distribution"
  );
  const workshop = join(
    steamRoot,
    "steamapps",
    "workshop",
    "content",
    "431960"
  );
  const firstProject = join(workshop, "cache-first");
  const secondProject = join(workshop, "cache-second");
  const previousRoot = process.env.DSH_WE_STEAM_ROOT;
  const realNow = Date.now;
  let replacementRoot = null;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.DSH_WE_STEAM_ROOT;
    else process.env.DSH_WE_STEAM_ROOT = previousRoot;
    Date.now = realNow;
    return Promise.all(
      [steamRoot, replacementRoot]
        .filter(Boolean)
        .map((root) => rm(root, { recursive: true, force: true }))
    );
  });
  await mkdir(distribution, { recursive: true });
  await mkdir(firstProject, { recursive: true });
  await writeFile(join(distribution, "version.json"), "{}");
  await writeFile(
    join(firstProject, "project.json"),
    JSON.stringify({ type: "video", title: "First A", file: "clip.mp4" })
  );
  await writeFile(join(firstProject, "clip.mp4"), Buffer.from([0]));
  process.env.DSH_WE_STEAM_ROOT = steamRoot;
  assert.equal((await prepareWallpaperAsset("cache-first")).title, "First A");
  await writeFile(
    join(firstProject, "project.json"),
    JSON.stringify({ type: "video", title: "First B", file: "clip.mp4" })
  );
  await mkdir(secondProject, { recursive: true });
  await writeFile(
    join(secondProject, "project.json"),
    JSON.stringify({ type: "video", title: "Second", file: "clip.mp4" })
  );
  await writeFile(join(secondProject, "clip.mp4"), Buffer.from([0]));
  Date.now = () => realNow() + 6000;
  assert.equal((await prepareWallpaperAsset("cache-first")).title, "First A");
  let refreshed = null;
  for (let attempt = 0; attempt < 80 && !refreshed; attempt += 1) {
    refreshed = await prepareWallpaperAsset("cache-second");
    if (!refreshed) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(refreshed?.title, "Second");
  assert.equal((await prepareWallpaperAsset("cache-first")).title, "First B");
  await rm(join(firstProject, "clip.mp4"));
  assert.equal(await prepareWallpaperAsset("cache-first"), null);

  replacementRoot = await mkdtemp(
    join(tmpdir(), "codex-wallpaper-cache-replacement-")
  );
  const replacementDistribution = join(
    replacementRoot,
    "steamapps",
    "common",
    "wallpaper_engine",
    "distribution"
  );
  const replacementProject = join(
    replacementRoot,
    "steamapps",
    "workshop",
    "content",
    "431960",
    "cache-first"
  );
  await mkdir(replacementDistribution, { recursive: true });
  await mkdir(replacementProject, { recursive: true });
  await writeFile(join(replacementDistribution, "version.json"), "{}");
  await writeFile(
    join(replacementProject, "project.json"),
    JSON.stringify({
      type: "video",
      title: "Replacement Root",
      file: "replacement.mp4",
    })
  );
  await writeFile(
    join(replacementProject, "replacement.mp4"),
    Buffer.from([1])
  );
  process.env.DSH_WE_STEAM_ROOT = replacementRoot;
  const replacement = await prepareWallpaperAsset("cache-first");
  assert.equal(replacement.title, "Replacement Root");
  assert.equal(replacement.path, join(replacementProject, "replacement.mp4"));
});

test("preview delivery stays inside the roots from its scan snapshot", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-preview-root-"));
  const installDir = join(root, "wallpaper_engine");
  const libraryDir = join(root, "steam-library");
  const project = join(installDir, "projects", "myprojects", "preview-escape");
  const outside = join(root, "outside-preview");
  await mkdir(project, { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(outside, "preview.png"), Buffer.from([1, 2, 3]));
  await symlink(
    outside,
    join(project, "media"),
    process.platform === "win32" ? "junction" : "dir"
  );
  await writeFile(join(project, "image.png"), Buffer.from([4, 5, 6]));
  await writeFile(
    join(project, "project.json"),
    JSON.stringify({
      type: "image",
      title: "Preview escape",
      file: "image.png",
      preview: "media/preview.png",
    })
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { installDir, libraryDirs: [libraryDir] };
  const entry = (await scanWallpaperLibrary(options)).entries.find(
    (candidate) => candidate.id === "preview-escape"
  );
  assert.equal(entry.previewDataUrl, null);
  assert.equal(entry.fallback, false);
  assert.equal(await loadWallpaperPreview("preview-escape", options), null);
  const prepared = await prepareWallpaperAsset("preview-escape", options);
  assert.equal(prepared.previewDataUrl, null);
  assert.equal(prepared.fallback, false);
  assert.equal(prepared.playable, true);
});

test("stale index exposes a failed background revalidation", async (t) => {
  const steamRoot = await mkdtemp(join(tmpdir(), "codex-wallpaper-stale-"));
  const installDir = join(steamRoot, "steamapps", "common", "wallpaper_engine");
  const distribution = join(installDir, "distribution");
  const project = join(
    steamRoot,
    "steamapps",
    "workshop",
    "content",
    "431960",
    "stale-project"
  );
  const previousRoot = process.env.DSH_WE_STEAM_ROOT;
  const realNow = Date.now;
  t.after(() => {
    if (previousRoot === undefined) delete process.env.DSH_WE_STEAM_ROOT;
    else process.env.DSH_WE_STEAM_ROOT = previousRoot;
    Date.now = realNow;
    return rm(steamRoot, { recursive: true, force: true });
  });
  await mkdir(distribution, { recursive: true });
  await mkdir(join(installDir, "projects", "myprojects"), { recursive: true });
  await mkdir(project, { recursive: true });
  await writeFile(join(distribution, "version.json"), "{}");
  await writeFile(
    join(project, "project.json"),
    JSON.stringify({ type: "image", title: "Stale", file: "image.png" })
  );
  await writeFile(join(project, "image.png"), Buffer.from([1]));
  process.env.DSH_WE_STEAM_ROOT = steamRoot;
  assert.equal((await prepareWallpaperAsset("stale-project")).title, "Stale");
  await rm(installDir, { recursive: true, force: true });
  Date.now = () => realNow() + 6000;
  assert.equal((await prepareWallpaperAsset("stale-project")).title, "Stale");
  let status = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    status = await scanWallpaperLibrary();
    if (status.revalidationFailed) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(status.revalidationFailed, true);
  assert.ok(status.entries.some((entry) => entry.id === "stale-project"));
});
