import { readCache } from "../lib/store.js";
import { info, table, formatBytes, printJson } from "../lib/ui.js";

export async function list(opts: { json?: boolean } = {}): Promise<void> {
  const cache = readCache();

  if (opts.json) {
    return printJson(
      cache.models.map((m) => ({
        name: m.name,
        version: m.version,
        parameterSize: m.parameterSize ?? null,
        sizeBytes: m.sizeBytes,
        quantization: m.quantization,
        sha256: m.sha256,
      }))
    );
  }

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
