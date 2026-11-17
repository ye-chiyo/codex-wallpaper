import { openMainPageSession } from "../../launcher/read-only-probe.mjs";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error(
    "Usage: node .scratch/codex-wallpaper-visual-polish/live-first-frame-acceptance.mjs <cdp-port> [normal|rapid|failure|disable|web-scene] [expected-style-sha256]"
  );
  process.exit(1);
}
const scenario = process.argv[3] || "normal";
const expectedStyleHash = process.argv[4]?.toLowerCase() || null;
const videoTitle = "[deepseek娘]深夜的大肥鱼";
const sceneTitle = "[4K] 00:00:00:00<by米山舞>";
const imageTitle = "轻音少女";
const webTitle = "3D展览长廊+全屏展示(带落樱)+视频展播+幻灯片放映";
const brokenTitle = "验收：受控加载失败视频";
const ids = {
  video: "3787353838",
  scene: "2573010382",
  image: "2817646508",
  web: "2179153203",
  broken: "acceptance-broken-video",
};

const session = await openMainPageSession(port, "app://-/index.html", true);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text
    );
  return result.result.value;
}

async function snapshot() {
  return evaluate(`(() => {
    const root = document.getElementById("codex-wallpaper-p1");
    const active = root?.querySelector(".media:not(.staged)");
    const status = document
      .getElementById("codex-wallpaper-p1-controls")
      ?.querySelector(".runtime-status")?.textContent || "";
    return {
      at: performance.now(),
      state: globalThis.__codexWallpaperApi?.state?.() || null,
      activeVideo: Boolean(active?.querySelector("video")),
      activeImage: Boolean(active?.querySelector("img")),
      activeScene: Boolean(active?.querySelector(".scene-host.ready")),
      staged: root?.querySelectorAll(".media.staged").length || 0,
      media: root?.querySelectorAll(".media").length || 0,
      preview: root?.querySelectorAll(".media-preview").length || 0,
      builtin: Boolean(active?.classList.contains("builtin")),
      oldFramePresent:
        globalThis.__acceptanceOldFrame !== undefined &&
        active === globalThis.__acceptanceOldFrame,
      status,
    };
  })()`);
}

async function runtimeStyleHash() {
  return evaluate(`(async () => {
    const text = document.getElementById("codex-wallpaper-p1-style")?.textContent;
    if (!text) return null;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  })()`);
}

async function waitFor(predicate, timeoutMs, intervalMs = 60) {
  const samples = [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const sample = await snapshot();
    samples.push(sample);
    if (predicate(sample)) return { reached: true, samples };
    await sleep(intervalMs);
  }
  return { reached: false, samples };
}

async function clickPoint(point, paceMs = 80) {
  for (const [type, buttons] of [
    ["mouseMoved", 0],
    ["mousePressed", 1],
    ["mouseReleased", 0],
  ]) {
    await session.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: "left",
      buttons,
      clickCount: 1,
    });
    await sleep(paceMs);
  }
}

async function pointFor(selector) {
  return evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) throw new Error("Missing target");
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
}

async function ensurePanel() {
  const open = await evaluate(`document
    .querySelector("#codex-wallpaper-p1-controls [data-codex-wallpaper-panel]")
    ?.classList.contains("open")`);
  if (!open)
    await clickPoint(
      await pointFor(
        "#codex-wallpaper-p1-controls [data-codex-wallpaper-settings]"
      )
    );
  await sleep(250);
}

