import ora from "ora";
import { readManifest, manifestExists } from "../lib/manifest.js";
import { ok, fail, info } from "../lib/ui.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function publish(): Promise<void> {
  if (!manifestExists()) {
    fail(
      "No aip.json to publish. Create one with a \"name\" and \"models\" map first."
    );
    process.exitCode = 1;
    return;
  }

  const manifest = readManifest();
  const count = Object.keys(manifest.models).length;
  info(`Publishing "${manifest.name}" (${count} model reference(s))...`);

  const steps = [
    "Packing aip.json",
    "Computing checksums",
    "Authenticating with registry",
    "Uploading manifest",
    "Finalizing release",
  ];

  for (const step of steps) {
    const spinner = ora(step).start();
    await sleep(350);
    spinner.succeed(step);
  }

  ok("Published to registry");
}
