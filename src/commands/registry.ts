import chalk from "chalk";
import {
  getConfig,
  setRegistry,
  setWeb,
  configPath,
  DEFAULT_REGISTRY,
  DEFAULT_WEB,
} from "../lib/config.js";
import { ok, info } from "../lib/ui.js";

export async function registryShow(): Promise<void> {
  const cfg = getConfig();
  info(`Registry: ${chalk.cyan(cfg.registry)}`);
  console.log(`  Web:      ${chalk.cyan(cfg.web)}`);
  if (process.env.AIP_REGISTRY) console.log(chalk.dim(`  (registry from AIP_REGISTRY env)`));
  if (process.env.AIP_REGISTRY_WEB) console.log(chalk.dim(`  (web from AIP_REGISTRY_WEB env)`));
  console.log(chalk.dim(`  config:   ${configPath()}`));
  console.log(chalk.dim(`  defaults: ${DEFAULT_REGISTRY} | ${DEFAULT_WEB}`));
}

export async function registrySet(url: string): Promise<void> {
  setRegistry(url);
  ok(`Registry set to ${url.replace(/\/+$/, "")}`);
}

export async function registrySetWeb(url: string): Promise<void> {
  setWeb(url);
  ok(`Discovery web base set to ${url.replace(/\/+$/, "")}`);
}
