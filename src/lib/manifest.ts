import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { Manifest } from "../types.js";

const MANIFEST_FILE = "aip.json";

export function manifestPath(cwd: string = process.cwd()): string {
  return join(cwd, MANIFEST_FILE);
}

export function manifestExists(cwd: string = process.cwd()): boolean {
  return existsSync(manifestPath(cwd));
}

export function readManifest(cwd: string = process.cwd()): Manifest {
  const path = manifestPath(cwd);
  if (!existsSync(path)) {
    throw new Error(
      `No aip.json found in ${cwd}. Run 'aip install <model>:<tag>' to create one, ` +
        `or 'aip init' to start an empty project.`
    );
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Manifest>;
  return { name: parsed.name ?? basename(cwd), models: parsed.models ?? {} };
}

export function writeManifest(manifest: Manifest, cwd: string = process.cwd()): void {
  writeFileSync(manifestPath(cwd), JSON.stringify(manifest, null, 2) + "\n");
}

/** Read the manifest if present, else synthesize a default one (npm-init style). */
export function readOrInitManifest(cwd: string = process.cwd()): Manifest {
  if (manifestExists(cwd)) return readManifest(cwd);
  return { name: basename(cwd), models: {} };
}

/** Record a model dependency (name → tag) and persist. */
export function addDependency(name: string, version: string, cwd: string = process.cwd()): void {
  const manifest = readOrInitManifest(cwd);
  manifest.models[name] = version;
  writeManifest(manifest, cwd);
}

/** Remove a model dependency and persist. Returns true if it existed. */
export function removeDependency(name: string, cwd: string = process.cwd()): boolean {
  if (!manifestExists(cwd)) return false;
  const manifest = readManifest(cwd);
  if (!(name in manifest.models)) return false;
  delete manifest.models[name];
  writeManifest(manifest, cwd);
  return true;
}
