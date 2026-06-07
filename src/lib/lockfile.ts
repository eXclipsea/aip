import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Lockfile, LockEntry } from "../types.js";

const LOCK_FILE = "aip.lock";

export function lockfilePath(cwd: string = process.cwd()): string {
  return join(cwd, LOCK_FILE);
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
