import { rmSync, writeFileSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import type { ModelMeta, LockEntry } from "../types.js";
import { resolveMeta } from "../lib/registry.js";
import { download } from "../lib/downloader.js";
import { verifyFile } from "../lib/hash.js";
import {
  paths,
  ensureModelDir,
  isInstalled,
  readCache,
  upsertCacheEntry,
} from "../lib/store.js";
import {
  setLockEntry,
  readLockfile,
  lockEntryFromMeta,
  metaFromLock,
} from "../lib/lockfile.js";
import { readManifest, manifestExists, addDependency } from "../lib/manifest.js";
import { ok, fail, info, formatBytes, parseModelRef } from "../lib/ui.js";

/** Download → verify → persist meta.json + cache entry. Shared by all paths. */
async function downloadStoreVerify(meta: ModelMeta): Promise<boolean> {
  const dir = ensureModelDir(meta.name, meta.version);
  const modelFile = paths.modelFile(meta.name, meta.version);

  try {
    await download(meta, modelFile);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    fail((err as Error).message);
    return false;
  }

  const verifySpinner = ora("Verifying sha256...").start();
  const valid = await verifyFile(modelFile, meta.sha256);
  verifySpinner.stop();
  if (!valid) {
    rmSync(dir, { recursive: true, force: true });
    fail("Hash verification failed. File may be corrupted. Deleted.");
    return false;
  }

  writeFileSync(paths.metaFile(meta.name, meta.version), JSON.stringify(meta, null, 2));
  upsertCacheEntry({
    name: meta.name,
    version: meta.version,
    sha256: meta.sha256,
    sizeBytes: meta.sizeBytes,
    quantization: meta.quantization,
    license: meta.license,
    publisher: meta.publisher,
    installedAt: new Date().toISOString(),
    path: modelFile,
    family: meta.family,
    parameterSize: meta.parameterSize,
  });
  return true;
}

interface InstallOpts {
  force?: boolean;
  /** Add to aip.json (default true for an explicit `aip install <model>`). */
  save?: boolean;
  /** Update aip.lock with the resolved digest (default true). */
  updateLock?: boolean;
}

/** Resolve a model live, install it, and update manifest/lock per opts. */
export async function installOne(
  name: string,
  version?: string,
  opts: InstallOpts = {}
): Promise<boolean> {
  let meta: ModelMeta;
  const spinner = ora(`Resolving ${name}${version ? ":" + version : ""} from registry...`).start();
  try {
    meta = await resolveMeta(name, version);
  } catch (err) {
    spinner.stop();
    fail((err as Error).message);
    return false;
  }
  spinner.stop();

  if (!opts.force && isInstalled(meta.name, meta.version)) {
    const existing = readCache().models.find(
      (m) => m.name === meta.name && m.version === meta.version
    );
    if (existing?.sha256 === meta.sha256) {
      info(`${meta.name}@${meta.version} already installed (${formatBytes(meta.sizeBytes)}) — skipping.`);
      if (opts.save !== false) addDependency(meta.name, meta.version);
      if (opts.updateLock !== false) setLockEntry(meta.name, lockEntryFromMeta(meta));
      return true;
    }
  }

  if (!(await downloadStoreVerify(meta))) return false;

  if (opts.save !== false) addDependency(meta.name, meta.version);
  if (opts.updateLock !== false) setLockEntry(meta.name, lockEntryFromMeta(meta));

  ok(`Installed ${meta.name}@${meta.version} (${formatBytes(meta.sizeBytes)})`);
  return true;
}

/** Install strictly from a lock entry — by digest, no registry resolve. */
export async function installFromLock(name: string, entry: LockEntry): Promise<boolean> {
  const meta = metaFromLock(name, entry);
  if (isInstalled(name, entry.version)) {
    const existing = readCache().models.find(
      (m) => m.name === name && m.version === entry.version
    );
    if (existing?.sha256 === entry.sha256) {
      info(`${name}@${entry.version} already installed — skipping.`);
      return true;
    }
  }
  info(`Fetching ${name}@${entry.version} (locked)...`);
  if (!(await downloadStoreVerify(meta))) return false;
  ok(`Installed ${name}@${entry.version} (${formatBytes(entry.sizeBytes)})`);
  return true;
}

export interface InstallFlags {
  save?: boolean;
}

export async function install(ref?: string, flags: InstallFlags = {}): Promise<void> {
  // Explicit install of one model → save to manifest by default.
  if (ref) {
    const { name, version } = parseModelRef(ref);
    const success = await installOne(name, version, { save: flags.save !== false });
    if (!success) process.exitCode = 1;
    return;
  }

  // No arg → install the whole project from aip.json, honoring aip.lock.
  if (!manifestExists()) {
    fail(
      "No model specified and no aip.json found. " +
        "Run 'aip install <model>:<tag>' to add one, or 'aip init' to start a project."
    );
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();
  const entries = Object.entries(manifest.models);
  if (entries.length === 0) {
    info("aip.json lists no models. Add one with 'aip install <model>:<tag>'.");
    return;
  }

  const lock = readLockfile();
  info(`Installing ${entries.length} model(s) from aip.json...`);
  let failures = 0;
  for (const [name, version] of entries) {
    const locked = lock.models[name];
    const success =
      locked && locked.version === version
        ? await installFromLock(name, locked) // reproducible
        : await installOne(name, version, { save: false, updateLock: true }); // resolve + lock
    if (!success) failures++;
  }

  if (failures > 0) {
    fail(`${failures} model(s) failed to install.`);
    process.exitCode = 1;
  } else {
    ok(chalk.bold("All models installed."));
  }
}
