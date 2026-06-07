# aip — AI Model Package Manager

`aip` is a package manager for local AI models — like npm, but for GGUF model files.
It has a project manifest (`aip.json`), a lockfile (`aip.lock`) for reproducible
installs, a shared content-addressed store, scripts, config, health checks, and
live, registry-driven metadata.

Nothing about the models is hardcoded. Every name, tag, size, quantization, license,
and digest is fetched live from the registry (the Ollama registry by default —
`registry.ollama.ai`). Every install is verified against the registry's real SHA-256
content digest, so you never trust a filename. No login required for public models.

## Install

Run these **from the project directory**:

```bash
cd AIP
npm install        # install dependencies
npm link           # makes `aip` a global command
```

Now `aip` works from anywhere:

```bash
aip --help
aip search qwen
```

(Prefer not to link? Run it in place with `npx tsx src/index.ts <args>` from the
project directory. Run the tests with `npm test`.)

## The npm-style workflow

```bash
aip init                        # create aip.json
aip install qwen2.5:7b          # resolve live, download, verify, save to aip.json + lock
aip install                     # install the whole project (honors aip.lock)
aip ci                          # reproducible install, strictly from aip.lock
aip uninstall qwen2.5           # remove from store + aip.json + aip.lock
aip prune --yes                 # remove installed models not in aip.json
```

`aip.json` is your manifest; `aip.lock` pins each model's resolved **content digest**.
`aip ci` installs those digests directly — no registry resolution — so a teammate or CI
gets byte-identical models even if a moving tag like `latest` changed upstream.

## Commands

### Project lifecycle
| Command | Description |
|---|---|
| `aip init` | Create an empty `aip.json` |
| `aip install [model:tag]` / `i` / `pull` | Install + save to `aip.json`; no arg installs the project |
| `aip install --no-save <model>` | Install without modifying `aip.json` |
| `aip install -g <model>` | Install to the shared store only (no project files) |
| `aip ci` | Reproducible install strictly from `aip.lock` |
| `aip uninstall <model>` / `remove` / `rm` | Remove from store + `aip.json` + `aip.lock` (`-g` = store only) |
| `aip update [model]` / `upgrade` | Refresh to the registry's current digest |
| `aip prune [--yes]` | Remove installed models not listed in `aip.json` |
| `aip version [major\|minor\|patch\|x.y.z]` | Show or bump the project version |

### Inspection (all support `--json`)
| Command | Description |
|---|---|
| `aip list` / `ls` | List installed models |
| `aip search <query>` | Live registry search |
| `aip info <model>` / `view` | Live metadata + available tags |
| `aip outdated` | Installed tags whose digest changed upstream |
| `aip which <model:tag>` | Absolute path to a model file |

### Integrity & health
| Command | Description |
|---|---|
| `aip verify [model:tag]` | Re-hash installed files, confirm integrity |
| `aip audit [--json]` | Integrity audit of all models + manifest/lock sync |
| `aip doctor [--json]` | Diagnose store, registry, cache, lockfile |
| `aip ping [--json]` | Check the registry is reachable |

### Scripts, packaging & publishing
| Command | Description |
|---|---|
| `aip run [script] [args...]` | Run an `aip.json` script with model paths in env |
| `aip pack <model:tag>` | Bundle an installed model into a `.tar.gz` |
| `aip publish [model:tag]` | **Real** OCI push of installed model(s) to your registry |
| `aip registry serve` | Host your own self-hostable OCI registry |
| `aip share [--load <uri>]` | Export/import an `aip://` model set |

### Configuration
| Command | Description |
|---|---|
| `aip config list` / `get <k>` / `set <k> <v>` / `delete <k>` | Manage config (`--json` on list/get) |
| `aip cache size` / `clean` | Disk usage / wipe the store |
| `aip registry [show\|set <url>\|set-web <url>]` | View or change the registry |

Reference syntax is flexible: `qwen2.5:7b` (Ollama-style) or `qwen2.5@7b` (npm-style),
with an optional `namespace/` prefix. Any model on the registry installs, not just
ones that show up in `search`.

## Scripts

Define scripts in `aip.json`, like npm. Every installed model is exposed to the script
as `AIP_MODEL_<NAME>` (the `.gguf` path), plus `AIP_MODELS_DIR`:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "models": { "all-minilm": "latest" },
  "scripts": { "embed": "python embed.py --model $AIP_MODEL_ALL_MINILM" }
}
```

```bash
aip run embed
```

## Host your own registry (real publish + private registries)

`aip` ships with a self-hostable, OCI-compatible registry. Run it, point a client
at it, and `publish` becomes a real upload — the foundation for private registries.

```bash
# Terminal 1 — start the registry (flat-file, content-addressed, zero infra)
aip registry serve --port 5000

# Terminal 2 — point at it, then push a model you've installed
aip registry set http://localhost:5000
aip publish all-minilm:latest        # uploads config + model blobs + manifest

# Anyone pointed at that registry can now pull it, fully verified
aip install all-minilm:latest
aip search all                       # works via the OCI _catalog endpoint
aip info all-minilm                  # tags via the OCI tags/list endpoint
```

The server implements the OCI distribution endpoints the client already speaks
(`/v2/.../manifests`, `/v2/.../blobs`, blob uploads, `tags/list`, `_catalog`), so
no special client code is needed — the same `install`/`info`/`search` just work.
Blobs are verified by digest on upload **and** on download. Publishing to the
public Ollama registry is refused (it's read-only for you).

## Layout

- **Shared store** (pnpm-style): models live in `~/.aip/models/<name>/<version>/`
  (`model.gguf` + `meta.json`), with an index at `~/.aip/cache.json` and config at
  `~/.aip/config.json`.
- **Per-project**: `aip.json` (manifest) and `aip.lock` (lockfile) in the working dir.
- Override the store with `AIP_HOME=<path>`, the registry with `AIP_REGISTRY=<url>`,
  and discovery with `AIP_REGISTRY_WEB=<url>`.

## How "live" works

`aip` reads a model's manifest from the registry, takes the GGUF model layer's content
digest + size, the config blob's quantization/parameters/family, and the license layer's
real text (named via `lib/license.ts`); publisher is the namespace. It then streams the
real blob to disk and re-hashes it. The recorded `sha256` **is** the registry's content
address — verification is genuine. Search and tag listings are scraped live from the
registry website, so no model list is baked into the code.

## Project structure

```
src/
├── index.ts          CLI entry (Commander)
├── types.ts          shared types
├── commands/         init, install, ci, uninstall, update, prune, version,
│                     list, search, info, outdated, which,
│                     verify, audit, doctor, ping,
│                     run, pack, publish, serve, share, cache, registry, config
└── lib/              store, manifest, lockfile, registry, downloader, publisher,
                      server, hash, license, config, semver, ui
test/                 node:test unit + registry-server integration tests (npm test)
```
