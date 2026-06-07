import { readManifest, manifestExists } from "../lib/manifest.js";
import { readCache, removeModel, removeCacheEntry } from "../lib/store.js";
import { ok, fail, info, warn, table, formatBytes } from "../lib/ui.js";

/**
 * Remove installed models that the project manifest doesn't reference
 * (like `npm prune`). Dry-run by default; pass --yes to actually delete.
 */
export async function prune(opts: { yes?: boolean } = {}): Promise<void> {
  if (!manifestExists()) {
    fail("No aip.json found. 'aip prune' needs a manifest to know what to keep.");
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();
  const cache = readCache();

  // Keep models whose name:version is pinned in the manifest.
  const removable = cache.models.filter((m) => manifest.models[m.name] !== m.version);

  if (removable.length === 0) {
    ok("Nothing to prune — every installed model is in aip.json.");
    return;
  }

  const freed = removable.reduce((sum, m) => sum + m.sizeBytes, 0);
  console.log(
    table(
      ["MODEL", "VERSION", "SIZE"],
      removable.map((m) => [m.name, m.version, formatBytes(m.sizeBytes)])
    )
  );

  if (!opts.yes) {
    warn(`Would remove ${removable.length} model(s), freeing ~${formatBytes(freed)}.`);
    info("Re-run with --yes to actually delete them: aip prune --yes");
    return;
  }

  for (const m of removable) {
    removeModel(m.name, m.version);
    removeCacheEntry(m.name, m.version);
  }
  ok(`Pruned ${removable.length} model(s), freed ${formatBytes(freed)}.`);
}
