import type { ModelMeta } from "../types.js";
import { getConfig, isDefaultRegistry, DEFAULT_NAMESPACE } from "./config.js";
import { detectLicense } from "./license.js";

const MODEL_MEDIA_TYPE = "application/vnd.ollama.image.model";
const LICENSE_MEDIA_TYPE = "application/vnd.ollama.image.license";
const MANIFEST_ACCEPT = "application/vnd.docker.distribution.manifest.v2+json";

interface OllamaLayer {
  mediaType: string;
  digest: string;
  size: number;
}

interface OllamaManifest {
  schemaVersion: number;
  config: { digest: string; size: number };
  layers: OllamaLayer[];
}

interface OllamaConfig {
  model_format?: string;
  model_family?: string;
  model_type?: string;
  file_type?: string;
}

/** Parse "namespace/name" → { namespace, model }. Defaults namespace to library. */
export function splitName(name: string): { namespace: string; model: string } {
  const slash = name.indexOf("/");
  if (slash === -1) return { namespace: DEFAULT_NAMESPACE, model: name };
  return { namespace: name.slice(0, slash), model: name.slice(slash + 1) };
}

function manifestUrl(name: string, tag: string): string {
  const { registry } = getConfig();
  const { namespace, model } = splitName(name);
  return `${registry}/v2/${namespace}/${model}/manifests/${encodeURIComponent(tag)}`;
}

function blobUrl(name: string, digest: string): string {
  const { registry } = getConfig();
  const { namespace, model } = splitName(name);
  return `${registry}/v2/${namespace}/${model}/blobs/${digest}`;
}

async function fetchManifest(name: string, tag: string): Promise<OllamaManifest> {
  const url = manifestUrl(name, tag);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: MANIFEST_ACCEPT } });
  } catch (err) {
    throw new Error(
      `Could not reach the registry at ${url}. Check your connection (offline?) ` +
        `or change it with 'aip registry set <url>'. (${(err as Error).message})`
    );
  }
  if (res.status === 404) {
    throw new Error(
      `Model "${name}:${tag}" was not found in the registry. ` +
        `Run 'aip search ${splitName(name).model}' or 'aip info ${name}' to see valid names and tags.`
    );
  }
  if (!res.ok) {
    throw new Error(`Registry returned ${res.status} ${res.statusText} for ${name}:${tag}.`);
  }
  return (await res.json()) as OllamaManifest;
}

async function fetchTextBlob(name: string, digest: string): Promise<string> {
  try {
    const res = await fetch(blobUrl(name, digest), { redirect: "follow" });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

async function fetchConfigBlob(name: string, digest: string): Promise<OllamaConfig> {
  const text = await fetchTextBlob(name, digest);
  if (!text) return {};
  try {
    return JSON.parse(text) as OllamaConfig;
  } catch {
    return {};
  }
}

/**
 * Resolve real, live metadata for a model:tag from the registry. Every field
 * comes from the registry — sha256/size from the model layer, quant/params from
 * the config blob, license from the license layer, publisher from the namespace.
 */
export async function resolveMeta(name: string, tag?: string): Promise<ModelMeta> {
  const resolvedTag = tag ?? "latest";
  const manifest = await fetchManifest(name, resolvedTag);

  const modelLayer = manifest.layers.find((l) => l.mediaType === MODEL_MEDIA_TYPE);
  if (!modelLayer) {
    throw new Error(
      `"${name}:${resolvedTag}" has no model layer in its manifest — it may not be a downloadable model.`
    );
  }

  const [config, licenseText] = await Promise.all([
    fetchConfigBlob(name, manifest.config.digest),
    (async () => {
      const lic = manifest.layers.find((l) => l.mediaType === LICENSE_MEDIA_TYPE);
      return lic ? fetchTextBlob(name, lic.digest) : "";
    })(),
  ]);

  const { namespace } = splitName(name);

  return {
    name,
    version: resolvedTag,
    sha256: modelLayer.digest.replace(/^sha256:/, ""),
    sizeBytes: modelLayer.size,
    license: licenseText ? detectLicense(licenseText) : "see model card",
    quantization: config.file_type ?? "unknown",
    downloadUrl: blobUrl(name, modelLayer.digest),
    publishedAt: "",
    publisher: namespace,
    family: config.model_family,
    parameterSize: config.model_type,
    format: config.model_format ?? "gguf",
    namespace,
  };
}

/** Does the registry have this model:tag? Cheap existence check via manifest. */
export async function exists(name: string, tag: string): Promise<boolean> {
  try {
    await fetchManifest(name, tag);
    return true;
  } catch {
    return false;
  }
}

// ---- Discovery -------------------------------------------------------------
// Default (Ollama) registry has no machine API, so we scrape its website.
// Self-hosted aip registries implement OCI _catalog + tags/list, which we use
// directly — so discovery works there too.

export interface SearchResult {
  name: string;
  description: string;
}

/** Search via the OCI _catalog endpoint (self-hosted registries). */
async function searchViaCatalog(query: string): Promise<SearchResult[]> {
  const { registry } = getConfig();
  const res = await fetch(`${registry.replace(/\/+$/, "")}/v2/_catalog`);
  if (!res.ok) throw new Error(`Search failed: registry returned HTTP ${res.status}.`);
  const body = (await res.json()) as { repositories?: string[] };
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const repo of body.repositories ?? []) {
    const name = repo.replace(/^library\//, "");
    if (name.toLowerCase().includes(q) && !seen.has(name)) {
      seen.add(name);
      out.push({ name, description: "" });
    }
  }
  return out;
}

/** Live search. Scrapes the Ollama website; uses _catalog on self-hosted registries. */
export async function searchRegistry(query: string): Promise<SearchResult[]> {
  if (!isDefaultRegistry()) return searchViaCatalog(query);
  const { web } = getConfig();
  const url = `${web}/search?q=${encodeURIComponent(query)}`;
  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "aip-cli" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    throw new Error(`Search failed: ${(err as Error).message}. Check your connection.`);
  }

  // Each result links to /library/<name>. Preserve first-seen order, dedup.
  const re = /href="\/library\/([a-z0-9][a-z0-9._-]*)"/g;
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const m of html.matchAll(re)) {
    const modelName = m[1];
    if (seen.has(modelName)) continue;
    seen.add(modelName);
    results.push({ name: modelName, description: "" });
  }
  return results;
}

/** Tags via the OCI tags/list endpoint (self-hosted registries). */
async function listTagsViaApi(name: string): Promise<string[]> {
  const { registry } = getConfig();
  const { namespace, model } = splitName(name);
  const url = `${registry.replace(/\/+$/, "")}/v2/${namespace}/${model}/tags/list`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { tags?: string[] };
    return body.tags ?? [];
  } catch {
    return [];
  }
}

/** Live list of available tags. Scrapes Ollama; uses tags/list on self-hosted. */
export async function listTags(name: string): Promise<string[]> {
  if (!isDefaultRegistry()) return listTagsViaApi(name);
  const { web } = getConfig();
  const { namespace, model } = splitName(name);
  const path = namespace === DEFAULT_NAMESPACE ? model : `${namespace}/${model}`;
  const url = `${web}/library/${path}/tags`;
  let html: string;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "aip-cli" } });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const re = new RegExp(
    `/library/${model.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}:([a-zA-Z0-9][a-zA-Z0-9._-]*)`,
    "g"
  );
  const seen = new Set<string>();
  for (const m of html.matchAll(re)) seen.add(m[1]);
  return [...seen];
}
