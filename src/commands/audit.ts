import { existsSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import { readCache, paths } from "../lib/store.js";
import { sha256File } from "../lib/hash.js";
import { manifestExists, readManifest } from "../lib/manifest.js";
import { readLockfile, lockSatisfiesManifest } from "../lib/lockfile.js";
import { ok, fail, info, printJson } from "../lib/ui.js";

interface AuditEntry {
  name: string;
  version: string;
  status: "ok" | "corrupt" | "missing";
}

/**
 * Integrity audit: re-hash every installed model and confirm it matches the
 * recorded content digest, then check manifest/lock consistency. The package
 * manager's "never trust a filename" guarantee, on demand (like `npm audit`).
 */
export async function audit(opts: { json?: boolean } = {}): Promise<void> {
  const cache = readCache();
  const entries: AuditEntry[] = [];

  const spinner = opts.json ? null : ora("Auditing installed models...").start();
  for (const m of cache.models) {
    const file = paths.modelFile(m.name, m.version);
    if (!existsSync(file)) {
      entries.push({ name: m.name, version: m.version, status: "missing" });
      continue;
    }
    const actual = await sha256File(file);
    entries.push({
      name: m.name,
      version: m.version,
      status: actual === m.sha256 ? "ok" : "corrupt",
    });
  }
  spinner?.stop();

  const corrupt = entries.filter((e) => e.status === "corrupt");
  const missing = entries.filter((e) => e.status === "missing");

  let lockInSync = true;
  let lockMissing: string[] = [];
  if (manifestExists()) {
    const status = lockSatisfiesManifest(readManifest(), readLockfile());
    lockInSync = status.inSync;
    lockMissing = status.missing;
  }

  if (opts.json) {
    const problems = corrupt.length + missing.length + (lockInSync ? 0 : 1);
    printJson({
      audited: entries.length,
      ok: entries.length - corrupt.length - missing.length,
      corrupt: corrupt.map((e) => `${e.name}@${e.version}`),
      missing: missing.map((e) => `${e.name}@${e.version}`),
      lockInSync,
      lockMissing,
      problems,
    });
    if (problems > 0) process.exitCode = 1;
    return;
  }

  if (entries.length === 0) {
    info("No models installed — nothing to audit.");
  } else {
    for (const e of entries) {
      if (e.status === "ok") ok(`${e.name}@${e.version} integrity verified`);
      else if (e.status === "corrupt") fail(`${e.name}@${e.version} CORRUPT — reinstall it`);
      else fail(`${e.name}@${e.version} file MISSING — reinstall it`);
    }
  }

  if (!lockInSync) fail(`aip.lock out of sync with aip.json: ${lockMissing.join(", ")}`);

  const problems = corrupt.length + missing.length + (lockInSync ? 0 : 1);
  console.log();
  if (problems === 0) {
    console.log(chalk.green(`found 0 problems in ${entries.length} model(s)`));
  } else {
    console.log(chalk.red(`found ${problems} problem(s)`));
    process.exitCode = 1;
  }
}
