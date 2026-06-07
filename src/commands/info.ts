import ora from "ora";
import chalk from "chalk";
import { resolveMeta, listTags } from "../lib/registry.js";
import { parseModelRef } from "../lib/ui.js";
import { isInstalled } from "../lib/store.js";
import { fail, formatBytes, printJson } from "../lib/ui.js";

const MAX_TAGS_SHOWN = 40;

export async function info(ref: string, opts: { json?: boolean } = {}): Promise<void> {
  const { name, version } = parseModelRef(ref);
  const tag = version ?? "latest";

  const spinner = opts.json ? null : ora(`Fetching ${name}:${tag} from registry...`).start();
  let meta;
  let tags: string[] = [];
  try {
    [meta, tags] = await Promise.all([
      resolveMeta(name, tag),
      listTags(name).catch(() => [] as string[]),
    ]);
  } catch (err) {
    spinner?.stop();
    fail((err as Error).message);
    process.exitCode = 1;
    return;
  }
  spinner?.stop();

  if (opts.json) return printJson({ ...meta, tags });

  const label = (s: string): string => chalk.bold(s.padEnd(14));
  console.log(chalk.cyan.bold(`\n${name}`));
  console.log();
  console.log(`${label("Resolved tag")} ${meta.version}`);
  console.log(`${label("Publisher")} ${meta.publisher}`);
  console.log(`${label("License")} ${meta.license}`);
  console.log(`${label("Family")} ${meta.family ?? "n/a"}`);
  console.log(`${label("Format")} ${meta.format ?? "n/a"}`);
  console.log(`${label("Parameters")} ${meta.parameterSize ?? "n/a"}`);
  console.log(`${label("Quantization")} ${meta.quantization}`);
  console.log(`${label("Size")} ${formatBytes(meta.sizeBytes)}`);
  console.log(`${label("Digest")} sha256:${meta.sha256.slice(0, 16)}…`);

  if (tags.length > 0) {
    const shown = tags.slice(0, MAX_TAGS_SHOWN);
    console.log(chalk.bold(`\nTags (${tags.length} available):`));
    for (const t of shown) {
      const installed = isInstalled(name, t) ? chalk.green("  [installed]") : "";
      console.log(`  ${name}:${t}${installed}`);
    }
    if (tags.length > shown.length) {
      console.log(chalk.dim(`  …and ${tags.length - shown.length} more`));
    }
  }
  console.log(chalk.dim(`\nInstall with:  aip install ${name}:${tag}`));
  console.log();
}
