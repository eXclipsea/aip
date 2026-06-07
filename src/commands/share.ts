import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { installOne } from "./install.js";
import { ok, fail, info, parseModelRef } from "../lib/ui.js";

const SCHEME = "aip://";

/** Build a shareable URI from currently installed models. */
function encode(): string | null {
  const cache = readCache();
  if (cache.models.length === 0) return null;
  const parts = cache.models
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => `${m.name}@${m.version}`);
  return SCHEME + parts.join("+");
}

/** Parse an aip:// URI into model refs. */
function decode(uri: string): { name: string; version?: string }[] {
  const body = uri.startsWith(SCHEME) ? uri.slice(SCHEME.length) : uri;
  return body
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseModelRef);
}

export async function share(opts: { load?: string }): Promise<void> {
  if (opts.load) {
    const refs = decode(opts.load);
    if (refs.length === 0) {
      fail(`Could not parse any models from "${opts.load}".`);
      process.exitCode = 1;
      return;
    }
    info(`Loading ${refs.length} model(s) from shared URI...`);
    let failures = 0;
    for (const { name, version } of refs) {
      const success = await installOne(name, version);
      if (!success) failures++;
    }
    if (failures > 0) process.exitCode = 1;
    else ok(chalk.bold("Loaded all shared models."));
    return;
  }

  const uri = encode();
  if (!uri) {
    info("No models installed yet — nothing to share. Install some first.");
    return;
  }
  console.log(chalk.bold("\nShare this URI:\n"));
  console.log("  " + chalk.cyan(uri) + "\n");
  console.log(chalk.dim(`  Load with:  aip share --load "${uri}"\n`));
}
