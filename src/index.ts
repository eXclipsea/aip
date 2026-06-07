#!/usr/bin/env -S npx tsx
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";

import { install, type InstallFlags } from "./commands/install.js";
import { ci } from "./commands/ci.js";
import { init } from "./commands/init.js";
import { uninstall } from "./commands/uninstall.js";
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
import { registryShow, registrySet, registrySetWeb } from "./commands/registry.js";
import { configGet, configSet, configDelete, configList } from "./commands/config.js";
import { run } from "./commands/run.js";
import { prune } from "./commands/prune.js";
import { doctor } from "./commands/doctor.js";
import { audit } from "./commands/audit.js";
import { ping } from "./commands/ping.js";
import { pack } from "./commands/pack.js";
import { version as projectVersion } from "./commands/version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
) as { version: string; description: string };

const program = new Command();

program
  .name("aip")
  .description(pkg.description)
  .version(pkg.version, "-v, --version", "output the current version");

// ---- project lifecycle -----------------------------------------------------

program
  .command("init")
  .description("Create an empty aip.json in the current directory")
  .action(() => init());

program
  .command("install")
  .alias("i")
  .alias("pull")
  .argument("[model]", "model:tag to install; omit to install all from aip.json")
  .option("--no-save", "do not add the model to aip.json")
  .option("-g, --global", "install to the shared store only (no project files)")
  .description("Install a model and save it to aip.json (or install the whole project)")
  .action((model: string | undefined, options: InstallFlags) => install(model, options));

program
  .command("ci")
  .description("Reproducible install strictly from aip.lock (like npm ci)")
  .action(() => ci());

program
  .command("uninstall")
  .alias("remove")
  .alias("rm")
  .argument("<model>", "model:tag to remove")
  .option("-g, --global", "remove from the shared store only (keep project files)")
  .description("Remove a model and drop it from aip.json + aip.lock")
  .action((model: string, options: { global?: boolean }) => uninstall(model, options));

program
  .command("update")
  .alias("upgrade")
  .argument("[model]", "model to update; omit to update all installed models")
  .description("Refresh installed model(s) to the registry's current digest")
  .action((model?: string) => update(model));

program
  .command("prune")
  .option("-y, --yes", "actually delete (default is a dry run)")
  .description("Remove installed models not listed in aip.json (like npm prune)")
  .action((options: { yes?: boolean }) => prune(options));

// ---- inspection ------------------------------------------------------------

program
  .command("list")
  .alias("ls")
  .option("--json", "output as JSON")
  .description("List installed models")
  .action((options: { json?: boolean }) => list(options));

program
  .command("search")
  .argument("[query]", "term to search the registry for")
  .option("--json", "output as JSON")
  .description("Search the registry for models (live)")
  .action((query: string | undefined, options: { json?: boolean }) => search(query, options));

program
  .command("info")
  .alias("view")
  .argument("<model>", "model name (optionally model:tag)")
  .option("--json", "output as JSON")
  .description("Show live metadata and available tags for a model")
  .action((model: string, options: { json?: boolean }) => info(model, options));

program
  .command("outdated")
  .option("--json", "output as JSON")
  .description("Show installed models whose tag has a newer digest in the registry")
  .action((options: { json?: boolean }) => outdated(options));

program
  .command("which")
  .argument("<model>", "model:tag")
  .option("--json", "output as JSON")
  .description("Print the absolute path to an installed model file")
  .action((model: string, options: { json?: boolean }) => which(model, options));

// ---- integrity & health ----------------------------------------------------

program
  .command("verify")
  .argument("[model]", "model:tag to verify; omit to verify all")
  .description("Re-hash installed model files and confirm integrity")
  .action((model?: string) => verify(model));

program
  .command("audit")
  .option("--json", "output as JSON")
  .description("Integrity audit of all installed models + manifest/lock sync")
  .action((options: { json?: boolean }) => audit(options));

program
  .command("doctor")
  .option("--json", "output as JSON")
  .description("Diagnose your aip setup (store, registry, cache, lockfile)")
  .action((options: { json?: boolean }) => doctor(options));

program
  .command("ping")
  .option("--json", "output as JSON")
  .description("Check that the registry is reachable")
  .action((options: { json?: boolean }) => ping(options));

// ---- scripts & packaging ---------------------------------------------------

program
  .command("run")
  .argument("[script]", "script name from aip.json; omit to list scripts")
  .argument("[args...]", "extra args appended to the script")
  .description("Run a script from aip.json with model paths in the env")
  .action((script: string | undefined, args: string[]) => run(script, args));

program
  .command("pack")
  .argument("<model>", "model:tag to bundle")
  .description("Bundle an installed model into a .tar.gz (like npm pack)")
  .action((model: string) => pack(model));

program
  .command("version")
  .argument("[bump]", "major | minor | patch | x.y.z; omit to show current")
  .description("Show or bump the project version in aip.json")
  .action((bump?: string) => projectVersion(bump));

program
  .command("publish")
  .description("Publish the current aip.json to the registry (simulated)")
  .action(() => publish());

program
  .command("share")
  .option("--load <uri>", "install every model encoded in an aip:// URI")
  .description("Print a shareable aip:// URI of installed models, or load one")
  .action((opts: { load?: string }) => share(opts));

// ---- cache, registry, config ----------------------------------------------

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
  .description("Set the OCI registry URL")
  .action((url: string) => registrySet(url));
registry
  .command("set-web")
  .argument("<url>", "discovery website base URL")
  .description("Set the website base used for search/tags")
  .action((url: string) => registrySetWeb(url));

const config = program.command("config").description("Manage aip configuration");
config
  .command("get")
  .argument("<key>", "config key")
  .option("--json", "output as JSON")
  .description("Get a config value")
  .action((key: string, options: { json?: boolean }) => configGet(key, options));
config
  .command("set")
  .argument("<key>", "config key")
  .argument("<value>", "value")
  .description("Set a config value")
  .action((key: string, value: string) => configSet(key, value));
config
  .command("delete")
  .alias("rm")
  .argument("<key>", "config key")
  .description("Delete a config value")
  .action((key: string) => configDelete(key));
config
  .command("list", { isDefault: true })
  .alias("ls")
  .option("--json", "output as JSON")
  .description("List all config values")
  .action((options: { json?: boolean }) => configList(options));

program.configureOutput({
  outputError: (str, write) => write(chalk.red(str)),
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(chalk.red(`✗ ${(err as Error).message}`));
  process.exit(1);
});
