import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  acquireHostLock,
  createHostLock,
  inspectHostLock,
  lockPathFor,
  releaseHostLock,
} from "./host-lock.mjs";
import { attachWallpaperHost } from "./wallpaper-host.mjs";

async function temporaryLockFolder(t) {
  const folder = await mkdtemp(join(tmpdir(), "codex-wallpaper-lock-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

async function unusedPort(t) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    const locked = await access(lockPathFor(port)).then(
      () => true,
      () => false
    );
    if (!locked) return port;
  }
  throw new Error("Could not find an unlocked fixture port");
}

async function writeRecord(lockPath, record) {
  await writeFile(lockPath, `${JSON.stringify(record)}\n`);
}

test("a live PID with a different creation time is a recoverable stale lock", async (t) => {
  const folder = await temporaryLockFolder(t);
  const port = await unusedPort(t);
  const lockPath = lockPathFor(port, folder);
  const current = await createHostLock(port, folder);
  const record = {
    ...current.record,
    pid: process.pid,
    createdAt: "2000-01-01T00:00:00.0000000Z",
  };
  await releaseHostLock(current);
  await writeRecord(lockPath, record);

  const inspection = await inspectHostLock(port, folder);
  assert.equal(inspection.valid, false);
  assert.equal(inspection.state, "stale");
  assert.equal(inspection.reason, "created-at-mismatch");

  const acquired = await acquireHostLock(port, folder);
  assert.equal(acquired.acquired, true);
  const replaced = JSON.parse(await readFile(lockPath, "utf8"));
  assert.equal(replaced.pid, process.pid);
  assert.notEqual(replaced.createdAt, record.createdAt);
  await releaseHostLock(acquired.lock);
  await assert.rejects(access(lockPath), { code: "ENOENT" });
});

test("a missing PID is an expired lock and startup replaces it", async (t) => {
  const folder = await temporaryLockFolder(t);
  const port = await unusedPort(t);
  const lockPath = lockPathFor(port, folder);
  const exited = spawn(process.execPath, ["-e", ""], {
    stdio: "ignore",
    windowsHide: true,
  });
  await once(exited, "exit");
  await writeRecord(lockPath, {
    version: 1,
    pid: exited.pid,
    createdAt: "2000-01-01T00:00:00.0000000Z",
    port,
  });

  const inspection = await inspectHostLock(port, folder);
  assert.equal(inspection.valid, false);
  assert.equal(inspection.state, "stale");
  assert.equal(inspection.reason, "process-missing");

  const acquired = await acquireHostLock(port, folder);
  assert.equal(acquired.acquired, true);
  const replaced = JSON.parse(await readFile(lockPath, "utf8"));
  assert.equal(replaced.pid, process.pid);
  await releaseHostLock(acquired.lock);
  await assert.rejects(access(lockPath), { code: "ENOENT" });
});

test("startup recovers after the original lock owner exits", async (t) => {
  const folder = await temporaryLockFolder(t);
  const port = await unusedPort(t);
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { createHostLock } from ${JSON.stringify(
        new URL("./host-lock.mjs", import.meta.url).href
      )}; const lock = await createHostLock(${port}, ${JSON.stringify(folder)}); console.log(lock.record.pid); setInterval(() => {}, 1000);`,
    ],
    { stdio: ["ignore", "pipe", "ignore"], windowsHide: true }
  );
  t.after(() => child.kill());
  const [line] = await once(child.stdout, "data");
  assert.equal(Number(line.toString().trim()), child.pid);
  assert.equal((await inspectHostLock(port, folder)).state, "held");

  child.kill();
  await once(child, "exit");
  const inspection = await inspectHostLock(port, folder);
  assert.equal(inspection.valid, false);
  assert.equal(inspection.state, "stale");
  assert.equal(inspection.reason, "process-missing");

  const acquired = await acquireHostLock(port, folder);
  assert.equal(acquired.acquired, true);
  assert.equal(acquired.lock.record.pid, process.pid);
  await releaseHostLock(acquired.lock);
  await assert.rejects(access(lockPathFor(port, folder)), { code: "ENOENT" });
});

test("startup acquires and releases the lock when no lock exists", async (t) => {
  const folder = await temporaryLockFolder(t);
  const port = await unusedPort(t);
  const lockPath = lockPathFor(port, folder);

  assert.deepEqual(await inspectHostLock(port, folder), {
    state: "missing",
    valid: false,
  });
  const acquired = await acquireHostLock(port, folder);
  assert.equal(acquired.acquired, true);
  const record = JSON.parse(await readFile(lockPath, "utf8"));
  assert.deepEqual(record, {
    version: 1,
    pid: process.pid,
    createdAt: acquired.lock.record.createdAt,
    port,
  });
  assert.equal((await inspectHostLock(port, folder)).state, "held");

  await releaseHostLock(acquired.lock);
  await assert.rejects(access(lockPath), { code: "ENOENT" });
});

test("a held lock rejects a second host and keeps the first owner", async (t) => {
  const port = await unusedPort(t);
  const session = {
    async send() {
      return { result: {} };
    },
    on() {},
    onClose() {},
    close() {},
  };
  const first = await attachWallpaperHost({
    port,
    session,
    source: "({ state: 'disabled' })",
  });
  assert.ok(first);
  t.after(() => first.stop());

  const second = await attachWallpaperHost({
    port,
    session,
    source: "({ state: 'disabled' })",
  });
  assert.equal(second, null);
  const lockPath = join(tmpdir(), `codex-wallpaper-host-${port}.lock`);
  assert.equal(JSON.parse(await readFile(lockPath, "utf8")).pid, process.pid);
  assert.equal((await inspectHostLock(port)).state, "held");
});

test("a corrupt lock is diagnosed and replaced during recovery", async (t) => {
  const folder = await temporaryLockFolder(t);
  const port = await unusedPort(t);
  const lockPath = lockPathFor(port, folder);
  await writeFile(lockPath, "{not-json");

  const inspection = await inspectHostLock(port, folder);
  assert.equal(inspection.valid, false);
  assert.equal(inspection.state, "corrupt");
  assert.equal(inspection.reason, "invalid-json");

  const acquired = await acquireHostLock(port, folder);
  assert.equal(acquired.acquired, true);
  const record = JSON.parse(await readFile(lockPath, "utf8"));
  assert.equal(record.version, 1);
  assert.equal(record.pid, process.pid);
  await releaseHostLock(acquired.lock);
  await assert.rejects(access(lockPath), { code: "ENOENT" });
});

test("a non-CDP process on the port produces a diagnostic", async (t) => {
  const server = createServer((_request, response) => {
    response.statusCode = 418;
    response.end("not Codex");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const child = spawn(
    process.execPath,
    ["--no-use-env-proxy", "launcher/wallpaper-host.mjs", String(port)],
    { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [code] = await once(child, "exit");

  assert.equal(code, 1);
  const diagnostic = JSON.parse(stderr.trim());
  assert.equal(diagnostic.state, "error");
  assert.equal(diagnostic.reason, "port-not-codex-main-page");
});
