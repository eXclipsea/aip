export interface ModelMeta {
  name: string;
  version: string;
  sha256: string;
  sizeBytes: number;
  license: string;
  quantization: string;
  downloadUrl: string;
  publishedAt: string;
  publisher: string;
  /** Optional real metadata pulled from the registry config blob. */
  family?: string;
  parameterSize?: string;
  format?: string;
  /** Registry namespace, e.g. "library". */
  namespace?: string;
}

export interface Manifest {
  name: string;
  models: Record<string, string>; // { "llama3": "3.3", "mistral": "0.3" }
}

export interface LockEntry {
  version: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
}

export interface Lockfile {
  lockfileVersion: 1;
  models: Record<string, LockEntry>;
}

/** A single installed model as recorded in ~/.aip/cache.json */
export interface CacheEntry {
  name: string;
  version: string;
  sha256: string;
  sizeBytes: number;
  quantization: string;
  license: string;
  publisher: string;
  installedAt: string;
  path: string;
  family?: string;
  parameterSize?: string;
}

export interface CacheIndex {
  models: CacheEntry[];
}
