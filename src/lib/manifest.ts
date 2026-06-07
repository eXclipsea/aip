import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
      `No aip.json found in ${cwd}. Create one with a "models" map, e.g. ` +
        `{ "name": "my-project", "models": { "llama3": "3.3" } }`
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as Manifest;
}

export function writeManifest(manifest: Manifest, cwd: string = process.cwd()): void {
  writeFileSync(manifestPath(cwd), JSON.stringify(manifest, null, 2) + "\n");
}
