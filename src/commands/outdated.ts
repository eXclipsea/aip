import ora from "ora";
import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { resolveMeta } from "../lib/registry.js";
import { ok, info, table } from "../lib/ui.js";

/**
 * Report installed models whose tag has moved under them — i.e. the registry's
 * current digest for the SAME tag differs from what's on disk. Immutable tags
 * (like "7b") are no-ops; moving tags (like "latest") surface here when rebuilt.
 */
export async function outdated(): Promise<void> {
  const cache = readCache();
  if (cache.models.length === 0) {
    info("No models installed. Nothing to check.");
    return;
  }

  const spinner = ora("Checking registry for updates...").start();
  const rows: string[][] = [];

  for (const m of cache.models) {
    try {
      const current = await resolveMeta(m.name, m.version);
      if (current.sha256 !== m.sha256) {
        rows.push([
          m.name,
          m.version,
          `${m.sha256.slice(0, 10)}… → ${chalk.green(current.sha256.slice(0, 10) + "…")}`,
        ]);
      }
    } catch {
      // Unresolvable (offline / tag removed) — skip silently.
    }
  }

  spinner.stop();

  if (rows.length === 0) {
    ok("All installed models are up to date with the registry.");
    return;
  }

  console.log(table(["MODEL", "TAG", "DIGEST CHANGE"], rows));
  console.log(chalk.dim("\nUpdate with:  aip update [model]"));
}
