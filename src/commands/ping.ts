import chalk from "chalk";
import { getConfig } from "../lib/config.js";
import { ok, fail, info, printJson } from "../lib/ui.js";

/** Check the registry is reachable and report round-trip latency. */
export async function ping(opts: { json?: boolean } = {}): Promise<void> {
  const { registry } = getConfig();
  const url = `${registry}/v2/`;
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const ms = Date.now() - start;
    clearTimeout(timer);
    // Any HTTP response below 500 means the registry is up and serving
    // (Ollama returns 404 at the bare /v2/ root, which is still "reachable").
    const reachable = res.status < 500;
    if (opts.json) {
      return printJson({ registry, url, status: res.status, reachable, latencyMs: ms });
    }
    if (reachable) {
      ok(`${registry} is reachable (${chalk.cyan(ms + "ms")}, HTTP ${res.status}).`);
    } else {
      fail(`${registry} responded HTTP ${res.status}.`);
      process.exitCode = 1;
    }
  } catch (err) {
    clearTimeout(timer);
    if (opts.json) {
      return printJson({ registry, url, reachable: false, error: (err as Error).message });
    }
    fail(`Could not reach ${registry}: ${(err as Error).message}`);
    info("Check your connection, or set another registry with 'aip registry set <url>'.");
    process.exitCode = 1;
  }
}
