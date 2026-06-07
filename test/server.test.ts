import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createRegistryServer } from "../src/lib/server.js";

let server: Server;
let base: string;
let dir: string;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "aip-reg-test-"));
  server = createRegistryServer({ dir, quiet: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

test("GET /v2/ returns 200", async () => {
  const res = await fetch(`${base}/v2/`);
  assert.equal(res.status, 200);
});

test("OCI blob push + pull round-trips by digest", async () => {
  const body = Buffer.from("hello-aip-registry");
  const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;

  // Start upload
  const start = await fetch(`${base}/v2/library/demo/blobs/uploads/`, { method: "POST" });
  assert.equal(start.status, 202);
  const location = start.headers.get("location");
  assert.ok(location);

  // Complete upload with digest
  const put = await fetch(`${base}${location}?digest=${digest}`, {
    method: "PUT",
    body: new Uint8Array(body),
  });
  assert.equal(put.status, 201);

  // HEAD + GET the blob back
  const head = await fetch(`${base}/v2/library/demo/blobs/${digest}`, { method: "HEAD" });
  assert.equal(head.status, 200);
  const get = await fetch(`${base}/v2/library/demo/blobs/${digest}`);
  assert.equal(await get.text(), "hello-aip-registry");
});

test("rejects a blob whose bytes don't match the digest", async () => {
  const start = await fetch(`${base}/v2/library/demo/blobs/uploads/`, { method: "POST" });
  const location = start.headers.get("location")!;
  const wrong = "sha256:" + "0".repeat(64);
  const put = await fetch(`${base}${location}?digest=${wrong}`, {
    method: "PUT",
    body: new Uint8Array(Buffer.from("tampered")),
  });
  assert.equal(put.status, 400);
});

test("manifest PUT/GET and tags/list + _catalog", async () => {
  const manifest = { schemaVersion: 2, layers: [] };
  const put = await fetch(`${base}/v2/library/demo/manifests/v1`, {
    method: "PUT",
    headers: { "Content-Type": "application/vnd.docker.distribution.manifest.v2+json" },
    body: JSON.stringify(manifest),
  });
  assert.equal(put.status, 201);

  const get = await fetch(`${base}/v2/library/demo/manifests/v1`);
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), manifest);

  const tags = (await (await fetch(`${base}/v2/library/demo/tags/list`)).json()) as { tags: string[] };
  assert.ok(tags.tags.includes("v1"));

  const cat = (await (await fetch(`${base}/v2/_catalog`)).json()) as { repositories: string[] };
  assert.ok(cat.repositories.includes("library/demo"));
});

test("unknown manifest is 404", async () => {
  const res = await fetch(`${base}/v2/library/demo/manifests/nope`);
  assert.equal(res.status, 404);
});
