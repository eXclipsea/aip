import chalk from "chalk";
import {
  getKey,
  setConfigKey,
  deleteConfigKey,
  getEffectiveConfig,
  getRawConfig,
  KNOWN_KEYS,
  configPath,
} from "../lib/config.js";
import { ok, fail, info, printJson } from "../lib/ui.js";

export async function configGet(key: string, opts: { json?: boolean } = {}): Promise<void> {
  const value = getKey(key);
  if (value === undefined) {
    fail(`No config value for "${key}". Known keys: ${Object.keys(KNOWN_KEYS).join(", ")}.`);
    process.exitCode = 1;
    return;
  }
  if (opts.json) return printJson({ [key]: value });
  console.log(value);
}

export async function configSet(key: string, value: string): Promise<void> {
  setConfigKey(key, value);
  ok(`Set ${key} = ${value.replace(/\/+$/, "")}`);
}

export async function configDelete(key: string): Promise<void> {
  if (deleteConfigKey(key)) ok(`Deleted ${key} from config.`);
  else info(`No stored value for "${key}" (it may be a default or env override).`);
}

export async function configList(opts: { json?: boolean } = {}): Promise<void> {
  const effective = getEffectiveConfig();
  if (opts.json) return printJson(effective);

  const raw = getRawConfig();
  console.log(chalk.bold(`config: ${configPath()}\n`));
  for (const [key, value] of Object.entries(effective)) {
    const known = KNOWN_KEYS[key];
    let source = "default";
    if (known && process.env[known.env]) source = `env:${known.env}`;
    else if (key in raw) source = "config.json";
    console.log(`  ${key.padEnd(10)} ${chalk.cyan(value)}  ${chalk.dim("(" + source + ")")}`);
  }
}
