import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { openMainPageSession } from "../../launcher/read-only-probe.mjs";
import { captureSnapshot } from "./baseline-probe.mjs";

const configKey = "codex-wallpaper-p1-config";
const rootSelector = "#codex-wallpaper-p1";
const controlsSelector = "#codex-wallpaper-p1-controls";
const samplerPath = new URL("./baseline-smoke.mjs", import.meta.url);

const media = {
  image: { id: "2817646508", selector: "img" },
  scene: { id: "2788691565", selector: ".scene-host.ready" },
  video: { id: "3787353838", selector: "video" },
};

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
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

async function waitFor(page, expression, timeoutMilliseconds = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMilliseconds) {
    if (await evaluate(page, expression)) return Date.now() - startedAt;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function ensureLibraryCards(page) {
  const panel = `${controlsSelector} [data-codex-wallpaper-panel]`;
  const cards = `${panel} .card`;
  if (
    await evaluate(
      page,
      `document.querySelectorAll(${JSON.stringify(cards)}).length > 0`
    )
  )
    return;
  if (
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(panel)})?.classList.contains("open")`
    )
  ) {
    await evaluate(
      page,
      `document.querySelector(${JSON.stringify(`${panel} header button`)}).click()`
    );
    await waitFor(
      page,
      `!document.querySelector(${JSON.stringify(`${panel}.open`)})`
    );
  }
  await evaluate(
    page,
    `document.querySelector(${JSON.stringify(`${controlsSelector} [data-codex-wallpaper-settings]`)}).click()`
  );
  await waitFor(
    page,
    `document.querySelector(${JSON.stringify(`${panel}.open`)}) !== null &&
      document.querySelectorAll(${JSON.stringify(cards)}).length > 0`
  );
}

async function choose(page, entry) {
  await ensureLibraryCards(page);
  await evaluate(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} .card[data-entry-id="${entry.id}"] [data-entry-action="use"]`
    )}).click()`
  );
  return waitFor(
    page,
    `(() => {
      const root = document.querySelector(${JSON.stringify(rootSelector)});
      const state = globalThis.__codexWallpaperApi.state();
      const node = root?.querySelector(${JSON.stringify(
        `.media:not(.staged) ${entry.selector}`
      )});
      return (
        state.activeId === ${JSON.stringify(entry.id)} &&
        Boolean(node) &&
        root.querySelectorAll(".media:not(.staged)").length === 1 &&
        root.querySelectorAll(".media.staged").length === 0
      );
    })()`,
    35000
  );
}

async function setBalanced(page) {
  await evaluate(
    page,
    `(() => {
      const select = document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-playback-profile]`
      )});
      select.value = "balanced";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`
  );
}

async function setPerformance(page) {
  await evaluate(
    page,
    `(() => {
      const select = document.querySelector(${JSON.stringify(
        `${controlsSelector} [data-playback-profile]`
      )});
      select.value = "performance";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    })()`
  );
}

async function disable(page) {
  await evaluate(
    page,
    `document.querySelector(${JSON.stringify(
      `${controlsSelector} [data-codex-wallpaper-toggle]`
    )}).click()`
  );
  return waitFor(
    page,
    `globalThis.__codexWallpaperApi.state().state === "disabled" &&
      document.querySelector(${JSON.stringify(rootSelector)}) === null`
  );
}

export function runSampler(
  port,
  durationSeconds,
  repeats,
  requireVisible = false
) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(samplerPath),
        String(port),
        String(durationSeconds),
        String(repeats),
        ...(requireVisible ? ["--visible"] : []),
      ],
      {
        cwd: fileURLToPath(new URL("../..", import.meta.url)),
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Performance sampler exited with ${code}: ${stderr || stdout}`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Invalid performance sampler output: ${error.message}\n${stderr}`
          )
        );
      }
    });
  });
}

