import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createReadStream } from "node:fs";
import { getConfig } from "./config.js";
import { paths, isInstalled } from "./store.js";
import { splitName } from "./registry.js";
import type { ModelMeta } from "../types.js";

const MODEL_MEDIA_TYPE = "application/vnd.ollama.image.model";
const CONFIG_MEDIA_TYPE = "application/vnd.docker.container.image.v1+json";
const MANIFEST_MEDIA_TYPE = "application/vnd.docker.distribution.manifest.v2+json";

function origin(registry: string): string {
  return registry.replace(/\/+$/, "");
}

async function blobExists(registry: string, repo: string, digest: string): Promise<boolean> {
  const res = await fetch(`${origin(registry)}/v2/${repo}/blobs/${digest}`, { method: "HEAD" });
  return res.ok;
}

/** Monolithic OCI upload of an in-memory blob. */
async function uploadBuffer(registry: string, repo: string, digest: string, body: Buffer): Promise<void> {
  const start = await fetch(`${origin(registry)}/v2/${repo}/blobs/uploads/`, { method: "POST" });
  if (start.status !== 202) throw new Error(`upload start failed: HTTP ${start.status}`);
  const location = resolveLocation(registry, start.headers.get("location"));
  const put = await fetch(appendDigest(location, digest), {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(body.length) },
    body: new Uint8Array(body),
  });
  if (put.status !== 201) throw new Error(`blob PUT failed: HTTP ${put.status} ${await safeText(put)}`);
}

/** Monolithic OCI upload of a file, streamed. */
async function uploadFile(registry: string, repo: string, digest: string, file: string, size: number): Promise<void> {
  const start = await fetch(`${origin(registry)}/v2/${repo}/blobs/uploads/`, { method: "POST" });
  if (start.status !== 202) throw new Error(`upload start failed: HTTP ${start.status}`);
  const location = resolveLocation(registry, start.headers.get("location"));
  const stream = Readable.toWeb(createReadStream(file)) as unknown as WebReadableStream<Uint8Array>;
  const put = await fetch(appendDigest(location, digest), {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
    body: stream as unknown as BodyInit,
    // @ts-expect-error duplex is required by Node for streaming bodies
    duplex: "half",
  });
  if (put.status !== 201) throw new Error(`blob PUT failed: HTTP ${put.status} ${await safeText(put)}`);
}

function resolveLocation(registry: string, location: string | null): string {
  if (!location) throw new Error("registry did not return an upload Location");
  if (/^https?:\/\//.test(location)) return location;
  return `${origin(registry)}${location.startsWith("/") ? "" : "/"}${location}`;
}

function appendDigest(location: string, digest: string): string {
  const sep = location.includes("?") ? "&" : "?";
  return `${location}${sep}digest=${encodeURIComponent(digest)}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

export interface PublishResult {
  repo: string;
  tag: string;
  registry: string;
  modelDigest: string;
}

/**
 * Push an installed model to the configured registry using the OCI flow:
 * upload the config blob + model blob (skipping any the registry already has),
 * then PUT a manifest. Returns where it landed.
 */
export async function publishModel(name: string, version: string): Promise<PublishResult> {
  if (!isInstalled(name, version)) {
    throw new Error(`${name}@${version} is not installed. Install it before publishing.`);
  }
  const { registry } = getConfig();
  const { namespace, model } = splitName(name);
  const repo = `${namespace}/${model}`;

  const meta = JSON.parse(readFileSync(paths.metaFile(name, version), "utf8")) as ModelMeta;
  const modelFile = paths.modelFile(name, version);
  const modelSize = statSync(modelFile).size;
  const modelDigest = `sha256:${meta.sha256}`;

  // Config blob (real fields from the local meta).
  const config = {
    model_format: meta.format ?? "gguf",
    model_family: meta.family,
    model_type: meta.parameterSize,
    file_type: meta.quantization,
    architecture: "amd64",
    os: "linux",
  };
  const configBytes = Buffer.from(JSON.stringify(config));
  const configDigest = `sha256:${createHash("sha256").update(configBytes).digest("hex")}`;

  if (!(await blobExists(registry, repo, configDigest))) {
    await uploadBuffer(registry, repo, configDigest, configBytes);
  }
  if (!(await blobExists(registry, repo, modelDigest))) {
    await uploadFile(registry, repo, modelDigest, modelFile, modelSize);
  }

  const manifest = {
    schemaVersion: 2,
    mediaType: MANIFEST_MEDIA_TYPE,
    config: { mediaType: CONFIG_MEDIA_TYPE, digest: configDigest, size: configBytes.length },
    layers: [{ mediaType: MODEL_MEDIA_TYPE, digest: modelDigest, size: modelSize }],
  };
  const put = await fetch(`${origin(registry)}/v2/${repo}/manifests/${encodeURIComponent(version)}`, {
    method: "PUT",
    headers: { "Content-Type": MANIFEST_MEDIA_TYPE },
    body: JSON.stringify(manifest),
  });
  if (put.status !== 201) {
    throw new Error(`manifest PUT failed: HTTP ${put.status} ${await safeText(put)}`);
  }

  return { repo, tag: version, registry: origin(registry), modelDigest };
}
