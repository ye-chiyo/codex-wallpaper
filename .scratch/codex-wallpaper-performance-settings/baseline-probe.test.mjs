import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeBaselineSnapshot } from "./baseline-probe.mjs";
import { compareCandidateIdentity } from "./candidate-check.mjs";

test("baseline snapshots keep the measurement identity without personal material data", () => {
  const secretTitle = "private wallpaper title";
  const secretPath = "D:\\private\\wallpaper.mp4";
  const secretUrl = "data:video/mp4;base64,PRIVATE";
  const snapshot = sanitizeBaselineSnapshot({
    viewport: { width: 1707, height: 1066, dpr: 1.5 },
    theme: "dark",
    visibilityState: "visible",
    config: {
      enabled: true,
      active: { kind: "workshop", id: "2788691565", title: secretTitle },
      favorites: [{ kind: "workshop", id: "secret-favorite" }],
      playlist: [],
      settings: {
        dim: 18,
        blur: 0,
        opacity: 100,
        fps: 30,
        volume: 0,
        rotationMinutes: 0,
        privateSetting: secretPath,
      },
    },
    runtimeState: {
      state: "enabled",
      activeKind: "workshop",
      activeId: "2788691565",
      playerCount: 1,
    },
    runtimeIdentity: {
      runtimeHash: "a".repeat(64),
      styleHash: "b".repeat(64),
    },
    activeMedia: [
      {
        className: "media",
        title: secretTitle,
        children: [
          {
            tagName: "VIDEO",
            width: 1920,
            videoWidth: 1920,
            src: secretUrl,
          },
        ],
      },
    ],
    cards: [
      {
        kind: "workshop",
        id: "2788691565",
        title: secretTitle,
        meta: "video",
        selected: "true",
      },
    ],
  });

  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private wallpaper title/i);
  assert.doesNotMatch(serialized, /D:\\\\private/i);
  assert.doesNotMatch(serialized, /data:video/i);
  assert.match(snapshot.config.active.idHash, /^[a-f0-9]{16}$/);
  assert.deepEqual(snapshot.config.settings, {
    dim: 18,
    blur: 0,
    opacity: 100,
    fps: 30,
    volume: 0,
    rotationMinutes: 0,
  });
  assert.equal(snapshot.config.favoriteCount, 1);
  assert.deepEqual(snapshot.runtimeIdentity, {
    runtimeHash: "a".repeat(64),
    styleHash: "b".repeat(64),
  });
  assert.deepEqual(snapshot.cards[0], {
    kind: "workshop",
    idHash: "16f531121815eb59",
    state: "video",
    selected: true,
  });
});

test("candidate identity comparison requires runtime and generated style matches", () => {
  const expected = {
    runtimeHash: "a".repeat(64),
    styleHash: "b".repeat(64),
  };
  assert.deepEqual(
    compareCandidateIdentity(
      {
        runtimeIdentity: expected,
        styleHash: expected.styleHash,
        runtimeState: { state: "enabled", libraryCount: 106 },
      },
      expected
    ),
    {
      pass: true,
      expected,
      actual: {
        runtimeHash: expected.runtimeHash,
        styleHash: expected.styleHash,
        capturedStyleHash: expected.styleHash,
      },
      checks: { runtimeHash: true, styleHash: true },
      state: "enabled",
      libraryCount: 106,
    }
  );
  assert.equal(
    compareCandidateIdentity(
      {
        runtimeIdentity: { ...expected, runtimeHash: "c".repeat(64) },
        styleHash: expected.styleHash,
      },
      expected
    ).checks.runtimeHash,
    false
  );
});
