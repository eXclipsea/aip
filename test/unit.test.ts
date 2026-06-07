import { test } from "node:test";
import assert from "node:assert/strict";

import { parseModelRef, formatBytes, envName } from "../src/lib/ui.js";
import { detectLicense } from "../src/lib/license.js";
import { nextVersion, isValidVersion, compareVersions } from "../src/lib/semver.js";
import { lockSatisfiesManifest } from "../src/lib/lockfile.js";
import type { Manifest, Lockfile } from "../src/types.js";

test("parseModelRef: bare name", () => {
  assert.deepEqual(parseModelRef("qwen2.5"), { name: "qwen2.5" });
});

test("parseModelRef: colon tag (Ollama style)", () => {
  assert.deepEqual(parseModelRef("qwen2.5:7b"), { name: "qwen2.5", version: "7b" });
});

test("parseModelRef: at tag (npm style)", () => {
  assert.deepEqual(parseModelRef("qwen2.5@7b"), { name: "qwen2.5", version: "7b" });
});

test("parseModelRef: namespace is preserved, tag split correctly", () => {
  assert.deepEqual(parseModelRef("library/qwen2.5:7b"), {
    name: "library/qwen2.5",
    version: "7b",
  });
});

test("formatBytes: scales units", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(45949216), "43.8 MB");
  assert.equal(formatBytes(4_509_715_661), "4.2 GB");
});

test("envName: shell-safe uppercase", () => {
  assert.equal(envName("qwen2.5"), "QWEN2_5");
  assert.equal(envName("deepseek-r1"), "DEEPSEEK_R1");
  assert.equal(envName("library/all-minilm"), "LIBRARY_ALL_MINILM");
});

test("detectLicense: recognizes common licenses", () => {
  assert.equal(detectLicense("Apache License\nVersion 2.0, January 2004"), "Apache-2.0");
  assert.equal(detectLicense("MIT License\n\nPermission is hereby granted"), "MIT");
  assert.equal(detectLicense(""), "see model card");
});

test("semver: bump and validate", () => {
  assert.equal(nextVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(nextVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(nextVersion("1.2.3", "major"), "2.0.0");
  assert.equal(nextVersion("1.2.3", "5.0.0"), "5.0.0");
  assert.equal(isValidVersion("1.0.0"), true);
  assert.equal(isValidVersion("1.0"), false);
  assert.throws(() => nextVersion("1.2.3", "not-a-version"));
});

test("compareVersions: orders semver", () => {
  assert.equal(compareVersions("1.0.0", "1.0.1") < 0, true);
  assert.equal(compareVersions("2.0.0", "1.9.9") > 0, true);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("lockSatisfiesManifest: detects out-of-sync deps", () => {
  const manifest: Manifest = { name: "p", models: { "qwen2.5": "7b", mistral: "7b" } };
  const lock: Lockfile = {
    lockfileVersion: 1,
    models: {
      "qwen2.5": { version: "7b", sha256: "a", sizeBytes: 1, downloadUrl: "u" },
    },
  };
  const status = lockSatisfiesManifest(manifest, lock);
  assert.equal(status.inSync, false);
  assert.deepEqual(status.missing, ["mistral"]);
});

test("lockSatisfiesManifest: in sync", () => {
  const manifest: Manifest = { name: "p", models: { qwen: "7b" } };
  const lock: Lockfile = {
    lockfileVersion: 1,
    models: { qwen: { version: "7b", sha256: "a", sizeBytes: 1, downloadUrl: "u" } },
  };
  assert.equal(lockSatisfiesManifest(manifest, lock).inSync, true);
});
