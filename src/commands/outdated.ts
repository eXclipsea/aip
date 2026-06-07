import ora from "ora";
import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { resolveMeta } from "../lib/registry.js";
import { ok, info, table } from "../lib/ui.js";

/**
 * Compare each installed model against the registry's current `latest` tag by
 * content digest. If the installed model's sha256 differs from latest, it's
 * out of date (or pinned to an older tag).
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
      const latest = await resolveMeta(m.name, "latest");
      if (latest.sha256 !== m.sha256) {
        rows.push([
          m.name,
          m.version,
          chalk.green("latest"),
          `${m.sha256.slice(0, 10)}… → ${latest.sha256.slice(0, 10)}…`,
        ]);
      }
    } catch {
      // Model not resolvable (no latest tag / offline) — skip silently.
    }
  }

  spinner.stop();

  if (rows.length === 0) {
    ok("All installed models match the registry's latest.");
    return;
  }

  console.log(table(["MODEL", "INSTALLED", "LATEST", "DIGEST CHANGE"], rows));
  console.log(chalk.dim("\nUpdate with:  aip update <model>"));
}
