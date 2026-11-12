import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { scanWallpaperLibrary } from "./wallpaper-library.mjs";

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
});
