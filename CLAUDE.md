# Local AI Platform — CLAUDE.md

## What We're Building
An open-source local AI platform with three components:

1. **Model Package Manager** — npm for AI models (versioning, security scanning, private registries)
2. **Personal Data Mesh** — local-first personal context layer with permissioned developer API
3. **Agent Marketplace** — visual canvas where users hire and compose AI agents built by third-party devs

Start with the package manager. Get that working first before touching the other two.

## Tech Stack

- **Language**: TypeScript (Node.js for CLI, Rust for performance-critical parts later)
- **Package manager CLI**: Commander.js for CLI structure
- **Model storage**: Content-addressed local store (hash = identity)
- **Vector DB (for data mesh)**: LanceDB — runs fully local, no server needed
- **Embeddings**: runs via llama.cpp or Apple MLX — never cloud
- **Frontend (agent canvas)**: Next.js + React Flow for the node canvas UI
- **Database**: SQLite for local metadata, manifests, audit logs

## Project Structure

Phase 1 ships the CLI as a single flat TypeScript package (run directly via `tsx`).
The monorepo split into `registry`/`mesh`/`agent` packages comes in later phases.

```
/
├── src/
│   ├── index.ts          ← CLI entry point, registers all commands
│   ├── types.ts          ← shared types (ModelMeta, Manifest, LockEntry, Lockfile)
│   ├── commands/         ← install, remove, list, info, outdated, cache, publish, share
│   └── lib/              ← store, manifest, lockfile, registry (mock), downloader, hash, ui
├── models/               ← legacy local model storage dir (gitignored)
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── README.md
```

Installed models live under `~/.aip/models/<name>/<version>/` (`model.gguf` + `meta.json`),
with a `~/.aip/cache.json` index. Per-project `aip.json` (manifest) and `aip.lock` live in cwd.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run tests
- `npm run lint` — ESLint
- `aip install <model>` — install a model (what we're building)
- `aip list` — list installed models
- `aip publish` — publish to registry

## Where to Start (Phase 1 — Package Manager Only)

1. Build the `aip install` command — downloads a model, verifies hash, stores locally
2. Build `aip list` — shows installed models with version and size
3. Build the manifest format (`aip.json`) — like package.json but for models
4. Build `aip lock` — generates a lockfile for reproducible installs
5. Ship this as open source, get feedback, then move to Phase 2

Don't touch the data mesh or agent marketplace until the package manager has real users.

## Conventions

- TypeScript strict mode, no `any`
- Functional style, avoid classes unless necessary
- Every model operation must verify the content hash — never trust a filename
- All local file paths go through a single `paths.ts` module — no hardcoding
- Error messages must tell the user exactly what to do next, not just what went wrong
- Never send user data or model metadata to any external server without explicit opt-in

## What NOT to Do

- Don't hit any cloud API by default — everything must work fully offline
- Don't build the agent marketplace or data mesh yet — focus on the package manager
- Don't store models in `node_modules` or any auto-cleaned directory
- Don't require Docker or any container runtime — must work with zero infra
- Don't add a database for Phase 1 — flat JSON files are fine to start

## Similar Projects to Study

- [Ollama](https://github.com/ollama/ollama) — see what they do well and badly
- [Khoj](https://github.com/khoj-ai/khoj) — closest thing to the data mesh idea
- [LangGraph](https://github.com/langchain-ai/langgraph) — agent orchestration patterns
- npm CLI source — how a real package manager handles versioning and lockfiles
- Homebrew — how they handle formulae and content-addressed storage

## Context on the Bigger Vision
The three components form a stack:

> Package manager installs models → data mesh uses those models for local indexing →
> agent marketplace runs agents that query the data mesh for context

Long term this is like an "AI OS layer" that sits on top of macOS/Windows/Linux.
The package manager is the wedge — open source it, build the ecosystem, monetize
through enterprise private registries (like npm → GitHub Packages).

## Current Status
Phase 1 — `aip` is a real, npm-grade package manager. **Nothing about the models is
hardcoded**: names, tags, sizes, quantization, parameters, licenses, and digests are all
fetched live from the registry (Ollama by default, `registry.ollama.ai`, configurable).

- **Live registry** (`src/lib/registry.ts`): resolves manifests; takes the GGUF model
  layer's digest+size, the config blob's quant/params/family, the license layer's real
  text (named via `src/lib/license.ts`); publisher = namespace. Search and tag listing
  are scraped live from the registry website. No model list baked into code.
- **Real downloads** (`src/lib/downloader.ts`): streams the blob to disk with a progress
  bar; every install is verified against the registry's sha256 content digest.
- **npm-style project workflow**: `aip.json` manifest + `aip.lock` lockfile (pins the
  resolved content digest). `install` saves by default (`--no-save` to skip); no-arg
  `install` installs the project honoring the lock; `ci` does a strict reproducible
  install from the lock by digest (refuses if lock is out of sync); `uninstall` cleans
  store + manifest + lock; `init` scaffolds a manifest.
- **Shared content-addressed store** at `~/.aip` (pnpm-style), shared across projects.

Phase 1 is feature-complete with npm parity. Commands:
- **Lifecycle**: `init`, `install`/`i`/`pull` (`--no-save`, `-g`), `ci`,
  `uninstall`/`remove`/`rm` (`-g`), `update`/`upgrade`, `prune` (`--yes`), `version`.
- **Inspect** (all `--json`): `list`/`ls`, `search`, `info`/`view`, `outdated`, `which`.
- **Integrity/health**: `verify`, `audit`, `doctor`, `ping`.
- **Scripts/packaging**: `run` (injects `AIP_MODEL_<NAME>` paths), `pack` (tar.gz),
  `publish` (simulated), `share` (+`--load`).
- **Config**: `config get|set|delete|list`, `cache clean|size`, `registry show|set|set-web`.

`aip.json` supports `version`, `description`, `models`, `scripts` (npm-like). Unit tests
under `test/` run via `npm test` (node:test). MIT licensed.

The only thing still simulated is `publish` — the public registry is read-only for
anonymous clients. Next: a real write/publish path (self-hostable registry); optional
HuggingFace GGUF backend; then Phase 2 (data mesh).
