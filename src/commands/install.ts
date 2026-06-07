import { rmSync, writeFileSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import type { ModelMeta } from "../types.js";
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
import { setLockEntry } from "../lib/lockfile.js";
import { readManifest, manifestExists } from "../lib/manifest.js";
import { ok, fail, info, formatBytes, parseModelRef } from "../lib/ui.js";

interface InstallOpts {
  /** Reinstall even if already present (used by `update`). */
  force?: boolean;
}

/** Install one model end-to-end against the live registry. Returns true on success. */
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
    // Already installed and hash matches what the registry now reports → skip.
    const existing = readCache().models.find(
      (m) => m.name === meta.name && m.version === meta.version
    );
    if (existing?.sha256 === meta.sha256) {
      info(`${meta.name}@${meta.version} already installed (${formatBytes(meta.sizeBytes)}) — skipping.`);
      return true;
    }
  }

  const dir = ensureModelDir(meta.name, meta.version);
  const modelFile = paths.modelFile(meta.name, meta.version);

  try {
    await download(meta, modelFile);
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    fail((err as Error).message);
    return false;
  }

  // Verify content hash against the registry digest — never trust a filename.
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

  setLockEntry(meta.name, {
    version: meta.version,
    sha256: meta.sha256,
    sizeBytes: meta.sizeBytes,
    downloadUrl: meta.downloadUrl,
  });

  ok(`Installed ${meta.name}@${meta.version} (${formatBytes(meta.sizeBytes)})`);
  return true;
}

export async function install(ref?: string): Promise<void> {
  if (!ref) {
    if (!manifestExists()) {
      fail(
        "No model specified and no aip.json found. " +
          "Run 'aip install <model>:<tag>' or create an aip.json with a \"models\" map."
      );
      process.exitCode = 1;
      return;
    }
    const manifest = readManifest();
    const entries = Object.entries(manifest.models);
    if (entries.length === 0) {
      info("aip.json has no models listed. Nothing to install.");
      return;
    }
    info(`Installing ${entries.length} model(s) from aip.json...`);
    let failures = 0;
    for (const [name, version] of entries) {
      const success = await installOne(name, version);
      if (!success) failures++;
    }
    if (failures > 0) {
      fail(`${failures} model(s) failed to install.`);
      process.exitCode = 1;
    } else {
      ok(chalk.bold("All models installed."));
    }
    return;
  }

  const { name, version } = parseModelRef(ref);
  const success = await installOne(name, version);
  if (!success) process.exitCode = 1;
}
