import { openMainPageSession } from "../../launcher/read-only-probe.mjs";

const port = Number(process.argv[2]);
const durationSeconds = Number(process.argv[3] || 10);
const repeats = Number(process.argv[4] || 1);
const requireVisible = process.argv.includes("--visible");

async function connectBrowser(port) {
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(
    (response) => response.json()
  );
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(session, expression) {
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

const stateExpression = `(() => {
  const api = globalThis.__codexWallpaperApi;
  const media = document.querySelector("#codex-wallpaper-p1 .media:not(.staged)");
  const video = media?.querySelector("video");
  const quality = video?.getVideoPlaybackQuality();
  return {
    state: api?.state?.() || null,
    visibility: document.visibilityState,
    theme: document.documentElement.dataset.theme || null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    video: video ? {
      width: video.videoWidth, height: video.videoHeight, paused: video.paused,
      readyState: video.readyState, position: video.currentTime,
      totalFrames: quality?.totalVideoFrames ?? null,
      droppedFrames: quality?.droppedVideoFrames ?? null,
      fit: getComputedStyle(video).objectFit
    } : null,
    media: media ? {
      className: media.className,
      tags: [...media.querySelectorAll("img,video,canvas,iframe,.scene-host.ready")]
        .map(node => ({ tag: node.tagName.toLowerCase(), className: node.className || "" }))
    } : null
  };
})()`;

function metricsObject(result) {
  return Object.fromEntries(
    (result?.metrics || []).map(({ name, value }) => [name, value])
  );
}

function nearestRenderer(processes, processTime) {
  return processes
    .filter((process) => process.type === "renderer")
    .map((process) => ({
      ...process,
      delta: Math.abs(process.cpuTime - processTime),
    }))
    .sort((a, b) => a.delta - b.delta)[0];
}

const page = await openMainPageSession(port, "app://-/index.html", true);
const browser = await connectBrowser(port);
try {
  await page.send("Performance.enable");
  const output = [];
  for (let run = 0; run < repeats; run += 1) {
    const samples = [];
    const startedAt = performance.now();
    for (let second = 0; second <= durationSeconds; second += 1) {
      const sampleAt = performance.now();
      const [metricsResult, processResult, state] = await Promise.all([
        page.send("Performance.getMetrics"),
        browser.send("SystemInfo.getProcessInfo"),
        evaluate(page, stateExpression),
      ]);
      const metrics = metricsObject(metricsResult);
      if (requireVisible && state.visibility !== "visible")
        throw new Error("Main page stopped being visible");
      const processes = processResult.processInfo;
      const renderer = nearestRenderer(processes, metrics.ProcessTime);
      const record = {
        elapsedMs: Math.round(sampleAt - startedAt),
        state,
        processTime: metrics.ProcessTime,
        taskDuration: metrics.TaskDuration,
        scriptDuration: metrics.ScriptDuration,
        jsHeapUsed: metrics.JSHeapUsedSize,
        jsHeapTotal: metrics.JSHeapTotalSize,
        nodes: metrics.Nodes,
        mainRenderer: renderer
          ? { id: renderer.id, cpuTime: renderer.cpuTime }
          : null,
        processCpu: processes.map(({ id, type, cpuTime }) => ({
          id,
          type,
          cpuTime,
        })),
      };
      samples.push(record);
      if (second < durationSeconds)
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 - (performance.now() - sampleAt))
        );
    }
    const first = samples[0];
    const last = samples.at(-1);
    const elapsed = (last.elapsedMs - first.elapsedMs) / 1000;
    output.push({
      run: run + 1,
      durationSeconds,
      intervalCount: samples.length,
      mainRendererId: first.mainRenderer?.id || null,
      mainRendererCpuPercent: first.mainRenderer
        ? ((last.mainRenderer.cpuTime - first.mainRenderer.cpuTime) / elapsed) *
          100
        : null,
      processTimeDelta: last.processTime - first.processTime,
      taskDurationDelta: last.taskDuration - first.taskDuration,
      scriptDurationDelta: last.scriptDuration - first.scriptDuration,
      jsHeapStart: first.jsHeapUsed,
      jsHeapEnd: last.jsHeapUsed,
      jsHeapDelta: last.jsHeapUsed - first.jsHeapUsed,
      nodesStart: first.nodes,
      nodesEnd: last.nodes,
      measuredFps: last.state.state?.measuredFps ?? null,
      state: last.state,
      samples,
    });
  }
  console.log(JSON.stringify(output, null, 2));
} finally {
  await page.send("Performance.disable").catch(() => {});
  page.close();
  browser.close();
}
