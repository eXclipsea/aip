import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";

const MANIFEST_MEDIA_TYPE = "application/vnd.docker.distribution.manifest.v2+json";

export interface ServerOptions {
  dir: string;
  port: number;
  host?: string;
}

interface Paths {
  blobs: string;
  manifests: string;
  tmp: string;
}

function layout(dir: string): Paths {
  return {
    blobs: join(dir, "blobs", "sha256"),
    manifests: join(dir, "manifests"),
    tmp: join(dir, "tmp"),
  };
}

function ensureDirs(p: Paths): void {
  for (const d of [p.blobs, p.manifests, p.tmp]) mkdirSync(d, { recursive: true });
}

function blobPath(p: Paths, digest: string): string {
  return join(p.blobs, digest.replace(/^sha256:/, ""));
}

function manifestPath(p: Paths, repo: string, ref: string): string {
  return join(p.manifests, repo, `${ref}.json`);
}

function send(res: ServerResponse, status: number, body?: string | Buffer, headers: Record<string, string> = {}): void {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, obj: unknown): void {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json" });
}

async function collectBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Stream the request body to a temp file while hashing; return the sha256. */
async function streamToTemp(req: IncomingMessage, tmpFile: string): Promise<string> {
  const hash = createHash("sha256");
  req.on("data", (c: Buffer) => hash.update(c));
  await pipeline(req, createWriteStream(tmpFile));
  return hash.digest("hex");
}

type Handler = (req: IncomingMessage, res: ServerResponse, p: Paths, log: (m: string) => void) => Promise<void> | void;

