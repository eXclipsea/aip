import { readManifest, manifestExists, writeManifest } from "../lib/manifest.js";
import { nextVersion } from "../lib/semver.js";
import { ok, fail, info } from "../lib/ui.js";

/**
 * Show or bump the project version in aip.json (like `npm version`).
 * `arg` may be major|minor|patch or an explicit x.y.z.
 */
export async function version(arg?: string): Promise<void> {
  if (!manifestExists()) {
    fail("No aip.json found. Run 'aip init' first.");
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();

  if (!arg) {
    info(`${manifest.name} v${manifest.version ?? "0.0.0"}`);
    return;
  }

  let bumped: string;
  try {
    bumped = nextVersion(manifest.version, arg);
  } catch (err) {
    fail((err as Error).message);
    process.exitCode = 1;
    return;
  }

  const previous = manifest.version ?? "0.0.0";
  manifest.version = bumped;
  writeManifest(manifest);
  ok(`${manifest.name}: ${previous} → ${bumped}`);
}
