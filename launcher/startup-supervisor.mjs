import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { openMainPageSession, verifyMainFrame } from "./read-only-probe.mjs";
import { payloadFor } from "./static-background.mjs";
import { candidateIdentity, runtimeSource } from "./client-runtime.mjs";
import { attachWallpaperHost, sessionEvaluate } from "./wallpaper-host.mjs";
import { createStartupPreviewStore } from "./startup-preview.mjs";

const port = Number(process.argv[2]);
const page = "app://-/index.html";
const expected = candidateIdentity();
const cancelled = Symbol("cancelled");
const execFileAsync = promisify(execFile);
const previewCache = process.env.CODEX_WALLPAPER_STARTUP_CACHE;
const updateStartupPreview = previewCache
  ? createStartupPreviewStore(previewCache)
  : null;
let awaitingPresentation = process.argv[3] === "--desktop-preview";
const presentationDeadline = awaitingPresentation
  ? delay(25_000, "timeout", { ref: false })
  : null;

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.log(JSON.stringify({ state: "failed", error: "invalid-port" }));
  process.exit(1);
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
process.stdout.on("error", () => input.close());
const commandQueue = [];
const commandWaiters = [];
input.on("line", (line) => {
  const waiter = commandWaiters.shift();
  if (waiter) waiter.resolve(line);
  else commandQueue.push(line);
});
let parentClosed = false;
const parentDone = new Promise((resolve) => {
  input.once("close", () => {
    parentClosed = true;
    for (const waiter of commandWaiters.splice(0)) waiter.resolve(cancelled);
    resolve(cancelled);
  });
});
function waitForCommand(stop = parentDone) {
  let settled = false;
  let waiter;
  const command = new Promise((resolve) => {
    waiter = {
      resolve(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      },
    };
    if (commandQueue.length) waiter.resolve(commandQueue.shift());
    else commandWaiters.push(waiter);
  });
  return Promise.race([command, stop, parentDone]).finally(() => {
    if (settled) return;
    settled = true;
    const index = commandWaiters.indexOf(waiter);
    if (index !== -1) commandWaiters.splice(index, 1);
  });
}
function reply(message) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(message)}\n`, (error) =>
      error ? reject(error) : resolve()
    );
  });
}
let session;
let attaching;
let host;
let mounting = false;
let kept = false;
let ownerCheck;
let recovery;
let phase = "main-page-unavailable";
let frameRetryCount = 0;
let verification = 0;

async function reportPresentation(lost) {
  const result = await Promise.race([
    lost,
    presentationDeadline,
    sessionEvaluate(
      session,
      "globalThis.__codexWallpaperApi?.waitForStartupPresentation()"
    ).catch(() => cancelled),
  ]);
  if (result === cancelled) return;
  const { status, interfaceAt, frameAt } =
    result === "timeout" ? { status: "timeout" } : (result ?? {});
  if (!["visible", "disabled", "timeout"].includes(status)) return;
  awaitingPresentation = false;
  await reply({
    state: "presentation",
    status,
    interfaceAt,
    frameAt,
    hostPid: process.pid,
  }).catch(() => {});
}

async function waitForSession(signal) {
  while (signal ? !signal.aborted : !parentClosed) {
    try {
      const candidate = await openMainPageSession(port, page, true, {
        allowMissing: true,
      });
      if (candidate) return candidate;
    } catch (error) {
      if (
        error?.code !== "ECONNREFUSED" &&
        !["Ambiguous main page", "WebSocket failed"].includes(error?.message)
      )
        throw error;
    }
    if (signal) await delay(150);
    else await Promise.race([delay(150), parentDone]);
  }
  return null;
}

async function cleanupAttempt() {
  if (mounting && session) {
    mounting = false;
    await Promise.race([
      sessionEvaluate(
        session,
        `(async () => {
        if (globalThis.__codexWallpaperStartupPid !== ${process.pid}) return;
        delete globalThis.__codexWallpaperStartupPid;
        await globalThis.__codexWallpaperApi?.discardStartup();
      })()`
      ).catch(() => {}),
      delay(1000, undefined, { ref: false }),
    ]);
  }
  mounting = false;
  const current = host;
  host = null;
  if (current) {
    await current.stop().catch(() => {});
  } else {
    session?.close();
    const lateHost = await attaching?.catch(() => null);
    attaching = null;
    await lateHost?.stop().catch(() => {});
  }
  session = null;
}

try {
  while (kept || !parentClosed) {
    const signal = recovery;
    phase = "main-page-unavailable";
    const libraryPayload = payloadFor();
    session = await waitForSession(signal);
    if (!session) break;
    const expire = () => session.close();
    signal?.addEventListener("abort", expire, { once: true });
    let targetLost = false;
    const lost = new Promise((resolve) => {
      session.onClose(() => {
        targetLost = true;
        resolve(cancelled);
      });
    });
    const stop = kept ? lost : Promise.race([lost, parentDone]);
    try {
      if (signal?.aborted) break;
      phase = "main-frame-unverified";
      const frame = verifyMainFrame(await session.send("Page.getFrameTree"));
      frameRetryCount = 0;
      if (kept) {
        phase = "listener-owner-unverified";
        await execFileAsync(
          join(
            process.env.SystemRoot,
            "System32",
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe"
          ),
          ["-NoProfile", "-NonInteractive", "-EncodedCommand", ownerCheck],
          { windowsHide: true, signal }
        );
      } else {
        verification += 1;
        await reply({ state: "verified", verification, ...frame });
        const approval = `attach ${verification}`;
        let command;
        do {
          command = await waitForCommand(lost);
        } while (command !== approval && command !== cancelled && !targetLost);
        if (command !== approval) continue;
      }
      if (targetLost || (!kept && parentClosed)) continue;
      const payload = await libraryPayload;
      const playbackClock = process.env.CODEX_WALLPAPER_PLAYBACK_CLOCK;
      if (awaitingPresentation && playbackClock) {
        const clock = await readFile(playbackClock, "utf8").catch(() => "");
        const match = /^(\d{1,20}):(\d{13})$/.exec(clock);
        if (match)
          payload.startupVideo = { id: match[1], started: Number(match[2]) };
      }
      if (targetLost || signal?.aborted || (!kept && parentClosed)) continue;
      const source = runtimeSource(
        payload,
        true,
        true,
        Boolean(updateStartupPreview)
      );
      phase = "host-unavailable";
      attaching = attachWallpaperHost({
        port,
        session,
        page,
        source,
        updateStartupPreview,
      });
      const attached = await Promise.race([stop, attaching]);
      if (attached === cancelled) continue;
      host = attached;
      attaching = null;
      if (!host) throw new Error(phase);
      phase = "runtime-not-ready";
      mounting = true;
      const wallpaper = await Promise.race([
        stop,
        sessionEvaluate(
          session,
          `(async () => {
          if (window.top !== window || location.href !== ${JSON.stringify(page)}) return null;
          const existing = globalThis.__codexWallpaperApi;
          if (existing) {
            const identity = existing.identity?.();
            if (identity?.runtimeHash !== ${JSON.stringify(expected.runtimeHash)} ||
                identity?.styleHash !== ${JSON.stringify(expected.styleHash)}) return null;
            return { ...await existing.configureHost(), identity };
          }
          globalThis.__codexWallpaperStartupPid = ${process.pid};
          const state = await ${source};
          return { ...state, identity: globalThis.__codexWallpaperApi.identity() };
        })()`
        ),
      ]);
      if (wallpaper === cancelled || signal?.aborted) continue;
      if (
        !wallpaper?.hostReady ||
        !["enabled", "disabled"].includes(wallpaper.state) ||
        wallpaper.identity?.runtimeHash !== expected.runtimeHash ||
        wallpaper.identity?.styleHash !== expected.styleHash
      )
        throw new Error(phase);
      if (!kept) {
        await reply({
          state: "ready",
          wallpaper: { ...wallpaper, hostPid: process.pid },
        });
        // The target can disappear after ready but before the launcher commits.
        // Honor that commit and reconnect instead of abandoning the handoff.
        const command = await waitForCommand();
        if (command === cancelled || !/^keep [A-Za-z0-9+/=]+$/.test(command))
          break;
        ownerCheck = command.slice(5);
        await reply({ state: "kept", hostPid: process.pid });
        kept = true;
        input.close();
        process.stdin.pause();
      }
      mounting = false;
      signal?.removeEventListener("abort", expire);
      if (awaitingPresentation && !targetLost) await reportPresentation(lost);
      await lost;
      if (host.stopRequested) break;
      recovery = AbortSignal.timeout(25_000);
    } catch (error) {
      if (signal?.aborted) break;
      if (
        !targetLost &&
        !(
          phase === "main-frame-unverified" &&
          ["Unverified main frame", "WebSocket closed"].includes(error?.message)
        )
      )
        throw error;
      if (frameRetryCount >= 4) throw error;
      frameRetryCount += 1;
      if (kept) await delay(150);
      else await Promise.race([delay(150), parentDone]);
    } finally {
      signal?.removeEventListener("abort", expire);
      await cleanupAttempt();
    }
  }
} catch {
  process.exitCode = 1;
  if (!parentClosed)
    await reply({ state: "failed", error: phase }).catch(() => {});
} finally {
  input.close();
  process.stdin.pause();
}
