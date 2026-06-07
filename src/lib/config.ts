import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const AIP_HOME = process.env.AIP_HOME ?? join(homedir(), ".aip");
const CONFIG_PATH = join(AIP_HOME, "config.json");

export const DEFAULT_REGISTRY = "https://registry.ollama.ai";
export const DEFAULT_WEB = "https://ollama.com";
export const DEFAULT_NAMESPACE = "library";

/** Keys aip understands, with their defaults and env overrides. */
export const KNOWN_KEYS: Record<string, { default: string; env: string }> = {
  registry: { default: DEFAULT_REGISTRY, env: "AIP_REGISTRY" },
  web: { default: DEFAULT_WEB, env: "AIP_REGISTRY_WEB" },
};

export interface Config {
  registry: string;
  web: string;
}

export type RawConfig = Record<string, string>;

export function getRawConfig(): RawConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as RawConfig;
  } catch {
    return {};
  }
}

function writeRawConfig(cfg: RawConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/** Effective value for a key: env override > config.json > default. */
export function getKey(key: string): string | undefined {
  const known = KNOWN_KEYS[key];
  if (known && process.env[known.env]) return process.env[known.env];
  const raw = getRawConfig()[key];
  if (raw !== undefined) return raw;
  return known?.default;
}

export function setConfigKey(key: string, value: string): void {
  const cfg = getRawConfig();
  cfg[key] = value.replace(/\/+$/, "");
  writeRawConfig(cfg);
}

export function deleteConfigKey(key: string): boolean {
  const cfg = getRawConfig();
  if (!(key in cfg)) return false;
  delete cfg[key];
  writeRawConfig(cfg);
  return true;
}

/** All effective keys (known + any custom in the file). */
export function getEffectiveConfig(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(KNOWN_KEYS)) {
    const v = getKey(key);
    if (v !== undefined) out[key] = v;
  }
  for (const [k, v] of Object.entries(getRawConfig())) out[k] = v;
  return out;
}

/** Typed accessor used throughout the codebase. */
export function getConfig(): Config {
  return {
    registry: getKey("registry") ?? DEFAULT_REGISTRY,
    web: getKey("web") ?? DEFAULT_WEB,
  };
}

export function isDefaultRegistry(): boolean {
  return getConfig().registry.replace(/\/+$/, "") === DEFAULT_REGISTRY;
}

export function setRegistry(url: string): void {
  setConfigKey("registry", url);
}

export function setWeb(url: string): void {
  setConfigKey("web", url);
}

export function configPath(): string {
  return CONFIG_PATH;
}