const ROUTES: Array<{ method: string; re: RegExp; handler: Handler }> = [
  // Version check
  {
    method: "GET",
    re: /^\/v2\/?$/,
    handler: (_req, res) => sendJson(res, 200, {}),
  },
  // Catalog: list repositories
  {
    method: "GET",
    re: /^\/v2\/_catalog$/,
    handler: (_req, res, p) => {
      const repos: string[] = [];
      const walk = (base: string, prefix: string): void => {
        if (!existsSync(base)) return;
        for (const entry of readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory()) walk(join(base, entry.name), `${prefix}${entry.name}/`);
          else if (entry.name.endsWith(".json")) {
            const repo = prefix.replace(/\/$/, "");
            if (repo && !repos.includes(repo)) repos.push(repo);
          }
        }
      };
      walk(p.manifests, "");
      sendJson(res, 200, { repositories: repos });
    },
  },
  // Tags list
  {
    method: "GET",
    re: /^\/v2\/(.+)\/tags\/list$/,
    handler: (req, res, p) => {
      const repo = req.url!.match(/^\/v2\/(.+)\/tags\/list$/)![1];
      const dir = join(p.manifests, repo);
      const tags = existsSync(dir)
        ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))
        : [];
      sendJson(res, 200, { name: repo, tags });
    },
  },
  // Start a blob upload (monolithic): return a Location to PUT to.
  {
    method: "POST",
    re: /^\/v2\/(.+)\/blobs\/uploads\/?$/,
    handler: (req, res) => {
      const repo = req.url!.match(/^\/v2\/(.+)\/blobs\/uploads\/?$/)![1].split("?")[0];
      const uuid = randomUUID();
      send(res, 202, undefined, {
        Location: `/v2/${repo}/blobs/uploads/${uuid}`,
        "Docker-Upload-UUID": uuid,
        Range: "0-0",
      });
    },
  },
  // Complete a monolithic blob upload: body = bytes, ?digest=sha256:...
  {
    method: "PUT",
    re: /^\/v2\/(.+)\/blobs\/uploads\/([^/?]+)/,
    handler: async (req, res, p, log) => {
      const url = new URL(req.url!, "http://localhost");
      const repo = url.pathname.match(/^\/v2\/(.+)\/blobs\/uploads\//)![1];
      const digest = url.searchParams.get("digest");
      if (!digest) return send(res, 400, "missing digest");
      const tmpFile = join(p.tmp, randomUUID());
      const actual = await streamToTemp(req, tmpFile);
      if (`sha256:${actual}` !== digest) {
        rmSync(tmpFile, { force: true });
        return sendJson(res, 400, { error: "DIGEST_INVALID", expected: digest, actual: `sha256:${actual}` });
      }
      const dest = blobPath(p, digest);
      mkdirSync(dirname(dest), { recursive: true });
      renameSync(tmpFile, dest);
      log(`stored blob ${digest} (${statSync(dest).size} bytes) for ${repo}`);
      send(res, 201, undefined, { Location: `/v2/${repo}/blobs/${digest}`, "Docker-Content-Digest": digest });
    },
  },
  // HEAD blob
  {
    method: "HEAD",
    re: /^\/v2\/(.+)\/blobs\/(sha256:[a-f0-9]+)$/,
    handler: (req, res, p) => {
      const digest = req.url!.match(/\/blobs\/(sha256:[a-f0-9]+)$/)![1];
      const file = blobPath(p, digest);
      if (!existsSync(file)) return send(res, 404);
      send(res, 200, undefined, {
        "Content-Length": String(statSync(file).size),
        "Docker-Content-Digest": digest,
      });
    },
  },
  // GET blob (streamed)
  {
    method: "GET",
    re: /^\/v2\/(.+)\/blobs\/(sha256:[a-f0-9]+)$/,
    handler: async (req, res, p) => {
      const digest = req.url!.match(/\/blobs\/(sha256:[a-f0-9]+)$/)![1];
      const file = blobPath(p, digest);
      if (!existsSync(file)) return sendJson(res, 404, { error: "BLOB_UNKNOWN" });
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(statSync(file).size),
        "Docker-Content-Digest": digest,
      });
      await pipeline(createReadStream(file), res);
    },
  },
  // PUT manifest
  {
    method: "PUT",
    re: /^\/v2\/(.+)\/manifests\/(.+)$/,
    handler: async (req, res, p, log) => {
      const m = req.url!.match(/^\/v2\/(.+)\/manifests\/(.+)$/)!;
      const [repo, ref] = [m[1], m[2]];
      const body = await collectBody(req);
      const dest = manifestPath(p, repo, ref);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, body);
      const digest = `sha256:${createHash("sha256").update(body).digest("hex")}`;
      log(`stored manifest ${repo}:${ref}`);
      send(res, 201, undefined, { "Docker-Content-Digest": digest, Location: `/v2/${repo}/manifests/${ref}` });
    },
  },
  // HEAD manifest
  {
    method: "HEAD",
    re: /^\/v2\/(.+)\/manifests\/(.+)$/,
    handler: (req, res, p) => {
      const m = req.url!.match(/^\/v2\/(.+)\/manifests\/(.+)$/)!;
      const file = manifestPath(p, m[1], m[2]);
      if (!existsSync(file)) return send(res, 404);
      send(res, 200, undefined, { "Content-Type": MANIFEST_MEDIA_TYPE, "Content-Length": String(statSync(file).size) });
    },
  },
  // GET manifest
  {
    method: "GET",
    re: /^\/v2\/(.+)\/manifests\/(.+)$/,
    handler: (req, res, p) => {
      const m = req.url!.match(/^\/v2\/(.+)\/manifests\/(.+)$/)!;
      const file = manifestPath(p, m[1], m[2]);
      if (!existsSync(file)) return sendJson(res, 404, { error: "MANIFEST_UNKNOWN" });
      send(res, 200, readFileSync(file), { "Content-Type": MANIFEST_MEDIA_TYPE });
    },
  },
];

/** Create the registry HTTP server (does not start listening). */
export function createRegistryServer(opts: { dir: string; quiet?: boolean }): Server {
  const p = layout(opts.dir);
  ensureDirs(p);
  const log = (m: string): void => {
    if (!opts.quiet) console.log(`  ${new Date().toISOString()}  ${m}`);
  };

  return createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    const route = ROUTES.find((r) => r.method === req.method && r.re.test(path));
    if (!route) {
      sendJson(res, 404, { error: "NOT_FOUND", method: req.method, path });
      return;
    }
    Promise.resolve(route.handler(req, res, p, log)).catch((err: unknown) => {
      if (!res.headersSent) sendJson(res, 500, { error: "INTERNAL", message: (err as Error).message });
    });
  });
}

/** Start the registry server and resolve once it is listening. */
export function startRegistryServer(opts: ServerOptions): Promise<Server> {
  const server = createRegistryServer({ dir: opts.dir });
  return new Promise((resolve) => {
    server.listen(opts.port, opts.host ?? "0.0.0.0", () => resolve(server));
  });
}
