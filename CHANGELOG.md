# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.0.7] - 2026-05-20

### Changed
- Unified the npm package and VS Code extension versions at `1.0.7`.
- Updated the root build script to generate the VS Code `.vsix` package alongside the npm CLI bundle.

## [1.0.4] - 2026-05-19

### Added
- Added RAG query sub-stage timing in agent benchmark output and summaries.
- Added RAG query result cache hit reporting for quantitative cold/warm analysis.

### Changed
- Optimized warm RAG retrieval by reusing local knowledge-base indexes when `syncOnQuery` is disabled.
- Reused the runtime knowledge-base instance so in-process RAG query caching can take effect.
- Updated the agent-flow benchmark so `BENCH_CLEAR_CACHE=0` preserves `.frontagent` cache for warm-cache measurements.

### Fixed
- Avoided repeatedly treating warm RAG benchmark runs as cold starts by preserving the benchmark workspace cache.

## [1.0.1] - 2026-04-30

### Added
- Added the first FrontAgent VS Code desktop extension with an Activity Bar task console.
- Added task input, current-file/selection context, browser URL context, run/cancel controls, phase and step progress, approval cards, and run log access in VS Code.
- Added SDD initialization and validation commands to the VS Code extension.
- Added shared `@frontagent/runtime-node` runtime APIs for CLI and VS Code execution.
- Added cooperative `AbortSignal` cancellation support across FrontAgent execution boundaries.

### Changed
- Updated the npm package metadata for the `1.0.1` release.
- Documented the two supported FrontAgent usage modes: CLI and VS Code extension.
- Refactored `fa run` to reuse the shared Node runtime while preserving the existing Ink terminal workflow.

## [0.1.8] - 2026-04-29

### Added
- Added `fa -v` as a short alias for CLI version output.
- Added `fa version` as an explicit version command.

## [0.1.7] - 2026-04-29

### Added
- Added a progressive exploration protocol so file-system changes are planned as observe-first workflows before writes.
- Added built-in FrontAgent identity context for query answers so identity and capability questions answer from stable agent facts.

### Changed
- Shortened the published CLI command from `frontagent` to `fa`.
- Simplified default `fa run` output to status, tool-call summary, and final answer while keeping verbose internals behind `--debug`.

### Fixed
- Fixed the ESM bundle bootstrap so `fa run` no longer crashes on packages that expect `__filename`.
- Normalized OpenAI-compatible base URLs that already include `/chat/completions`.
- Made query tasks report a clear failure when no final answer is generated instead of presenting tool-only fallback as success.

## [0.1.6] - 2026-03-22

### Added
- Added Weaviate-backed semantic vector storage for RAG while keeping BM25 local.
- Added RAG cache bundle export/import workflow for distributing prebuilt knowledge-base indexes.
- Added a retrieval-only LLM query rewrite step that rewrites user input into frontend-oriented search queries before RAG.

### Changed
- Clarified all RAG-facing terminology so remote RAG evidence is referred to as "knowledge base" instead of the current workspace repository.
- Updated English and Chinese documentation with Weaviate, query rewrite, and cache bundle usage examples.

### Fixed
- Prevented the planner from treating remote RAG hits as local workspace files during query tasks.
- Improved semantic index resilience for Weaviate-backed retrieval and related RAG execution flow.

## [0.1.5] - 2026-03-16

### Fixed
- Corrected npm publish metadata:
  - `bin.frontagent` uses `dist/index.cjs` to avoid npm auto-removal during publish.
  - `repository.url` normalized to `git+https://github.com/ceilf6/FrontAgent.git`.
- Added changelog tracking for release visibility.

## [0.1.4] - 2026-03-16

### Added
- Introduced an executor skills layer and extracted reusable execution logic into dedicated skills.
- Added planner skill registry APIs for runtime registration/introspection and custom planning extension.
- Added built-in repository-management phase injection skill for post-validation repository workflow steps.

### Changed
- Unified browser tool naming to `browser_*` in planning/execution paths.
- Added backward-compatible aliases in the CLI MCP web client for legacy browser tool names.
- Updated English and Chinese documentation with skill extension usage examples.

### Fixed
- Tightened planner snapshot typing with `ReadonlyMap` semantics to avoid accidental mutation in skills.
- Corrected `search_code` examples to use supported parameters (`filePattern`) instead of unsupported `directory`.

## [0.1.3] - 2026-03-14

### Released
- Previous stable release. See GitHub Release and tag history for details.
