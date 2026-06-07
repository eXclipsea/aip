import { isInstalled, removeModel, removeCacheEntry } from "../lib/store.js";
import { removeLockEntry } from "../lib/lockfile.js";
import { ok, fail, parseModelRef } from "../lib/ui.js";

export async function remove(ref: string): Promise<void> {
  const { name, version } = parseModelRef(ref);
  if (!version) {
    fail(`Specify a version: 'aip remove ${name}@<version>'.`);
    process.exitCode = 1;
    return;
  }

  if (!isInstalled(name, version)) {
    fail(`${name}@${version} is not installed. Run 'aip list' to see what you have.`);
    process.exitCode = 1;
    return;
  }

  removeModel(name, version);
  removeCacheEntry(name, version);
  removeLockEntry(name);
  ok(`Removed ${name}@${version}`);
}
