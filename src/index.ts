#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";

import { install } from "./commands/install.js";
import { remove } from "./commands/remove.js";
import { list } from "./commands/list.js";
import { info } from "./commands/info.js";
import { outdated } from "./commands/outdated.js";
import { cacheClean, cacheSize } from "./commands/cache.js";
import { publish } from "./commands/publish.js";
import { share } from "./commands/share.js";
import { search } from "./commands/search.js";
import { verify } from "./commands/verify.js";
import { which } from "./commands/which.js";
import { update } from "./commands/update.js";
import { registryShow, registrySet } from "./commands/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
) as { version: string; description: string };

const program = new Command();

program
  .name("aip")
  .description(pkg.description)
  .version(pkg.version, "-v, --version", "output the current version");

program
  .command("install")
  .alias("pull")
  .argument("[model]", "model:tag to install; omit to install all from aip.json")
  .description("Install a model from the registry (or all models in aip.json)")
  .action((model?: string) => install(model));

program
  .command("remove")
  .alias("rm")
  .argument("<model>", "model:tag to remove")
  .description("Remove an installed model")
  .action((model: string) => remove(model));

program
  .command("list")
  .alias("ls")
  .description("List installed models")
  .action(() => list());

program
  .command("search")
  .argument("[query]", "term to match against model name, publisher, or description")
  .description("Search the model catalog")
  .action((query?: string) => search(query));

program
  .command("info")
  .argument("<model>", "model name (optionally model:tag)")
  .description("Show live metadata and known tags for a model")
  .action((model: string) => info(model));

program
  .command("outdated")
  .description("Show installed models whose digest differs from registry latest")
  .action(() => outdated());

program
  .command("update")
  .alias("upgrade")
  .argument("[model]", "model to update; omit to update all installed models")
  .description("Update installed model(s) to the registry's latest")
  .action((model?: string) => update(model));

program
  .command("verify")
  .argument("[model]", "model:tag to verify; omit to verify all")
  .description("Re-hash installed model files and confirm integrity")
  .action((model?: string) => verify(model));

program
  .command("which")
  .argument("<model>", "model:tag")
  .description("Print the absolute path to an installed model file")
  .action((model: string) => which(model));

const cache = program.command("cache").description("Manage the local model cache");
cache
  .command("clean")
  .description("Delete all downloaded models and report freed space")
  .action(() => cacheClean());
cache
  .command("size")
  .description("Show total disk usage of the model cache")
  .action(() => cacheSize());

const registry = program.command("registry").description("View or set the model registry");
registry
  .command("show", { isDefault: true })
  .description("Show the configured registry")
  .action(() => registryShow());
registry
  .command("set")
  .argument("<url>", "registry base URL")
  .description("Set the registry URL")
  .action((url: string) => registrySet(url));

program
  .command("publish")
  .description("Publish the current aip.json to the registry (simulated)")
  .action(() => publish());

program
  .command("share")
  .option("--load <uri>", "install every model encoded in an aip:// URI")
  .description("Print a shareable aip:// URI of installed models, or load one")
  .action((opts: { load?: string }) => share(opts));

program.configureOutput({
  outputError: (str, write) => write(chalk.red(str)),
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red(`✗ ${(err as Error).message}`));
  process.exit(1);
});
