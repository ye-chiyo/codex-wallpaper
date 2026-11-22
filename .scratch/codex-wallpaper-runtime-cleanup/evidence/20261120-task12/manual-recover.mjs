import { pathToFileURL } from "node:url";

import {
  openMainPageSession,
  verifyMainFrame,
} from "../../../../launcher/read-only-probe.mjs";
import { payloadFor } from "../../../../launcher/static-background.mjs";
import {
  candidateIdentity,
  runtimeSource,
} from "../../../../launcher/client-runtime.mjs";
import {
  attachWallpaperHost,
  sessionEvaluate,
} from "../../../../launcher/wallpaper-host.mjs";

const port = Number(process.argv[2]);
const page = "app://-/index.html";
const api = "globalThis.__codexWallpaperApi";

if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Usage: node manual-recover.mjs <cdp-port>");

const session = await openMainPageSession(port, page, true);
let host;
try {
  verifyMainFrame(await session.send("Page.getFrameTree"));
  const source = runtimeSource(await payloadFor(), true);
  host = await attachWallpaperHost({ port, session, page, source });
  if (!host) throw new Error("Wallpaper host lock is already held");
  await sessionEvaluate(
    session,
    `(async () => { await ${api}?.discardStartup?.(); })()`
  );
  const state = await sessionEvaluate(
    session,
    `(async () => {
      if (window.top !== window || location.href !== ${JSON.stringify(page)}) return null;
      const state = await ${source};
      return { ...state, identity: ${api}.identity() };
    })()`
  );
  if (!state?.hostReady)
    await sessionEvaluate(session, `${api}.configureHost()`);
  const identity = await sessionEvaluate(session, `${api}.identity()`);
  const expected = candidateIdentity();
  if (
    identity?.runtimeHash !== expected.runtimeHash ||
    identity?.styleHash !== expected.styleHash
  )
    throw new Error("Recovered runtime did not match the worktree candidate");
  console.log(
    JSON.stringify({
      ready: true,
      port,
      identity,
      state: await sessionEvaluate(session, `${api}.state()`),
    })
  );
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
} finally {
  await host?.stop().catch(() => {});
  session.close();
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === new URL(import.meta.url).href
) {
}
