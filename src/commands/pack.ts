import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { paths, isInstalled } from "../lib/store.js";
import { ok, fail, info, formatBytes, parseModelRef } from "../lib/ui.js";

/**
 * Bundle an installed model (model.gguf + meta.json) into a portable
 * .tar.gz in the current directory — the analogue of `npm pack`.
 */
export async function pack(ref: string): Promise<void> {
  const { name, version } = parseModelRef(ref);
  if (!version) {
    fail(`Specify a version: 'aip pack ${name}:<tag>'.`);
    process.exitCode = 1;
    return;
  }
  if (!isInstalled(name, version)) {
    fail(`${name}@${version} is not installed. Run 'aip install ${name}:${version}' first.`);
    process.exitCode = 1;
    return;
  }

  const dir = paths.modelDir(name, version);
  const outName = `${name.replace(/\//g, "-")}-${version}.tar.gz`;
  const outPath = join(process.cwd(), outName);

  info(`Packing ${name}@${version}...`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn("tar", ["-czf", outPath, "-C", dir, "."], { stdio: "inherit" });
    child.on("exit", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });

  if (code !== 0 || !existsSync(outPath)) {
    fail(`Packing failed (tar exited ${code}). Is 'tar' available on your PATH?`);
    process.exitCode = 1;
    return;
  }

  ok(`Wrote ${outName} (${formatBytes(statSync(outPath).size)})`);
}
