# aip — AI Model Package Manager

`aip` is a package manager for local AI models — like npm, but for GGUF model files.
It has a project manifest (`aip.json`), a lockfile (`aip.lock`) for reproducible
installs, a shared content-addressed store, and live, registry-driven metadata.

Nothing about the models is hardcoded. Every name, tag, size, quantization, license,
and digest is fetched live from the registry (the Ollama registry by default —
`registry.ollama.ai`). Every install is verified against the registry's real SHA-256
content digest, so you never trust a filename. No login required for public models.

## Install

```bash
npm install
npx tsx src/index.ts --help     # or: npm link  → then `aip --help`
```

## The npm-style workflow

```bash
aip init                        # create aip.json
aip install qwen2.5:7b          # resolve live, download, verify, save to aip.json + lock
aip install                     # install the whole project (honors aip.lock)
aip ci                          # reproducible install, strictly from aip.lock
aip uninstall qwen2.5           # remove from store + aip.json + aip.lock
```

`aip.json` is your manifest (which models the project wants); `aip.lock` pins the exact
resolved **content digest** of each one. `aip ci` installs those digests directly — no
registry resolution — so a teammate (or CI) gets byte-identical models even if a moving
tag like `latest` has since changed upstream.

## Discovery & inspection (all live)

```bash
aip search embed                # live search across the registry
aip info qwen2.5                # live metadata + every available tag + real license
aip list                        # installed models (name, version, params, size, quant)
aip which qwen2.5:7b            # absolute path to the .gguf (for scripts)
aip verify                      # re-hash installed files, confirm integrity
aip outdated                    # tags whose digest moved upstream
aip update [model]              # refresh to the registry's current digest
aip share                       # → aip://qwen2.5@7b   (copy/paste to a friend)
aip share --load <uri>          # install a shared set
```

## Commands

| Command | Description |
|---|---|
| `aip init` | Create an empty `aip.json` |
| `aip install [model:tag]` / `i` / `pull` | Install + save to `aip.json`; no arg installs the project |
| `aip install --no-save <model>` | Install without modifying `aip.json` |
| `aip ci` | Reproducible install strictly from `aip.lock` |
| `aip uninstall <model>` / `remove` / `rm` | Remove from store + `aip.json` + `aip.lock` |
| `aip list` / `ls` | List installed models |
| `aip search <query>` | Live registry search |
| `aip info <model>` / `view` | Live metadata + available tags |
| `aip outdated` | Installed tags whose digest changed upstream |
| `aip update [model]` / `upgrade` | Refresh to the registry's current digest |
| `aip verify [model:tag]` | Re-hash installed files, confirm integrity |
| `aip which <model:tag>` | Print absolute path to a model file |
| `aip cache size` / `clean` | Disk usage / wipe the store |
| `aip registry [show\|set <url>\|set-web <url>]` | View or change the registry |
| `aip publish` | Validate `aip.json` and (simulated) publish |
| `aip share [--load <uri>]` | Export/import an `aip://` set |

Any model on the registry works with `aip install <name>:<tag>` — reference syntax is
flexible: `qwen2.5:7b` (Ollama-style) or `qwen2.5@7b` (npm-style), with an optional
`namespace/` prefix.

## Layout

- **Shared store** (like pnpm): models live in `~/.aip/models/<name>/<version>/`
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
├── commands/         init, install, ci, uninstall, list, search, info,
│                     outdated, update, verify, which, cache, registry, publish, share
└── lib/              store, manifest, lockfile, registry, downloader,
                      hash, license, config, ui
```
