import { readCache, isInstalled, removeModel, removeCacheEntry } from "../lib/store.js";
import { removeLockEntry } from "../lib/lockfile.js";
import { removeDependency } from "../lib/manifest.js";
import { ok, fail, info, parseModelRef } from "../lib/ui.js";

/**
 * Remove a model from the store and from the project (aip.json + aip.lock).
 * With a version, removes just that version; without, removes every installed
 * version of the model. Mirrors `npm uninstall`.
 */
export async function uninstall(ref: string): Promise<void> {
  const { name, version } = parseModelRef(ref);
  const cache = readCache();
  const targets = cache.models.filter(
    (m) => m.name === name && (version ? m.version === version : true)
  );

  if (targets.length === 0 && !(version && isInstalled(name, version))) {
    fail(`${ref} is not installed. Run 'aip list' to see installed models.`);
    process.exitCode = 1;
    return;
  }

  for (const m of targets) {
    removeModel(m.name, m.version);
    removeCacheEntry(m.name, m.version);
    ok(`Removed ${m.name}@${m.version}`);
  }

  // Drop from project files only when no version remains for this model.
  const remaining = readCache().models.some((m) => m.name === name);
  if (!remaining) {
    const wasDep = removeDependency(name);
    removeLockEntry(name);
    if (wasDep) info(`Removed ${name} from aip.json and aip.lock.`);
  } else if (version) {
    info(`Other versions of ${name} are still installed; left aip.json untouched.`);
  }
}
