import { modelsDiskUsage, cleanModels } from "../lib/store.js";
import { ok, info, formatBytes } from "../lib/ui.js";

export async function cacheClean(): Promise<void> {
  const freed = cleanModels();
  if (freed === 0) {
    info("Cache is already empty. Nothing to clean.");
    return;
  }
  ok(`Cleaned cache — freed ${formatBytes(freed)}.`);
}

export async function cacheSize(): Promise<void> {
  const used = modelsDiskUsage();
  info(`Cache size: ${formatBytes(used)} in ~/.aip/models`);
}
