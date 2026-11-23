import { execFile } from "node:child_process";
import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const lockVersion = 1;
const execFileAsync = promisify(execFile);
const powershell = join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe"
);

function assertPort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid port");
}

export function lockPathFor(port, lockFolder = tmpdir()) {
  assertPort(port);
  return join(lockFolder, `codex-wallpaper-host-${port}.lock`);
}

async function processStartTime(pid) {
  try {
    const { stdout } = await execFileAsync(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$target = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $target) { 'missing' } else { try { $target.StartTime.ToUniversalTime().ToString('o') } catch { 'unavailable' } }`,
      ],
      { windowsHide: true, timeout: 5000 }
    );
    const value = stdout.trim();
    if (value === "missing") return { exists: false };
    if (value === "unavailable") return { exists: true, unavailable: true };
    if (!Number.isFinite(Date.parse(value)))
      return { exists: true, unavailable: true };
    return { exists: true, startedAt: value };
  } catch {
    return { queryFailed: true };
  }
}

function parseLock(text, port) {
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return { state: "corrupt", valid: false, reason: "invalid-json" };
  }
  if (
    record === null ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt))
  )
    return { state: "corrupt", valid: false, reason: "invalid-schema" };
  if (record.version !== lockVersion)
    return { state: "corrupt", valid: false, reason: "version-mismatch" };
  if (record.port !== port)
    return { state: "corrupt", valid: false, reason: "port-mismatch" };
  return { record };
}

export async function inspectHostLock(port, lockFolder = tmpdir()) {
  const lockPath = lockPathFor(port, lockFolder);
  let text;
  try {
    text = await readFile(lockPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { state: "missing", valid: false };
    return {
      state: "unverifiable",
      valid: true,
      reason: "lock-read-failed",
    };
  }

  const parsed = parseLock(text, port);
  if (parsed.state) return parsed;
  const { record } = parsed;
  const identity = await processStartTime(record.pid);
  if (identity.queryFailed)
    return {
      state: "unverifiable",
      valid: true,
      reason: "process-query-failed",
      pid: record.pid,
    };
  if (!identity.exists)
    return {
      state: "stale",
      valid: false,
      reason: "process-missing",
      pid: record.pid,
      createdAt: record.createdAt,
    };
  if (identity.unavailable)
    return {
      state: "unverifiable",
      valid: true,
      reason: "process-start-time-unavailable",
      pid: record.pid,
    };
  if (identity.startedAt !== record.createdAt)
    return {
      state: "stale",
      valid: false,
      reason: "created-at-mismatch",
      pid: record.pid,
      createdAt: record.createdAt,
      observedCreatedAt: identity.startedAt,
    };
  return {
    state: "held",
    valid: true,
    pid: record.pid,
    createdAt: record.createdAt,
    port: record.port,
  };
}

export async function createHostLock(port, lockFolder = tmpdir()) {
  const lockPath = lockPathFor(port, lockFolder);
  const identity = await processStartTime(process.pid);
  if (!identity.exists || identity.unavailable || identity.queryFailed)
    throw new Error("Cannot determine host process creation time");
  const record = {
    version: lockVersion,
    pid: process.pid,
    createdAt: identity.startedAt,
    port,
  };
  const handle = await open(lockPath, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
    await handle.sync();
    return { lockPath, handle, record };
  } catch (error) {
    await handle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
    throw error;
  }
}

export async function acquireHostLock(port, lockFolder = tmpdir()) {
  const lockPath = lockPathFor(port, lockFolder);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const lock = await createHostLock(port, lockFolder);
      return {
        acquired: true,
        lock,
        status: {
          state: "held",
          valid: true,
          pid: lock.record.pid,
          createdAt: lock.record.createdAt,
          port,
        },
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const status = await inspectHostLock(port, lockFolder);
      if (status.valid) return { acquired: false, status };
      if (status.state === "missing") continue;
      await unlink(lockPath).catch((unlinkError) => {
        if (unlinkError.code !== "ENOENT") throw unlinkError;
      });
    }
  }
  return {
    acquired: false,
    status: {
      state: "unverifiable",
      valid: true,
      reason: "lock-contended",
    },
  };
}

export async function releaseHostLock(lock) {
  await lock.handle?.close().catch(() => {});
  try {
    const record = JSON.parse(await readFile(lock.lockPath, "utf8"));
    if (
      record.version === lock.record.version &&
      record.pid === lock.record.pid &&
      record.createdAt === lock.record.createdAt &&
      record.port === lock.record.port
    )
      await unlink(lock.lockPath);
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
}

function parseCheckArguments(args) {
  if (args[0] !== "check") return null;
  let port = null;
  let lockFolder = tmpdir();
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] === "--port") port = Number(args[++index]);
    else if (args[index] === "--lock-folder")
      lockFolder = args[++index] || lockFolder;
    else return null;
  }
  if (!Number.isInteger(port)) return null;
  return { port, lockFolder };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === new URL(import.meta.url).href
) {
  const options = parseCheckArguments(process.argv.slice(2));
  if (!options) {
    console.error(
      "Usage: node launcher/host-lock.mjs check --port N [--lock-folder DIR]"
    );
    process.exitCode = 2;
  } else {
    try {
      console.log(
        JSON.stringify(await inspectHostLock(options.port, options.lockFolder))
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          state: "unverifiable",
          valid: true,
          reason: "inspection-failed",
          message: error?.message || "unknown error",
        })
      );
      process.exitCode = 1;
    }
  }
}
