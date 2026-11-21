import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createStartupPreviewStore } from "./startup-preview.mjs";

const poster = "data:image/jpeg;base64,YQ==";
const changedPoster = "data:image/jpeg;base64,Yg==";

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), "codex-wallpaper-preview-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const path = join(folder, "preview.json");
  return { path, read: async () => JSON.parse(await readFile(path, "utf8")) };
}

test("the startup preview uses the author's local poster and follows the current selection", async (t) => {
  const { path, read } = await fixture(t);
  const update = createStartupPreviewStore(path, async (id) => {
    assert.equal(id, "123");
    return { previewDataUrl: poster };
  });
  await update({
    enabled: true,
    kind: "workshop",
    id: "123",
    dim: 42,
    opacity: 70,
    fitMode: "cover",
  });
  assert.deepEqual(await read(), {
    enabled: true,
    kind: "workshop",
    id: "123",
    source: "workshop-preview",
    poster,
    dim: 42,
    opacity: 70,
    fitMode: "cover",
  });
  await update({ enabled: true, kind: "imported", poster: changedPoster });
  assert.equal((await read()).poster, changedPoster);
  await update({ enabled: true, kind: "imported", poster: "invalid" });
  assert.deepEqual(await read(), { enabled: false });
});

test("a captured scene survives a restart only for the same selection and fit", async (t) => {
  const { path, read } = await fixture(t);
  const selection = {
    enabled: true,
    kind: "workshop",
    id: "123",
    fitMode: "cover",
  };
  await createStartupPreviewStore(path)({
    ...selection,
    source: "scene-frame",
    poster: changedPoster,
    dim: 18,
  });
  const update = createStartupPreviewStore(path, async () => ({
    previewDataUrl: poster,
  }));
  await update({ ...selection, dim: 42, opacity: 80 });
  assert.deepEqual(await read(), {
    ...selection,
    source: "scene-frame",
    poster: changedPoster,
    dim: 42,
    opacity: 80,
  });
  await update({ ...selection, fitMode: "contain" });
  assert.equal((await read()).source, "workshop-preview");
  await update({ ...selection, source: "scene-frame", poster: changedPoster });
  await update({ ...selection, id: "456" });
  assert.equal((await read()).source, "workshop-preview");
  assert.equal((await read()).id, "456");
});

test("a delayed workshop preview cannot overwrite a saved disable or a new wallpaper", async (t) => {
  const { path, read } = await fixture(t);
  let requestPreview;
  let completePreview;
  const entered = new Promise((resolve) => {
    requestPreview = resolve;
  });
  const delayed = new Promise((resolve) => {
    completePreview = resolve;
  });
  const update = createStartupPreviewStore(path, () => {
    requestPreview();
    return delayed;
  });
  const previous = update({ enabled: true, kind: "workshop", id: "123" });
  await entered;
  await update({ enabled: false });
  completePreview({ previewDataUrl: poster });
  await previous;
  assert.deepEqual(await read(), { enabled: false });
});

test("a workshop video registers the verified original and preserves it before the next render", async (t) => {
  const { path, read } = await fixture(t);
  const videoPath = join(dirname(path), "source.mp4");
  const update = createStartupPreviewStore(
    path,
    async () => null,
    async (id) => {
      assert.equal(id, "123");
      return { type: "video", playable: true, path: videoPath };
    }
  );
  const selected = {
    enabled: true,
    kind: "workshop",
    id: "123",
    fitMode: "cover",
  };
  await update({
    ...selected,
    poster,
    video: { width: 2560, height: 1440 },
    videoPath: "untrusted-source.mp4",
  });
  await update({ ...selected, dim: 21 });
  assert.deepEqual(await read(), {
    ...selected,
    source: "media",
    poster,
    videoPath,
    motionWidth: 2560,
    motionHeight: 1440,
    opacity: 100,
    dim: 21,
  });
  await update({ enabled: false });
  assert.deepEqual(await read(), { enabled: false });
});

test("a rendered startup clip is reused for its exact composition and cleared on disable", async (t) => {
  const { path, read } = await fixture(t);
  const update = createStartupPreviewStore(path, async () => null);
  const selected = {
    enabled: true,
    kind: "workshop",
    id: "123",
    fitMode: "cover",
  };
  const composition = {
    ...selected,
    aspect: 160,
    poster,
    source: "scene-frame",
  };
  const bytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0xff]);
  await update(composition);
  await update.saveMotion(composition, { width: 2560, height: 1600 }, bytes);
  const initial = await read();
  assert.deepEqual(
    await readFile(join(dirname(path), initial.motionFile)),
    bytes
  );
  await update({ ...selected, opacity: 70 });
  assert.equal(await update.hasMotion(composition), true);
  assert.equal(await update.hasMotion({ ...composition, aspect: 178 }), false);
  await update({ ...composition, poster: changedPoster });
  assert.equal((await read()).motionFile, initial.motionFile);
  await update({ enabled: false });
  await update.saveMotion(composition, { width: 2560, height: 1600 }, bytes);
  assert.deepEqual(await read(), { enabled: false });
  assert.equal(await update.hasMotion(composition), false);
  await assert.rejects(readFile(join(dirname(path), initial.motionFile)), {
    code: "ENOENT",
  });
});
