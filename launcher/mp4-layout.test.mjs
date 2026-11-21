import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareMp4VirtualLayout } from "./mp4-layout.mjs";

function box(type, payload = Buffer.alloc(0)) {
  const result = Buffer.alloc(8 + payload.length);
  result.writeUInt32BE(result.length, 0);
  result.write(type, 4, "latin1");
  payload.copy(result, 8);
  return result;
}

function largeBox(type, payload = Buffer.alloc(0)) {
  const result = Buffer.alloc(16 + payload.length);
  result.writeUInt32BE(1, 0);
  result.write(type, 4, "latin1");
  result.writeBigUInt64BE(BigInt(result.length), 8);
  payload.copy(result, 16);
  return result;
}

function chunkTable(type, offset, largeHeader = false) {
  const entrySize = type === "stco" ? 4 : 8;
  const payload = Buffer.concat([
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0, 0, 0, 1]),
    Buffer.alloc(entrySize),
  ]);
  if (type === "stco") payload.writeUInt32BE(offset, 8);
  else payload.writeBigUInt64BE(BigInt(offset), 8);
  return (largeHeader ? largeBox : box)(type, payload);
}

function stco(offset) {
  return chunkTable("stco", offset);
}

test("tail-moov chunk offsets are adjusted without copying media bytes", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-mp4-"));
  const path = join(root, "tail.mp4");
  const mdat = box("mdat", Buffer.from([1, 2, 3, 4]));
  const moov = box(
    "moov",
    box("trak", box("mdia", box("minf", box("stbl", stco(16)))))
  );
  const file = Buffer.concat([box("ftyp"), mdat, moov]);
  const mdatStart = file.indexOf(mdat);
  const moovStart = file.indexOf(moov);
  await writeFile(path, file);
  t.after(() => rm(root, { recursive: true, force: true }));
  const layout = await prepareMp4VirtualLayout(path, file.length);
  assert.equal(layout.layout, "virtual");
  assert.equal(layout.size, file.length);
  assert.equal(layout.moovSize, moov.length);
  assert.equal(layout.offsetCount, 1);
  assert.equal(layout.segments.length, 3);
  assert.deepEqual(
    layout.segments.map(({ type }) => type),
    ["slice", "inline", "slice"]
  );
  const corrected = Buffer.from(layout.segments[1].data, "base64");
  assert.equal(
    corrected.readUInt32BE(corrected.length - 4),
    mdatStart + 8 + moov.length
  );
  assert.equal(
    layout.segments.reduce(
      (total, segment) =>
        total +
        (segment.type === "inline"
          ? Buffer.from(segment.data, "base64").length
          : 0),
      0
    ),
    moov.length
  );
  assert.deepEqual(
    Buffer.concat(
      layout.segments.map((segment) =>
        segment.type === "inline"
          ? Buffer.from(segment.data, "base64")
          : file.subarray(segment.offset, segment.offset + segment.length)
      )
    ),
    Buffer.concat([box("ftyp"), corrected, mdat])
  );
});

test("front-moov file stays on the original single-slice layout", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-mp4-"));
  const path = join(root, "front.mp4");
  const moov = box(
    "moov",
    box("trak", box("mdia", box("minf", box("stbl", stco(0)))))
  );
  const file = Buffer.concat([
    box("ftyp"),
    moov,
    box("mdat", Buffer.from([1, 2, 3, 4])),
  ]);
  await writeFile(path, file);
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await prepareMp4VirtualLayout(path, file.length), {
    version: 1,
    size: file.length,
    layout: "original",
    moovSize: moov.length,
    offsetCount: 0,
    segments: [{ type: "slice", offset: 0, length: file.length }],
  });
});

test("extended co64 tables use their real payload and adjust media offsets", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-mp4-"));
  const path = join(root, "co64.mp4");
  const mdat = box("mdat", Buffer.from([1, 2, 3, 4]));
  const co64 = chunkTable("co64", 16, true);
  const moov = box(
    "moov",
    box("trak", box("mdia", box("minf", box("stbl", co64))))
  );
  const file = Buffer.concat([box("ftyp"), mdat, moov]);
  await writeFile(path, file);
  t.after(() => rm(root, { recursive: true, force: true }));
  const layout = await prepareMp4VirtualLayout(path, file.length);
  assert.equal(layout.layout, "virtual");
  assert.equal(layout.offsetCount, 1);
  const corrected = Buffer.from(layout.segments[1].data, "base64");
  assert.equal(
    Number(corrected.readBigUInt64BE(corrected.length - 8)),
    16 + moov.length
  );
});

test("malformed extended lengths and offsets outside mdat are rejected", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "codex-wallpaper-mp4-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const extended = Buffer.alloc(32);
  extended.writeUInt32BE(1, 0);
  extended.write("mdat", 4, "latin1");
  extended.writeBigUInt64BE(8n, 8);
  const extendedPath = join(root, "extended.mp4");
  await writeFile(extendedPath, Buffer.concat([box("ftyp"), extended]));
  assert.equal(
    await prepareMp4VirtualLayout(extendedPath, extended.length + 8),
    null
  );

  const mdat = box("mdat", Buffer.from([1, 2, 3, 4]));
  const free = box("free", Buffer.alloc(8));
  const freeOffset = 8 + mdat.length;
  const moov = box(
    "moov",
    box("trak", box("mdia", box("minf", box("stbl", stco(freeOffset)))))
  );
  const outsidePath = join(root, "outside.mp4");
  const outside = Buffer.concat([box("ftyp"), mdat, free, moov]);
  await writeFile(outsidePath, outside);
  assert.equal(
    await prepareMp4VirtualLayout(outsidePath, outside.length),
    null
  );

  const headerMoov = box(
    "moov",
    box("trak", box("mdia", box("minf", box("stbl", stco(8)))))
  );
  const headerPath = join(root, "header.mp4");
  const headerOffset = Buffer.concat([box("ftyp"), mdat, headerMoov]);
  await writeFile(headerPath, headerOffset);
  assert.equal(
    await prepareMp4VirtualLayout(headerPath, headerOffset.length),
    null
  );
});
