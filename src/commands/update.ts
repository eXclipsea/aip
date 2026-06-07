import ora from "ora";
import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { resolveMeta } from "../lib/registry.js";
import { installOne } from "./install.js";
import { ok, fail, info } from "../lib/ui.js";

/**
 * Update installed models to the registry's current `latest`. With a model
 * name, updates just that one; with no args, updates everything installed.
 */
export async function update(name?: string): Promise<void> {
  const cache = readCache();
  const installed = name
    ? cache.models.filter((m) => m.name === name)
    : cache.models;

  if (installed.length === 0) {
    fail(
      name
        ? `${name} is not installed. Run 'aip install ${name}' first.`
        : "No models installed. Nothing to update."
    );
    process.exitCode = 1;
    return;
  }

  // Dedup by model name — we only update each model's `latest` once.
  const names = [...new Set(installed.map((m) => m.name))];
  let updated = 0;
  let failures = 0;

  for (const modelName of names) {
    const spinner = ora(`Checking ${modelName} for updates...`).start();
    let latest;
    try {
      latest = await resolveMeta(modelName, "latest");
    } catch (err) {
      spinner.stop();
      fail(`${modelName}: ${(err as Error).message}`);
      failures++;
      continue;
    }
    spinner.stop();

    const have = cache.models.some(
      (m) => m.name === modelName && m.sha256 === latest.sha256
    );
    if (have) {
      info(`${modelName} is already up to date (latest).`);
      continue;
    }

    const success = await installOne(modelName, "latest", { force: true });
    if (success) updated++;
    else failures++;
  }

  if (failures > 0) process.exitCode = 1;
  if (updated > 0) ok(chalk.bold(`Updated ${updated} model(s).`));
}
