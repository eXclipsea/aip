import type { ModelMeta } from "../types.js";
import { getConfig, DEFAULT_NAMESPACE } from "./config.js";
import { getCatalogModel } from "./catalog.js";

const MODEL_MEDIA_TYPE = "application/vnd.ollama.image.model";
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
function splitName(name: string): { namespace: string; model: string } {
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
        `or set a different registry with 'aip registry set <url>'. (${(err as Error).message})`
    );
  }
  if (res.status === 404) {
    throw new Error(
      `Model "${name}:${tag}" was not found in the registry. ` +
        `Run 'aip search ${name}' or 'aip info ${name}' to see valid names and tags.`
    );
  }
  if (!res.ok) {
    throw new Error(`Registry returned ${res.status} ${res.statusText} for ${name}:${tag}.`);
  }
  return (await res.json()) as OllamaManifest;
}

async function fetchConfigBlob(name: string, digest: string): Promise<OllamaConfig> {
  try {
    const res = await fetch(blobUrl(name, digest), { redirect: "follow" });
    if (!res.ok) return {};
    return (await res.json()) as OllamaConfig;
  } catch {
    return {}; // config is best-effort enrichment, not required
  }
}

/**
 * Resolve real, live metadata for a model:tag from the registry.
 * sha256 is the registry's content digest, so verification after download is real.
 */
export async function resolveMeta(name: string, tag?: string): Promise<ModelMeta> {
  const resolvedTag = tag ?? defaultTag(name);
  const manifest = await fetchManifest(name, resolvedTag);

  const modelLayer = manifest.layers.find((l) => l.mediaType === MODEL_MEDIA_TYPE);
  if (!modelLayer) {
    throw new Error(
      `"${name}:${resolvedTag}" has no model layer in its manifest — it may not be a downloadable model.`
    );
  }

  const config = await fetchConfigBlob(name, manifest.config.digest);
  const catalog = getCatalogModel(splitName(name).model) ?? getCatalogModel(name);
  const { namespace } = splitName(name);

  return {
    name,
    version: resolvedTag,
    sha256: modelLayer.digest.replace(/^sha256:/, ""),
    sizeBytes: modelLayer.size,
    license: catalog?.license ?? "see model card",
    quantization: config.file_type ?? "unknown",
    downloadUrl: blobUrl(name, modelLayer.digest),
    publishedAt: "",
    publisher: catalog?.publisher ?? namespace,
    family: config.model_family ?? catalog?.family,
    parameterSize: config.model_type,
    format: config.model_format ?? "gguf",
    namespace,
  };
}

/** The default tag for a model — from the catalog, else "latest". */
export function defaultTag(name: string): string {
  const m = getCatalogModel(splitName(name).model) ?? getCatalogModel(name);
  return m?.tags[0] ?? "latest";
}

/** Known tags for a model from the catalog (empty if unknown). */
export function listTags(name: string): string[] {
  const m = getCatalogModel(splitName(name).model) ?? getCatalogModel(name);
  return m?.tags ?? [];
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
