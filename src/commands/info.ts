import ora from "ora";
import chalk from "chalk";
import { getCatalogModel } from "../lib/catalog.js";
import { resolveMeta, defaultTag, listTags } from "../lib/registry.js";
import { parseModelRef } from "../lib/ui.js";
import { isInstalled } from "../lib/store.js";
import { fail, formatBytes } from "../lib/ui.js";

export async function info(ref: string): Promise<void> {
  const { name, version } = parseModelRef(ref);
  const catalog = getCatalogModel(name);
  const tag = version ?? defaultTag(name);

  const spinner = ora(`Fetching ${name}:${tag} from registry...`).start();
  let meta;
  try {
    meta = await resolveMeta(name, tag);
  } catch (err) {
    spinner.stop();
    fail((err as Error).message);
    process.exitCode = 1;
    return;
  }
  spinner.stop();

  const label = (s: string): string => chalk.bold(s.padEnd(14));
  console.log(chalk.cyan.bold(`\n${name}`));
  if (catalog) console.log(chalk.dim(catalog.description));
  console.log();
  console.log(`${label("Publisher")} ${meta.publisher}`);
  console.log(`${label("License")} ${meta.license}`);
  console.log(`${label("Family")} ${meta.family ?? "n/a"}`);
  console.log(`${label("Format")} ${meta.format ?? "n/a"}`);
  console.log(`${label("Default tag")} ${tag}`);
  console.log(`${label("Parameters")} ${meta.parameterSize ?? "n/a"}`);
  console.log(`${label("Quantization")} ${meta.quantization}`);
  console.log(`${label("Size")} ${formatBytes(meta.sizeBytes)}`);
  console.log(`${label("Digest")} sha256:${meta.sha256.slice(0, 16)}…`);

  const tags = listTags(name);
  if (tags.length > 0) {
    console.log(chalk.bold("\nKnown tags:"));
    for (const t of tags) {
      const installed = isInstalled(name, t) ? chalk.green("  [installed]") : "";
      const isDefault = t === defaultTag(name) ? chalk.yellow(" (default)") : "";
      console.log(`  ${name}:${t}${isDefault}${installed}`);
    }
  }
  console.log(chalk.dim(`\nInstall with:  aip install ${name}:${tag}`));
  console.log();
}
