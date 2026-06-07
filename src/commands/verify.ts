import { existsSync } from "node:fs";
import ora from "ora";
import { readCache, paths } from "../lib/store.js";
import { sha256File } from "../lib/hash.js";
import { ok, fail, info, parseModelRef } from "../lib/ui.js";

/**
 * Re-hash installed model files and confirm they still match the recorded
 * digest. Catches silent disk corruption or tampering.
 */
export async function verify(ref?: string): Promise<void> {
  const cache = readCache();
  let targets = cache.models;

  if (ref) {
    const { name, version } = parseModelRef(ref);
    targets = cache.models.filter(
      (m) => m.name === name && (version ? m.version === version : true)
    );
    if (targets.length === 0) {
      fail(`${ref} is not installed. Run 'aip list' to see installed models.`);
      process.exitCode = 1;
      return;
    }
  }

  if (targets.length === 0) {
    info("No models installed. Nothing to verify.");
    return;
  }

  let failures = 0;
  for (const m of targets) {
    const file = paths.modelFile(m.name, m.version);
    const spinner = ora(`Verifying ${m.name}@${m.version}...`).start();

    if (!existsSync(file)) {
      spinner.stop();
      fail(`${m.name}@${m.version}: model file is missing. Reinstall with 'aip install ${m.name}:${m.version}'.`);
      failures++;
      continue;
    }

    const actual = await sha256File(file);
    spinner.stop();
    if (actual === m.sha256) {
      ok(`${m.name}@${m.version} OK (sha256:${m.sha256.slice(0, 12)}…)`);
    } else {
      fail(`${m.name}@${m.version} CORRUPT — expected ${m.sha256.slice(0, 12)}… got ${actual.slice(0, 12)}…. Reinstall it.`);
      failures++;
    }
  }

  if (failures > 0) process.exitCode = 1;
}
