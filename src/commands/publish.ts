import ora from "ora";
import chalk from "chalk";
import { publishModel } from "../lib/publisher.js";
import { readCache } from "../lib/store.js";
import { readManifest, manifestExists } from "../lib/manifest.js";
import { isDefaultRegistry, getConfig } from "../lib/config.js";
import { ok, fail, info, parseModelRef } from "../lib/ui.js";

/**
 * Publish installed model(s) to the configured registry (a real OCI push).
 * With a model:tag, publishes that one; with no arg, publishes every installed
 * model listed in aip.json.
 */
export async function publish(ref?: string): Promise<void> {
  if (isDefaultRegistry()) {
    fail(
      "Refusing to publish to the public Ollama registry (it's read-only for you). " +
        "Run your own with 'aip registry serve', point at it via 'aip registry set <url>', then publish."
    );
    process.exitCode = 1;
    return;
  }

  const { registry } = getConfig();

  // Figure out which (name, version) pairs to publish.
  let targets: Array<{ name: string; version: string }> = [];
  if (ref) {
    const { name, version } = parseModelRef(ref);
    if (!version) {
      fail(`Specify a version: 'aip publish ${name}:<tag>'.`);
      process.exitCode = 1;
      return;
    }
    targets = [{ name, version }];
  } else {
    if (!manifestExists()) {
      fail("No aip.json and no model given. Run 'aip publish <model:tag>' or add models to aip.json.");
      process.exitCode = 1;
      return;
    }
    const manifest = readManifest();
    const installed = readCache().models;
    targets = Object.entries(manifest.models)
      .filter(([name, version]) => installed.some((m) => m.name === name && m.version === version))
      .map(([name, version]) => ({ name, version }));
    if (targets.length === 0) {
      fail("None of the models in aip.json are installed. Install them before publishing.");
      process.exitCode = 1;
      return;
    }
  }

  info(`Publishing ${targets.length} model(s) to ${chalk.cyan(registry)}...`);
  let failures = 0;
  for (const { name, version } of targets) {
    const spinner = ora(`Pushing ${name}:${version}...`).start();
    try {
      const result = await publishModel(name, version);
      spinner.stop();
      ok(`Published ${result.repo}:${result.tag} → ${result.registry}`);
    } catch (err) {
      spinner.stop();
      fail(`${name}:${version} — ${(err as Error).message}`);
      failures++;
    }
  }

  if (failures > 0) process.exitCode = 1;
  else ok(chalk.bold("Publish complete."));
}
