import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { addEventListener() {}, removeEventListener() {} };

const { buildScenePkg, checkWeCompat } = await import("@webwallgl/editor");

const output = join(dirname(fileURLToPath(import.meta.url)), "scene.pkg");
const encoder = new TextEncoder();
const json = (value) => encoder.encode(JSON.stringify(value, null, 2));

function toneWav(seconds = 0.12, sampleRate = 8000, frequency = 440) {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => {
    for (let index = 0; index < value.length; index += 1)
      bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
    view.setInt16(44 + index * 2, Math.round(sample * 8000), true);
  }
  return bytes;
}

const project = {
  type: "scene",
  file: "scene.json",
  title: "Codex Wallpaper Minimal Scene Fixture",
};

const scene = {
  camera: null,
  general: {
    orthogonalprojection: { width: 640, height: 360 },
    clearenabled: true,
    clearcolor: "0.05 0.12 0.20",
    ambientcolor: "1 1 1",
    skylightcolor: "0 0 0",
  },
  objects: [
    {
      id: 1,
      name: "fixture-label",
      text: "CODEX WALLPAPER SCENE FIXTURE",
      font: "systemfont_segoe",
      pointsize: 24,
      color: "0.9 0.95 1",
      alpha: 1,
      origin: "320 180 0",
      scale: "1 1 1",
      angles: "0 0 0",
      size: "640 360",
    },
    {
      id: 2,
      name: "fixture-sound",
      sound: ["sounds/tone.wav"],
      soundprops: {
        volume: 1,
        startsilent: false,
        playbackmode: "loop",
      },
      origin: "320 180 0",
      visible: false,
    },
  ],
};

const files = [
  { path: "project.json", data: json(project) },
  { path: "scene.json", data: json(scene) },
  { path: "sounds/tone.wav", data: toneWav() },
];
const built = buildScenePkg(files);
const report = await checkWeCompat([
  ...files,
  { path: "scene.pkg", data: built.pkg },
]);
const sha256 = createHash("sha256").update(built.pkg).digest("hex");

if (!report.ok)
  throw new Error(
    `Generated fixture is not compatible: ${JSON.stringify(report)}`
  );

if (process.argv.includes("--check")) {
  const existing = await readFile(output);
  const existingHash = createHash("sha256").update(existing).digest("hex");
  if (existingHash !== sha256)
    throw new Error(
      `Fixture is stale: expected ${sha256}, found ${existingHash}`
    );
} else {
  await writeFile(output, built.pkg);
}

console.log(
  JSON.stringify(
    {
      path: "launcher/fixtures/minimal-scene/scene.pkg",
      bytes: built.pkg.byteLength,
      sha256,
      entries: built.entries,
      layers: report.layers,
    },
    null,
    2
  )
);
