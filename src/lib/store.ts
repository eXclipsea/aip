import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CacheIndex, CacheEntry } from "../types.js";

/**
 * Central place for every path under ~/.aip — no hardcoding elsewhere.
 * Override the root with AIP_HOME for testing.
 */
const AIP_HOME = process.env.AIP_HOME ?? join(homedir(), ".aip");

export const paths = {
  home: AIP_HOME,
  models: join(AIP_HOME, "models"),
  cache: join(AIP_HOME, "cache.json"),
  modelDir(name: string, version: string): string {
    return join(AIP_HOME, "models", name, version);
  },
  modelFile(name: string, version: string): string {
    return join(this.modelDir(name, version), "model.gguf");
  },
  metaFile(name: string, version: string): string {
    return join(this.modelDir(name, version), "meta.json");
  },
};

/** Ensure the base ~/.aip directory tree exists. */
export function ensureStore(): void {
  mkdirSync(paths.models, { recursive: true });
}

/** Create the per-model version directory and return its path. */
export function ensureModelDir(name: string, version: string): string {
  const dir = paths.modelDir(name, version);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function isInstalled(name: string, version: string): boolean {
  return existsSync(paths.modelFile(name, version));
}

export function removeModel(name: string, version: string): boolean {
  const dir = paths.modelDir(name, version);
  if (!existsSync(dir)) return false;
  rmSync(dir, { recursive: true, force: true });
  // Clean up the now-empty parent (the model name dir) if nothing else is there.
  const parent = join(paths.models, name);
  if (existsSync(parent) && readdirSync(parent).length === 0) {
    rmSync(parent, { recursive: true, force: true });
  }
  return true;
}

// ---- cache.json index ------------------------------------------------------

export function readCache(): CacheIndex {
  if (!existsSync(paths.cache)) return { models: [] };
  try {
    return JSON.parse(readFileSync(paths.cache, "utf8")) as CacheIndex;
  } catch {
    return { models: [] };
  }
}

export function writeCache(cache: CacheIndex): void {
  ensureStore();
  writeFileSync(paths.cache, JSON.stringify(cache, null, 2));
}

export function upsertCacheEntry(entry: CacheEntry): void {
  const cache = readCache();
  const i = cache.models.findIndex(
    (m) => m.name === entry.name && m.version === entry.version
  );
  if (i >= 0) cache.models[i] = entry;
  else cache.models.push(entry);
  writeCache(cache);
}

export function removeCacheEntry(name: string, version: string): void {
  const cache = readCache();
  cache.models = cache.models.filter(
    (m) => !(m.name === name && m.version === version)
  );
  writeCache(cache);
}

// ---- disk usage ------------------------------------------------------------

/** Total size in bytes of everything under ~/.aip/models. */
export function modelsDiskUsage(): number {
  if (!existsSync(paths.models)) return 0;
  let total = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(paths.models);
  return total;
}

/** Delete everything under ~/.aip/models and reset the cache index. */
export function cleanModels(): number {
  const freed = modelsDiskUsage();
  if (existsSync(paths.models)) {
    rmSync(paths.models, { recursive: true, force: true });
  }
  mkdirSync(paths.models, { recursive: true });
  writeCache({ models: [] });
  return freed;
}
