import { open } from "node:fs/promises";

const maximumMoovBytes = 4 * 1024 * 1024;
const maximumOffsetTableBytes = 2 * 1024 * 1024;
const forbiddenLayoutTypes = [
  "encv",
  "enca",
  "moof",
  "pssh",
  "saio",
  "saiz",
  "sidx",
  "sinf",
];

function boxHeader(buffer, offset, end) {
  if (offset + 8 > end) return null;
  const size = buffer.readUInt32BE(offset);
  const type = buffer.toString("latin1", offset + 4, offset + 8);
  if (size === 1) {
    if (offset + 16 > end) return null;
    const largeSize = Number(buffer.readBigUInt64BE(offset + 8));
    if (!Number.isSafeInteger(largeSize) || largeSize < 16) return null;
    return { size: largeSize, type, headerSize: 16 };
  }
  if (size < 8) return null;
  return { size, type, headerSize: 8 };
}

function eachBox(buffer, start, end, visit) {
  let offset = start;
  while (offset < end) {
    const box = boxHeader(buffer, offset, end);
    if (!box || box.size > end - offset) return false;
    if (!visit(box.type, offset, box.size, box.headerSize)) return false;
    offset += box.size;
  }
  return offset === end;
}

function adjustChunkOffsets(moov, shiftedStart, shiftedEnd, delta) {
  let offsetCount = 0;
  let offsetTableBytes = 0;
  let tableCount = 0;
  const findTables = (start, end) => {
    return eachBox(moov, start, end, (type, offset, size, headerSize) => {
      if (["moov", "trak", "mdia", "minf", "stbl"].includes(type))
        return findTables(offset + headerSize, offset + size);
      if (!["stco", "co64"].includes(type)) return true;
      const entrySize = type === "stco" ? 4 : 8;
      const payloadStart = offset + headerSize;
      if (payloadStart + 8 > offset + size) return false;
      const entryCount = moov.readUInt32BE(payloadStart + 4);
      const tableBytes = 8 + entryCount * entrySize;
      if (
        entryCount > 100_000 ||
        tableBytes > maximumOffsetTableBytes ||
        offsetTableBytes + tableBytes > maximumOffsetTableBytes
      )
        return false;
      if (payloadStart + tableBytes > offset + size) return false;
      offsetTableBytes += tableBytes;
      tableCount += 1;
      for (let index = 0; index < entryCount; index += 1) {
        const position = payloadStart + 8 + index * entrySize;
        const original =
          type === "stco"
            ? moov.readUInt32BE(position)
            : Number(moov.readBigUInt64BE(position));
        if (
          !Number.isSafeInteger(original) ||
          original < shiftedStart ||
          original >= shiftedEnd
        )
          return false;
        const adjusted = original + delta;
        if (adjusted > Number.MAX_SAFE_INTEGER) return false;
        if (type === "stco") moov.writeUInt32BE(adjusted, position);
        else moov.writeBigUInt64BE(BigInt(adjusted), position);
      }
      offsetCount += entryCount;
      return true;
    });
  };

  if (!findTables(0, moov.length) || tableCount === 0) return null;
  return offsetCount;
}

export async function prepareMp4VirtualLayout(path, fileSize) {
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) return null;
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 8 || header.toString("latin1", 4, 8) !== "ftyp")
      return null;

    let offset = 0;
    let mdat = null;
    let moov = null;
    while (offset < fileSize) {
      const boxHeaderBuffer = Buffer.alloc(16);
      const read = await handle.read(
        boxHeaderBuffer,
        0,
        boxHeaderBuffer.length,
        offset
      );
      const box = boxHeader(boxHeaderBuffer, 0, read.bytesRead);
      if (
        !box ||
        !Number.isSafeInteger(box.size) ||
        box.size > fileSize - offset
      )
        return null;
      if (box.type === "mdat") {
        if (mdat) return null;
        mdat = {
          start: offset,
          end: offset + box.size,
          payloadStart: offset + box.headerSize,
        };
      } else if (box.type === "moov") {
        if (moov || box.size > maximumMoovBytes) return null;
        const bytes = Buffer.alloc(box.size);
        const moovRead = await handle.read(bytes, 0, bytes.length, offset);
        if (moovRead.bytesRead !== bytes.length) return null;
        moov = { start: offset, end: offset + box.size, bytes };
      }
      offset += box.size;
    }
    if (
      offset !== fileSize ||
      !mdat ||
      !moov ||
      (moov.start < mdat.end && moov.end > mdat.start)
    )
      return null;

    if (moov.start < mdat.start) {
      return {
        version: 1,
        size: fileSize,
        layout: "original",
        moovSize: moov.bytes.length,
        offsetCount: 0,
        segments: [{ type: "slice", offset: 0, length: fileSize }],
      };
    }

    if (forbiddenLayoutTypes.some((type) => moov.bytes.includes(type, 4)))
      return null;
    const delta = moov.end - moov.start;
    const offsetCount = adjustChunkOffsets(
      moov.bytes,
      mdat.payloadStart,
      mdat.end,
      delta
    );
    if (offsetCount === null) return null;

    const segments = [];
    if (mdat.start > 0)
      segments.push({ type: "slice", offset: 0, length: mdat.start });
    segments.push({ type: "inline", data: moov.bytes.toString("base64") });
    if (moov.start > mdat.start)
      segments.push({
        type: "slice",
        offset: mdat.start,
        length: moov.start - mdat.start,
      });
    if (fileSize > moov.end)
      segments.push({
        type: "slice",
        offset: moov.end,
        length: fileSize - moov.end,
      });

    return {
      version: 1,
      size: fileSize,
      layout: "virtual",
      moovSize: moov.bytes.length,
      offsetCount,
      segments,
    };
  } finally {
    await handle.close();
  }
}
