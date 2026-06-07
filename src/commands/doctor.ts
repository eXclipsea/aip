import { existsSync, accessSync, constants, readdirSync } from "node:fs";
import chalk from "chalk";
import { paths, readCache, ensureStore } from "../lib/store.js";
import { getConfig, configPath } from "../lib/config.js";
import { manifestExists, readManifest } from "../lib/manifest.js";
import { readLockfile, lockSatisfiesManifest } from "../lib/lockfile.js";
import { printJson } from "../lib/ui.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function registryReachable(): Promise<{ ok: boolean; detail: string }> {
  const { registry } = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${registry}/v2/`, { signal: controller.signal });
    clearTimeout(timer);
    const reachable = res.status < 500;
    return { ok: reachable, detail: `${registry} (HTTP ${res.status})` };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, detail: `${registry} unreachable: ${(err as Error).message}` };
  }
}

/** Diagnose the aip install (like `npm doctor`). */
export async function doctor(opts: { json?: boolean } = {}): Promise<void> {
  const checks: Check[] = [];

  // Node version
  const major = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node.js >= 18",
    ok: major >= 18,
    detail: `v${process.versions.node}`,
  });

  // Store writable
  let storeOk = true;
  let storeDetail = paths.home;
  try {
    ensureStore();
    accessSync(paths.models, constants.W_OK);
  } catch (err) {
    storeOk = false;
    storeDetail = `${paths.home}: ${(err as Error).message}`;
  }
  checks.push({ name: "Store writable", ok: storeOk, detail: storeDetail });

  // Registry reachable
  const reg = await registryReachable();
  checks.push({ name: "Registry reachable", ok: reg.ok, detail: reg.detail });

  // Config
  checks.push({
    name: "Config readable",
    ok: true,
    detail: existsSync(configPath()) ? configPath() : `${configPath()} (defaults)`,
  });

  // Cache integrity: every cache entry has a file on disk
  const cache = readCache();
  const missing = cache.models.filter((m) => !existsSync(paths.modelFile(m.name, m.version)));
  checks.push({
    name: "Cache files present",
    ok: missing.length === 0,
    detail:
      missing.length === 0
        ? `${cache.models.length} model(s) tracked`
        : `missing files: ${missing.map((m) => `${m.name}@${m.version}`).join(", ")}`,
  });

  // Orphans: model dirs on disk not tracked in the cache index
  let orphans: string[] = [];
  if (existsSync(paths.models)) {
    const tracked = new Set(cache.models.map((m) => `${m.name}/${m.version}`));
    for (const name of readdirSync(paths.models)) {
      const base = `${paths.models}/${name}`;
      try {
        for (const version of readdirSync(base)) {
          if (!tracked.has(`${name}/${version}`)) orphans.push(`${name}@${version}`);
        }
      } catch {
        /* not a dir */
      }
    }
  }
  checks.push({
    name: "No orphaned models",
    ok: orphans.length === 0,
    detail: orphans.length === 0 ? "clean" : `untracked: ${orphans.join(", ")}`,
  });

  // Manifest/lock sync (only if a project manifest exists)
  if (manifestExists()) {
    const status = lockSatisfiesManifest(readManifest(), readLockfile());
    checks.push({
      name: "Lockfile in sync",
      ok: status.inSync,
      detail: status.inSync ? "aip.lock matches aip.json" : `out of sync: ${status.missing.join(", ")}`,
    });
  }

  if (opts.json) {
    const allOk = checks.every((c) => c.ok);
    printJson({ ok: allOk, checks });
    if (!allOk) process.exitCode = 1;
    return;
  }

  console.log(chalk.bold("aip doctor\n"));
  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? chalk.green("✓") : chalk.red("✗");
    if (!c.ok) allOk = false;
    console.log(`  ${mark} ${c.name.padEnd(22)} ${chalk.dim(c.detail)}`);
  }
  console.log();
  if (allOk) console.log(chalk.green("Everything looks healthy."));
  else {
    console.log(chalk.yellow("Some checks failed — see details above."));
    process.exitCode = 1;
  }
}
