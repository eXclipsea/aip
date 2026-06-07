import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const AIP_HOME = process.env.AIP_HOME ?? join(homedir(), ".aip");
const CONFIG_PATH = join(AIP_HOME, "config.json");

export const DEFAULT_REGISTRY = "https://registry.ollama.ai";
export const DEFAULT_WEB = "https://ollama.com";
export const DEFAULT_NAMESPACE = "library";

export interface Config {
  /** OCI registry base used for manifests + blobs. */
  registry: string;
  /** Website base used for discovery (search + tag listing). */
  web: string;
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
    web: process.env.AIP_REGISTRY_WEB ?? file.web ?? DEFAULT_WEB,
  };
}

/** True when pointed at the default Ollama registry (where discovery works). */
export function isDefaultRegistry(): boolean {
  return getConfig().registry.replace(/\/+$/, "") === DEFAULT_REGISTRY;
}

function writeConfigFile(file: Partial<Config>): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(file, null, 2));
}

export function setRegistry(url: string): void {
  const file = readConfigFile();
  file.registry = url.replace(/\/+$/, "");
  writeConfigFile(file);
}

export function setWeb(url: string): void {
  const file = readConfigFile();
  file.web = url.replace(/\/+$/, "");
  writeConfigFile(file);
}

export function configPath(): string {
  return CONFIG_PATH;
}
