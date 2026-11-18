import { pathToFileURL } from "node:url";

import { candidateIdentity } from "../../launcher/client-runtime.mjs";
import { captureSnapshot } from "./baseline-probe.mjs";

export function compareCandidateIdentity(snapshot, expected) {
  const actual = snapshot?.runtimeIdentity || {};
  const checks = {
    runtimeHash: actual.runtimeHash === expected.runtimeHash,
    styleHash:
      actual.styleHash === expected.styleHash &&
      snapshot?.styleHash === expected.styleHash,
  };
  return {
    pass: checks.runtimeHash && checks.styleHash,
    expected,
    actual: {
      runtimeHash: actual.runtimeHash || null,
      styleHash: actual.styleHash || null,
      capturedStyleHash: snapshot?.styleHash || null,
    },
    checks,
    state: snapshot?.runtimeState?.state || null,
    libraryCount: snapshot?.runtimeState?.libraryCount || 0,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error("Usage: node candidate-check.mjs <cdp-port>");
    process.exit(1);
  }
  const result = compareCandidateIdentity(
    await captureSnapshot(port),
    candidateIdentity()
  );
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exit(2);
}
