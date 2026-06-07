# aip — AI Model Package Manager

`aip` is a package manager for local AI models — like npm, but for GGUF model files.
Install, version, verify, update, and share real models from a single CLI.

Models are pulled from a **live, content-addressed registry** (the Ollama registry
by default — `registry.ollama.ai`). Every install is verified against the registry's
real SHA-256 digest, so you never trust a filename. No login required for public models.

## Install

```bash
npm install
```

Run via `tsx` (no build step needed):

```bash
npx tsx src/index.ts --help
# or
npm run dev -- --help
```

Optionally link it as a global `aip` command:

```bash
npm link    # then: aip --help
```

## Quickstart

```bash
aip search qwen                 # find models in the catalog
aip info qwen2.5                # live metadata + available tags
aip install qwen2.5:0.5b        # download + verify a real model
aip list                        # what's installed
aip which qwen2.5:0.5b          # absolute path to the .gguf (for scripting)
aip verify                      # re-hash everything, confirm integrity
aip outdated                    # what's behind the registry's latest
aip update qwen2.5              # pull the latest digest
aip share                       # → aip://qwen2.5@0.5b   (copy/paste to a friend)
```

## Commands

| Command | What it does |
|---|---|
| `aip install <model:tag>` / `aip pull` | Install a model; no arg installs everything in `aip.json` |
| `aip remove <model:tag>` / `aip rm` | Remove an installed model |
| `aip list` / `aip ls` | Table of installed models (name, version, params, size, quant) |
| `aip search [query]` | Search the model catalog |
| `aip info <model>` | Live metadata + known tags for a model |
| `aip outdated` | Installed models whose digest differs from registry `latest` |
| `aip update [model]` / `aip upgrade` | Update model(s) to the registry's latest |
| `aip verify [model:tag]` | Re-hash installed files and confirm integrity |
| `aip which <model:tag>` | Print the absolute path to an installed model file |
| `aip cache size` | Total disk usage of the model cache |
| `aip cache clean` | Delete all models, report space freed |
| `aip registry [show\|set <url>]` | View or change the registry |
| `aip publish` | Publish the current `aip.json` to the registry (simulated) |
| `aip share` | Print a shareable `aip://...` URI of installed models |
| `aip share --load <uri>` | Install every model encoded in an `aip://` URI |

## Models

Any model on the registry works with `aip install <name>:<tag>` — even if it's not in
the curated catalog. The catalog (used by `search`/`info`) covers the popular families:

`llama3.3` · `llama3.2` · `llama3.1` · `qwen2.5` · `qwen2.5-coder` · `mistral` ·
`mixtral` · `gemma3` · `gemma2` · `phi4` · `phi3` · `deepseek-r1` · `deepseek-v3` ·
`codellama` · `llava` · `nomic-embed-text` · `all-minilm` · `smollm2` · `tinyllama`

Reference syntax is flexible: `qwen2.5:7b` (Ollama-style) or `qwen2.5@7b` (npm-style),
with an optional `namespace/` prefix.

## Layout

- Models installed to `~/.aip/models/<name>/<version>/` (`model.gguf` + `meta.json`)
- Cache index at `~/.aip/cache.json`, config at `~/.aip/config.json`
- Per-project manifest `aip.json` and lockfile `aip.lock` in the working directory
- Override the store root with `AIP_HOME=/path`, the registry with `AIP_REGISTRY=<url>`

## Project structure

```
src/
├── index.ts          CLI entry point (Commander)
├── types.ts          shared types
├── commands/         one file per command
└── lib/              store, manifest, lockfile, registry, downloader, catalog, config, hash, ui
```

## How "real" works

`aip` resolves a model's manifest from the registry, reads the GGUF model layer's
content digest and size, fetches the config blob for real quantization/parameter data,
then streams the blob to disk and re-hashes it. The recorded `sha256` **is** the
registry's content address — verification is genuine, not simulated.