async function cardPoint(title) {
  return evaluate(`(() => {
    const card = [...document.querySelectorAll(
      "#codex-wallpaper-p1-controls .card"
    )].find(
      (item) => item.querySelector("strong")?.textContent === ${JSON.stringify(title)}
    );
    if (!card) throw new Error("Missing wallpaper card");
    const button = card.querySelector(".card-actions button");
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
}

async function clickCard(title, expectedId = null, paceMs = 80) {
  await clickPoint(await cardPoint(title), paceMs);
  if (!expectedId) return null;
  return waitFor((sample) => sample.state?.activeId === expectedId, 4000, 50);
}

async function ensureVideoStable() {
  const stable =
    (await evaluate(
      `globalThis.__codexWallpaperApi.state().activeId === ${JSON.stringify(ids.video)}`
    )) &&
    (await evaluate(
      `Boolean(document.querySelector("#codex-wallpaper-p1 .media:not(.staged) video"))`
    ));
  if (stable) return;
  await clickCard(videoTitle, ids.video);
  await waitFor((sample) => sample.activeVideo && sample.staged === 0, 12000);
}

async function pressHotkey() {
  for (const type of ["rawKeyDown", "keyUp"]) {
    await session.send("Input.dispatchKeyEvent", {
      type,
      key: "W",
      code: "KeyW",
      windowsVirtualKeyCode: 87,
      nativeVirtualKeyCode: 87,
      modifiers: 9,
    });
    await sleep(100);
  }
}

const report = { scenario, startedAt: new Date().toISOString() };
try {
  report.styleHash = await runtimeStyleHash();
  if (!report.styleHash) throw new Error("Missing wallpaper runtime style");
  if (expectedStyleHash && !/^[0-9a-f]{64}$/.test(expectedStyleHash))
    throw new Error("Invalid expected style hash");
  if (expectedStyleHash && report.styleHash !== expectedStyleHash)
    throw new Error(
      `Runtime style mismatch: ${report.styleHash} != ${expectedStyleHash}`
    );
  await ensurePanel();

  if (scenario === "normal") {
    await clickCard(imageTitle, ids.image);
    const image = await waitFor(
      (sample) => sample.activeImage && sample.staged === 0,
      7000
    );
    await sleep(1000);
    await evaluate(
      `globalThis.__acceptanceOldFrame =
        document.querySelector("#codex-wallpaper-p1 .media:not(.staged)")`
    );
    await clickCard(videoTitle, ids.video);
    const video = await waitFor(
      (sample) => sample.activeVideo && sample.staged === 0,
      12000
    );
    report.result = {
      imageReached: image.reached,
      videoReached: video.reached,
      gapSamples: video.samples.filter(
        (sample) => !sample.oldFramePresent && !sample.activeVideo
      ).length,
      previewOrGradientSamples: video.samples.filter(
        (sample) => sample.preview > 0 || sample.builtin
      ).length,
      stagedMaximum: Math.max(...video.samples.map((s) => s.staged), 0),
      final: video.samples.at(-1),
    };
  } else if (scenario === "rapid") {
    await ensureVideoStable();
    const scene = await cardPoint(sceneTitle);
    const image = await cardPoint(imageTitle);
    const video = await cardPoint(videoTitle);
    await clickPoint(scene, 25);
    await sleep(120);
    await clickPoint(image, 25);
    await sleep(120);
    await clickPoint(video, 25);
    const result = await waitFor(
      (sample) =>
        sample.state?.activeId === ids.video &&
        sample.activeVideo &&
        sample.staged === 0,
      15000
    );
    report.result = {
      reached: result.reached,
      sampleCount: result.samples.length,
      stagedMaximum: Math.max(...result.samples.map((s) => s.staged), 0),
      mediaMaximum: Math.max(...result.samples.map((s) => s.media), 0),
      previewOrGradientSamples: result.samples.filter(
        (sample) => sample.preview > 0 || sample.builtin
      ).length,
      final: result.samples.at(-1),
    };
  } else if (scenario === "failure") {
    await ensureVideoStable();
    await evaluate(
      `globalThis.__acceptanceOldFrame =
        document.querySelector("#codex-wallpaper-p1 .media:not(.staged)")`
    );
    await clickCard(brokenTitle, ids.broken);
    const result = await waitFor(
      (sample) => sample.status.includes("视频加载失败"),
      5000
    );
    await sleep(1000);
    report.result = {
      reached: result.reached,
      oldFrameLostSamples: result.samples.filter(
        (sample) => !sample.oldFramePresent
      ).length,
      previewSamples: result.samples.filter((sample) => sample.preview > 0)
        .length,
      final: result.samples.at(-1),
    };
    await clickCard(videoTitle, ids.video);
    const restored = await waitFor(
      (sample) => sample.state?.activeId === ids.video,
      4000
    );
    report.result.restored = restored.reached;
  } else if (scenario === "disable") {
    await ensureVideoStable();
    await pressHotkey();
    const disabled = await waitFor(
      (sample) => sample.state?.state === "disabled",
      3000
    );
    await sleep(1500);
    await pressHotkey();
    const enabled = await waitFor(
      (sample) =>
        sample.state?.state === "enabled" &&
        sample.state?.activeId === ids.video &&
        sample.activeVideo &&
        sample.staged === 0,
      25000
    );
    report.result = {
      disabledReached: disabled.reached,
      reenabledReached: enabled.reached,
      previewOrGradientSamples: enabled.samples.filter(
        (sample) => sample.preview > 0 || sample.builtin
      ).length,
      emptyNativeSamples: enabled.samples.filter(
        (sample) =>
          sample.state?.state === "enabled" &&
          sample.media === 1 &&
          !sample.activeVideo &&
          !sample.activeImage &&
          !sample.activeScene &&
          !sample.builtin
      ).length,
      stagedMaximum: Math.max(...enabled.samples.map((s) => s.staged), 0),
      final: enabled.samples.at(-1),
    };
  } else if (scenario === "web-scene") {
    await ensureVideoStable();
    await clickCard(webTitle, ids.web);
    const web = await waitFor(
      (sample) =>
        sample.activeImage &&
        sample.staged === 0 &&
        sample.status.includes("预览降级"),
      6000
    );
    await sleep(1200);
    await evaluate(
      `globalThis.__acceptanceOldFrame =
        document.querySelector("#codex-wallpaper-p1 .media:not(.staged)")`
    );
    await clickCard(sceneTitle, ids.scene);
    const scene = await waitFor(
      (sample) =>
        sample.activeScene ||
        sample.status.includes("Scene 加载失败") ||
        sample.status.includes("Scene 不支持"),
      15000
    );
    report.result = {
      webReached: web.reached,
      sceneReached: scene.reached,
      gapSamples: scene.samples.filter(
        (sample) => !sample.oldFramePresent && !sample.activeScene
      ).length,
      previewSamples: scene.samples.filter((sample) => sample.preview > 0)
        .length,
      final: scene.samples.at(-1),
    };
  } else {
    throw new Error(`Unknown scenario: ${scenario}`);
  }

  report.endedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));
} finally {
  session.close();
}
