import chalk from "chalk";

export const ok = (msg: string): void => console.log(`${chalk.green("✓")} ${msg}`);
export const fail = (msg: string): void => console.error(`${chalk.red("✗")} ${msg}`);
export const info = (msg: string): void => console.log(`${chalk.blue("→")} ${msg}`);
export const warn = (msg: string): void => console.log(`${chalk.yellow("!")} ${msg}`);

/** Print a value as pretty JSON (for --json output). */
export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

/** Turn a model name into a shell-safe env var suffix, e.g. "qwen2.5" → "QWEN2_5". */
export function envName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase().replace(/^_+|_+$/g, "");
}

/** Human-readable size. Uses GB/MB to match the spec's display style. */
export function formatBytes(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Render a simple left-aligned column table. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const pad = (cells: string[]): string =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ").trimEnd();
  const lines = [chalk.bold(pad(headers)), ...rows.map(pad)];
  return lines.join("\n");
}

/**
 * Split a model reference into name + version (tag).
 * Accepts both Ollama-style "model:tag" and npm-style "model@version",
 * and an optional "namespace/model" prefix (e.g. "library/qwen2.5:7b").
 */
export function parseModelRef(ref: string): { name: string; version?: string } {
  // Only look for the tag separator after the last "/" so namespaces are safe.
  const searchFrom = ref.lastIndexOf("/") + 1;
  const colon = ref.indexOf(":", searchFrom);
  const at = ref.indexOf("@", searchFrom);
  let sep: number;
  if (colon !== -1 && at !== -1) sep = Math.min(colon, at);
  else sep = Math.max(colon, at);
  if (sep === -1) return { name: ref };
  return { name: ref.slice(0, sep), version: ref.slice(sep + 1) };
}
