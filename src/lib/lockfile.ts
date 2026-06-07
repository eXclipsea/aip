import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Lockfile, LockEntry, Manifest, ModelMeta } from "../types.js";

const LOCK_FILE = "aip.lock";

export function lockfilePath(cwd: string = process.cwd()): string {
  return join(cwd, LOCK_FILE);
}

export function lockfileExists(cwd: string = process.cwd()): boolean {
  return existsSync(lockfilePath(cwd));
}

export function readLockfile(cwd: string = process.cwd()): Lockfile {
  const path = lockfilePath(cwd);
  if (!existsSync(path)) return { lockfileVersion: 1, models: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Lockfile;
  } catch {
    return { lockfileVersion: 1, models: {} };
  }
}

export function writeLockfile(lock: Lockfile, cwd: string = process.cwd()): void {
  writeFileSync(lockfilePath(cwd), JSON.stringify(lock, null, 2) + "\n");
}

/** Build a lock entry from resolved registry metadata. */
export function lockEntryFromMeta(meta: ModelMeta): LockEntry {
  return {
    version: meta.version,
    sha256: meta.sha256,
    sizeBytes: meta.sizeBytes,
    downloadUrl: meta.downloadUrl,
  };
}

export function setLockEntry(name: string, entry: LockEntry, cwd: string = process.cwd()): void {
  const lock = readLockfile(cwd);
  lock.models[name] = entry;
  writeLockfile(lock, cwd);
}

export function removeLockEntry(name: string, cwd: string = process.cwd()): void {
  const lock = readLockfile(cwd);
  delete lock.models[name];
  writeLockfile(lock, cwd);
}

/**
 * A ModelMeta good enough to download + verify directly from a lock entry,
 * with no registry round-trip — this is what makes `aip ci` reproducible.
 */
export function metaFromLock(name: string, entry: LockEntry): ModelMeta {
  return {
    name,
    version: entry.version,
    sha256: entry.sha256,
    sizeBytes: entry.sizeBytes,
    downloadUrl: entry.downloadUrl,
    license: "see model card",
    quantization: "unknown",
    publishedAt: "",
    publisher: name.includes("/") ? name.split("/")[0] : "library",
  };
}

export interface SyncStatus {
  inSync: boolean;
  /** Deps in the manifest with no matching lock entry (missing or wrong tag). */
  missing: string[];
}

/** Is every manifest dependency represented in the lock at the same tag? */
export function lockSatisfiesManifest(manifest: Manifest, lock: Lockfile): SyncStatus {
  const missing: string[] = [];
  for (const [name, version] of Object.entries(manifest.models)) {
    const entry = lock.models[name];
    if (!entry || entry.version !== version) missing.push(name);
  }
  return { inSync: missing.length === 0, missing };
}
