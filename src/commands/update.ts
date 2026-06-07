import ora from "ora";
import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { resolveMeta } from "../lib/registry.js";
import { installOne } from "./install.js";
import { ok, fail, info } from "../lib/ui.js";

/**
 * Refresh installed model(s) to the registry's current digest for the tag they
 * track. Immutable tags stay put; moving tags (e.g. "latest") get the new build.
 * Updates the lockfile but never rewrites the manifest's pinned tags.
 */
export async function update(name?: string): Promise<void> {
  const cache = readCache();
  const targets = name
    ? cache.models.filter((m) => m.name === name)
    : cache.models;

  if (targets.length === 0) {
    fail(
      name
        ? `${name} is not installed. Run 'aip install ${name}' first.`
        : "No models installed. Nothing to update."
    );
    process.exitCode = 1;
    return;
  }

  let updated = 0;
  let failures = 0;

  for (const m of targets) {
    const spinner = ora(`Checking ${m.name}@${m.version}...`).start();
    let current;
    try {
      current = await resolveMeta(m.name, m.version);
    } catch (err) {
      spinner.stop();
      fail(`${m.name}@${m.version}: ${(err as Error).message}`);
      failures++;
      continue;
    }
    spinner.stop();

    if (current.sha256 === m.sha256) {
      info(`${m.name}@${m.version} is already up to date.`);
      continue;
    }

    const success = await installOne(m.name, m.version, {
      force: true,
      save: false,
      updateLock: true,
    });
    if (success) updated++;
    else failures++;
  }

  if (failures > 0) process.exitCode = 1;
  if (updated > 0) ok(chalk.bold(`Updated ${updated} model(s).`));
  else if (failures === 0) ok("Everything is up to date.");
}
