import chalk from "chalk";
import { readManifest, manifestExists } from "../lib/manifest.js";
import {
  readLockfile,
  lockfileExists,
  lockSatisfiesManifest,
} from "../lib/lockfile.js";
import { installFromLock } from "./install.js";
import { ok, fail, info } from "../lib/ui.js";

/**
 * Reproducible install, strictly from aip.lock — the analogue of `npm ci`.
 * Requires an aip.lock that is in sync with aip.json; installs the exact
 * locked digests with no registry resolution.
 */
export async function ci(): Promise<void> {
  if (!manifestExists()) {
    fail("No aip.json found. 'aip ci' needs a project manifest. Run 'aip init' first.");
    process.exitCode = 1;
    return;
  }
  if (!lockfileExists()) {
    fail("No aip.lock found. Run 'aip install' first to generate a lockfile.");
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();
  const lock = readLockfile();
  const status = lockSatisfiesManifest(manifest, lock);
  if (!status.inSync) {
    fail(
      `aip.lock is out of sync with aip.json (missing/outdated: ${status.missing.join(", ")}). ` +
        `Run 'aip install' to update the lockfile, then retry 'aip ci'.`
    );
    process.exitCode = 1;
    return;
  }

  const entries = Object.entries(manifest.models);
  if (entries.length === 0) {
    info("aip.json lists no models. Nothing to install.");
    return;
  }

  info(`Installing ${entries.length} locked model(s)...`);
  let failures = 0;
  for (const [name] of entries) {
    const success = await installFromLock(name, lock.models[name]);
    if (!success) failures++;
  }

  if (failures > 0) {
    fail(`${failures} model(s) failed to install.`);
    process.exitCode = 1;
  } else {
    ok(chalk.bold("Reproducible install complete (from aip.lock)."));
  }
}
