import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, truncate, writeFile } from "node:fs/promises";
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
  await project(workshopRoot, "huge", {
    title: "Huge",
    type: "video",
    file: "huge.mp4",
  });
  await writeFile(join(workshopRoot, "huge", "huge.mp4"), Buffer.alloc(0));
  await truncate(join(workshopRoot, "huge", "huge.mp4"), 512 * 1024 * 1024 + 1);
  const huge = await prepareWallpaperAsset("huge", {
    installDir,
    libraryDirs: [libraryDir],
  });
  assert.equal(huge.playable, false);
  assert.equal(huge.reason, "asset-too-large");
});
