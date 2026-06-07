import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const AIP_HOME = process.env.AIP_HOME ?? join(homedir(), ".aip");
const CONFIG_PATH = join(AIP_HOME, "config.json");

export const DEFAULT_REGISTRY = "https://registry.ollama.ai";
export const DEFAULT_NAMESPACE = "library";

export interface Config {
  registry: string;
}

function readConfigFile(): Partial<Config> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Partial<Config>;
  } catch {
    return {};
  }
}

/** Effective config: env override > config.json > default. */
export function getConfig(): Config {
  const file = readConfigFile();
  return {
    registry: process.env.AIP_REGISTRY ?? file.registry ?? DEFAULT_REGISTRY,
  };
}

export function setRegistry(url: string): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  const file = readConfigFile();
  file.registry = url.replace(/\/+$/, "");
  writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2));
}

export function configPath(): string {
  return CONFIG_PATH;
}
