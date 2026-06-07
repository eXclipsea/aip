import ora from "ora";
import chalk from "chalk";
import { readCache } from "../lib/store.js";
import { resolveMeta } from "../lib/registry.js";
import { ok, info, table, printJson } from "../lib/ui.js";

/**
 * Report installed models whose tag has moved under them — i.e. the registry's
 * current digest for the SAME tag differs from what's on disk. Immutable tags
 * (like "7b") are no-ops; moving tags (like "latest") surface here when rebuilt.
 */
export async function outdated(opts: { json?: boolean } = {}): Promise<void> {
  const cache = readCache();
  if (cache.models.length === 0) {
    if (opts.json) return printJson([]);
    info("No models installed. Nothing to check.");
    return;
  }

  const spinner = opts.json ? null : ora("Checking registry for updates...").start();
  const stale: Array<{ name: string; version: string; current: string; latest: string }> = [];

  for (const m of cache.models) {
    try {
      const current = await resolveMeta(m.name, m.version);
      if (current.sha256 !== m.sha256) {
        stale.push({ name: m.name, version: m.version, current: m.sha256, latest: current.sha256 });
      }
    } catch {
      // Unresolvable (offline / tag removed) — skip silently.
    }
  }

  spinner?.stop();

  if (opts.json) return printJson(stale);

  if (stale.length === 0) {
    ok("All installed models are up to date with the registry.");
    return;
  }

  console.log(
    table(
      ["MODEL", "TAG", "DIGEST CHANGE"],
      stale.map((s) => [
        s.name,
        s.version,
        `${s.current.slice(0, 10)}… → ${chalk.green(s.latest.slice(0, 10) + "…")}`,
      ])
    )
  );
  console.log(chalk.dim("\nUpdate with:  aip update [model]"));
}
