import { readCache } from "../lib/store.js";
import { info, table, formatBytes } from "../lib/ui.js";

export async function list(): Promise<void> {
  const cache = readCache();
  if (cache.models.length === 0) {
    info("No models installed. Run 'aip install <model>:<tag>' to get one.");
    return;
  }

  const rows = cache.models
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
    .map((m) => [
      m.name,
      m.version,
      m.parameterSize ?? "—",
      formatBytes(m.sizeBytes),
      m.quantization,
    ]);

  console.log(table(["MODEL", "VERSION", "PARAMS", "SIZE", "QUANTIZATION"], rows));
}
