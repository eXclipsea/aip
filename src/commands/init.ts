import { basename } from "node:path";
import { manifestExists, writeManifest } from "../lib/manifest.js";
import { ok, info } from "../lib/ui.js";

/** Create an empty aip.json in the current directory (npm-init style). */
export async function init(): Promise<void> {
  if (manifestExists()) {
    info("aip.json already exists in this directory.");
    return;
  }
  const name = basename(process.cwd());
  writeManifest({ name, models: {} });
  ok(`Created aip.json for "${name}". Add models with 'aip install <model>:<tag>'.`);
}