function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarizeRuns(runs) {
  return runs.map((run) => ({
    run: run.run,
    durationSeconds: run.durationSeconds,
    intervalCount: run.intervalCount,
    mainRendererId: run.mainRendererId,
    mainRendererCpuPercent: run.mainRendererCpuPercent,
    taskOccupancyPercent:
      (run.taskDurationDelta /
        ((run.samples.at(-1).elapsedMs - run.samples[0].elapsedMs) / 1000)) *
      100,
    scriptDurationDelta: run.scriptDurationDelta,
    jsHeapStart: run.jsHeapStart,
    jsHeapEnd: run.jsHeapEnd,
    jsHeapDelta: run.jsHeapDelta,
    nodesStart: run.nodesStart,
    nodesEnd: run.nodesEnd,
    measuredFps: run.measuredFps,
    state: run.state.state,
    visibility: run.state.visibility,
    viewport: run.state.viewport,
  }));
}

async function conditionSnapshot(port, expected) {
  const snapshot = await captureSnapshot(port);
  if (!expected.visibility || snapshot.visibilityState === expected.visibility)
    return snapshot;
  throw new Error(
    `Expected ${expected.visibility} condition, got ${snapshot.visibilityState}`
  );
}

export async function runPerformanceMatrix({
  port,
  mode,
  initialConfigPath,
  groups = [],
}) {
  const initialConfig = await readFile(initialConfigPath, "utf8");
  const page = await openMainPageSession(port, "app://-/index.html", true);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await sleep(300);
  let changed = false;
  const startedAt = new Date().toISOString();
  const report = {
    startedAt,
    mode,
    conditions: {},
    summary: {},
  };
  try {
    const visibility = await evaluate(page, "document.visibilityState");
    if (visibility !== "visible")
      throw new Error(
        "Start on a visible main page so the media can present its first frame"
      );
    const before = await evaluate(
      page,
      `localStorage.getItem(${JSON.stringify(configKey)})`
    );
    if (before !== initialConfig)
      throw new Error("The saved configuration changed since the backup");

    const definitions =
      mode === "hidden"
        ? [
            {
              key: "scene-hidden-3x60",
              media: media.scene,
              durationSeconds: 60,
              repeats: 3,
              visibility: "hidden",
              profile: "balanced",
            },
          ]
        : [
            {
              key: "video-balanced-3x60",
              media: media.video,
              durationSeconds: 60,
              repeats: 3,
              visibility: "visible",
              profile: "balanced",
            },
            {
              key: "scene-balanced-3x60",
              media: media.scene,
              durationSeconds: 60,
              repeats: 3,
              visibility: "visible",
              profile: "balanced",
            },
            {
              key: "image-balanced-3x20",
              media: media.image,
              durationSeconds: 20,
              repeats: 3,
              visibility: "visible",
              profile: "balanced",
            },
            {
              key: "scene-performance-3x60",
              media: media.scene,
              durationSeconds: 60,
              repeats: 3,
              visibility: "visible",
              profile: "performance",
              lowerQuality: true,
            },
            {
              key: "disabled-visible-3x60",
              durationSeconds: 60,
              repeats: 3,
              visibility: "visible",
            },
          ];

    if (groups.some((group) => !definitions.some(({ key }) => key === group)))
      throw new Error("Unknown performance group");
    const selected = groups.length
      ? groups.map((key) =>
          definitions.find((definition) => definition.key === key)
        )
      : definitions;
    changed = true;
    for (const definition of selected) {
      if (definition.media) {
        if (definition.profile === "performance") await setPerformance(page);
        else await setBalanced(page);
        const settleMilliseconds = await choose(page, definition.media);
        if (mode === "hidden") {
          await evaluate(
            page,
            `globalThis.__t08BeforeHide = document.querySelector("#codex-wallpaper-p1 .scene-host.ready")`
          );
          console.error("Scene ready. Minimize the dedicated Codex window.");
          await waitFor(page, 'document.visibilityState === "hidden"', 180000);
        }
        report.conditions[definition.key] = {
          ...(await conditionSnapshot(port, definition)),
          mediaId: definition.media.id,
          settleMilliseconds,
          lowerQuality: Boolean(definition.lowerQuality),
        };
      } else {
        const disableMilliseconds = await disable(page);
        report.conditions[definition.key] = {
          ...(await conditionSnapshot(port, definition)),
          disableMilliseconds,
        };
      }
      const runs = await runSampler(
        port,
        definition.durationSeconds,
        definition.repeats
      );
      const outputPath = new URL(
        `./evidence/t08-${Date.parse(startedAt)}-${definition.key}.json`,
        import.meta.url
      );
      await writeFile(outputPath, `${JSON.stringify(runs, null, 2)}\n`, "utf8");
      const validRuns = runs.filter((run) =>
        run.samples.every(
          (sample) =>
            sample.state.visibility === definition.visibility &&
            sample.state.theme === "dark" &&
            Math.abs(sample.state.viewport.width - 1707) <= 1 &&
            Math.abs(sample.state.viewport.height - 1066) <= 1 &&
            sample.state.viewport.dpr === 1.5 &&
            sample.mainRenderer?.id === run.mainRendererId &&
            (definition.media
              ? sample.state.state?.activeId === definition.media.id &&
                sample.state.state?.fpsCap ===
                  (definition.lowerQuality ? 15 : 30) &&
                sample.state.state?.state === "enabled"
              : sample.state.state?.state === "disabled" && !sample.state.media)
        )
      );
      const runSummaries = summarizeRuns(validRuns);
      report.summary[definition.key] = {
        rawPath: fileURLToPath(outputPath),
        rejectedRuns: runs
          .filter((run) => !validRuns.includes(run))
          .map(({ run }) => run),
        lowerQuality: Boolean(definition.lowerQuality),
        runs: runSummaries,
        medianMainRendererCpuPercent: median(
          runSummaries.map((run) => run.mainRendererCpuPercent)
        ),
        medianTaskOccupancyPercent: median(
          runSummaries.map((run) => run.taskOccupancyPercent)
        ),
        medianJsHeapDelta: median(runSummaries.map((run) => run.jsHeapDelta)),
      };
      console.error(
        JSON.stringify({
          completed: definition.key,
          medianCpu:
            report.summary[definition.key].medianMainRendererCpuPercent,
        })
      );
    }
    if (mode === "hidden") {
      console.error(
        "Hidden samples finished. Restore the dedicated Codex window."
      );
      await waitFor(page, 'document.visibilityState === "visible"', 180000);
      report.visibilityRecovery = await evaluate(
        page,
        `(() => {
        const root = document.querySelector("#codex-wallpaper-p1");
        const state = globalThis.__codexWallpaperApi.state();
        const scene = root.querySelector(".media:not(.staged) .scene-host.ready");
        return {
          visible: state.visible,
          scenePreserved: Boolean(scene && scene === globalThis.__t08BeforeHide),
          media: root.querySelectorAll(".media:not(.staged)").length,
          staged: root.querySelectorAll(".media.staged").length,
          players: state.playerCount
        };
      })()`
      );
    }

    report.completedAt = new Date().toISOString();
    return report;
  } catch (error) {
    report.error = error.message;
    return report;
  } finally {
    try {
      if (changed) {
        await evaluate(page, `delete globalThis.__t08BeforeHide`);
        await evaluate(
          page,
          `localStorage.setItem(${JSON.stringify(configKey)}, ${JSON.stringify(initialConfig)})`
        );
        await evaluate(page, "globalThis.__codexWallpaperApi.refresh()");
      }
    } finally {
      page.close();
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const [portValue, mode, initialConfigPath, outputPath, ...groups] =
    process.argv.slice(2);
  const port = Number(portValue);
  if (
    !Number.isInteger(port) ||
    !["hidden", "visible"].includes(mode) ||
    !initialConfigPath ||
    !outputPath
  ) {
    console.error(
      "Usage: node real-performance-driver.mjs <cdp-port> <hidden|visible> <initial-config> <output-json>"
    );
    process.exit(1);
  }
  const report = await runPerformanceMatrix({
    port,
    mode,
    initialConfigPath,
    groups,
  });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (report.error) process.exitCode = 1;
}
