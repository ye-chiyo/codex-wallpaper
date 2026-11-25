import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const suites = [
  {
    name: "Node",
    command: "cmd.exe",
    args: ["/d", "/s", "/c", "pnpm.cmd test"],
  },
  {
    name: "desktop-entry",
    command: "powershell.exe",
    args: ["-NoProfile", "-File", "launcher/desktop-entry.test.ps1"],
  },
  {
    name: "profile-preflight",
    command: "powershell.exe",
    args: ["-NoProfile", "-File", "launcher/profile-preflight.test.ps1"],
  },
  {
    name: "startup-entry",
    command: "powershell.exe",
    args: ["-NoProfile", "-File", "launcher/startup-entry.test.ps1"],
  },
  {
    name: "startup-roots",
    command: "powershell.exe",
    args: ["-NoProfile", "-File", "launcher/startup-roots.test.ps1"],
  },
];

function probe(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => resolve({ code: -1, output: "" }));
    child.on("close", (code) => resolve({ code: code ?? -1, output: "" }));
  });
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const started = performance.now();
    const child = spawn(suite.command, suite.args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    let settled = false;
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      const seconds = (performance.now() - started) / 1000;
      resolve({ ...suite, code, error, seconds });
    };
    child.on("error", (error) => finish(-1, error.message));
    child.on("close", (code) => finish(code ?? -1));
  });
}

function report(status, name, seconds, detail = "") {
  const timing = seconds === undefined ? "" : ` ${seconds.toFixed(1)}s`;
  const suffix = detail ? ` - ${detail}` : "";
  console.log(`${status.padEnd(7)} ${name}${timing}${suffix}`);
}

async function main() {
  console.log("== Codex Wallpaper full test gate ==");
  console.log(`Repository: ${root}`);

  if (!existsSync(edgePath)) {
    report("BLOCKED", "Edge", undefined, edgePath);
    console.log(
      "Browser fixtures cannot run without Edge. Install Edge or set up the required path."
    );
    process.exitCode = 2;
    return;
  }
  report("OK", "Edge", undefined, edgePath);

  const ffmpeg = await probe("where.exe", ["ffmpeg"]);
  if (ffmpeg.code === 0) {
    report("OK", "ffmpeg", undefined, "native startup preview enabled");
  } else {
    report(
      "SKIP",
      "ffmpeg",
      undefined,
      "optional; native startup preview falls back to a static frame"
    );
  }

  const com = await probe("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$shell = New-Object -ComObject Shell.Application; if ($shell) { exit 0 } else { exit 1 }",
  ]);
  if (com.code === 0) {
    report("OK", "PowerShell COM", undefined, "Shell.Application available");
  } else {
    report(
      "SKIP",
      "PowerShell COM",
      undefined,
      "Shell.Application unavailable; launcher suites will report their own result"
    );
  }

  const results = [];
  for (const suite of suites) {
    console.log(`\n== ${suite.name} ==`);
    const result = await runSuite(suite);
    results.push(result);
    if (result.error) {
      report("FAIL", suite.name, result.seconds, result.error);
    } else if (result.code === 0) {
      report("PASS", suite.name, result.seconds);
    } else {
      report("FAIL", suite.name, result.seconds, `exit ${result.code}`);
    }
  }

  const failed = results.filter((result) => result.code !== 0);
  const total = results.reduce((sum, result) => sum + result.seconds, 0);
  console.log("\n== Summary ==");
  for (const result of results) {
    report(
      result.code === 0 ? "PASS" : "FAIL",
      result.name,
      result.seconds,
      result.error || (result.code === 0 ? "" : `exit ${result.code}`)
    );
  }
  console.log(`Total ${total.toFixed(1)}s`);

  if (failed.length) {
    console.log(
      `Full test gate failed: ${failed.map((result) => result.name).join(", ")}`
    );
    process.exitCode = 1;
  } else {
    console.log("Full test gate passed.");
  }
}

await main();
