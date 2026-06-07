import { getConfig, setRegistry, configPath, DEFAULT_REGISTRY } from "../lib/config.js";
import { ok, info } from "../lib/ui.js";
import chalk from "chalk";

export async function registryShow(): Promise<void> {
  const { registry } = getConfig();
  info(`Registry: ${chalk.cyan(registry)}`);
  if (process.env.AIP_REGISTRY) {
    console.log(chalk.dim(`  (from AIP_REGISTRY env var)`));
  }
  console.log(chalk.dim(`  config: ${configPath()}`));
  console.log(chalk.dim(`  default: ${DEFAULT_REGISTRY}`));
}

export async function registrySet(url: string): Promise<void> {
  setRegistry(url);
  ok(`Registry set to ${url.replace(/\/+$/, "")}`);
}
