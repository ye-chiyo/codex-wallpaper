import { pathToFileURL } from "node:url";

import { openMainPageSession } from "../../../../launcher/read-only-probe.mjs";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Usage: node prepare-live.mjs <cdp-port>");

const page = await openMainPageSession(port, "app://-/index.html", true);
try {
  await page.send("Page.bringToFront");
  await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page.send("Page.setWebLifecycleState", { state: "active" });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const result = await page.send("Runtime.evaluate", {
    expression:
      "[innerWidth, innerHeight, devicePixelRatio, document.visibilityState, document.hasFocus()]",
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(JSON.stringify(result.result.value));
  if (
    Math.abs(result.result.value?.[0] - 1707) > 1 ||
    Math.abs(result.result.value?.[1] - 1066) > 1 ||
    result.result.value?.[2] !== 1.5 ||
    result.result.value?.[3] !== "visible"
  )
    process.exitCode = 1;
} finally {
  page.close();
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === new URL(import.meta.url).href
) {
}
