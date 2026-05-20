# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2.0.0] - 2026-05-20

### Architecture Refactoring

This release represents a major architectural overhaul. All large monolithic source files have been decomposed into focused, single-responsibility modules while preserving the public API surface.

- **core**: Split `agent.ts` (1200+ lines) into `agent/agent.ts`, `agent/helpers.ts`, `agent/phase-checks.ts`, `agent/dev-server-detection.ts`, `agent/answer-generation.ts`, `agent/memory-lifecycle.ts`, `agent/rag-retrieval.ts`.
- **core**: Split `llm.ts` into `llm/llm-service.ts`, `llm/factory.ts`, `llm/object-repair.ts`, `llm/prompts.ts`, `llm/code-generation.ts`, `llm/plan-generation.ts`, `llm/schemas.ts`.
- **core**: Split `executor.ts` into `executor/executor.ts`, `executor/phase-ordering.ts`, `executor/trace.ts`, `executor/types.ts`.
- **core**: Split `context.ts` into `context/context-manager.ts`, `context/helpers.ts`.
- **core**: Split `skill-lab/index.ts` into `skill-lab/skill-lab.ts`, `skill-lab/utils.ts`, `skill-lab/schemas.ts`, `skill-lab/types.ts`.
- **mcp-memory**: Split `rag.ts` into `rag/bm25.ts`, `rag/chunking.ts`, `rag/embedding.ts`, `rag/knowledge-base.ts`, `rag/providers.ts`, `rag/repository.ts`, `rag/reranker.ts`, `rag/semantic.ts`, `rag/utils.ts`.
- **shared**: Split `index.ts` into `types/`, `security/`, and `utils.ts` modules.
- **vscode**: Split `extension.ts` into focused activation, command, and webview modules.

### Testing

Test coverage increased from near-zero to **565 tests** across the monorepo, covering all critical pure-logic paths.

- **core** (220 tests): context/helpers, agent/helpers, agent/phase-checks, agent/dev-server-detection, llm/object-repair, llm/code-generation, llm/plan-generation, skill-lab/utils, executor/phase-ordering, executor/trace, filesense/trigger-policy, context-filesense, planner, security, llm.
- **sdd** (144 tests): SDDValidator, FileArtifactStore, plan-quality, consistency-analyzer, ChecklistValidator, VerificationCollector, parser.
- **mcp-memory** (96 tests): BM25, chunking, normalize-config, repository, utils, rag-openviking.
- **hallucination-guard** (45 tests): file-existence, import-validity, syntax-validity.
- **mcp-file** (46 tests): path-safety (44 tests), snapshot cleanup.
- **runtime-node** (38 tests): config, run-logger redaction, sampling-llm.
- **mcp-web** (11 tests): BrowserManager.
- **shared** (comprehensive): utils, shell-analysis.

### Performance

- **mcp-file**: Lazy-load `ts-morph` in `get_ast` tool — reduces cold-start time by ~400ms for non-AST operations.
- **mcp-memory**: Converted synchronous file I/O to async in RAG modules — eliminates event-loop blocking during knowledge-base indexing.
- **build**: Externalized `ts-morph` from CLI bundle — reduces bundle size by ~2MB.

### Code Quality

- **Biome**: Added Biome as the project-wide linter and formatter, replacing ad-hoc ESLint configs. Enforces consistent style, import ordering, and catches common bugs.
- **Type safety**: Eliminated all `as any` type assertions across CLI, shared, and core packages. Replaced with proper typed interfaces (`AnthropicProviderSettings`, strict `TechStackConfig`, etc.).
- **Error handling**: Improved bare `catch` blocks across the codebase with proper error typing and logging.
- **shared**: Extracted `escapeRegex` utility and deduplicated regex escaping logic across packages.

### Bug Fixes

- **mcp-file**: Fixed `SnapshotManager.cleanup()` — previously removed snapshots from memory but left orphaned `.json` files on disk. Now properly deletes persisted snapshot files.
- **sdd**: Fixed validator tests to use correct `ActionType` values (`write_file`, `create_file`) instead of non-existent `modify_file`.
- **ci**: Fixed internal registry URLs in lockfile for public CI environments.
- **ci**: Removed duplicate pnpm version specification in GitHub Actions setup.

### CI/CD

- Added GitHub Actions workflow for automated lint, typecheck, and test on every push/PR.
- Decoupled test task from self-build in turbo pipeline for faster CI feedback.

### Breaking Changes

- Internal module paths have changed due to the architecture refactoring. If you import from internal (non-index) paths, update your imports. The public API exported from each package's `index.ts` remains unchanged.
- Minimum Node.js version is now 18+ (required by Biome and modern ESM features).

## [1.0.9] - 2026-05-20

### Fixed
- **mcp-shell**: Enforced the `timeout` parameter that was previously accepted but never used, preventing runaway commands from hanging indefinitely (default 60s with SIGTERM/SIGKILL escalation).
- **mcp-shell**: Added a 10MB output size cap to prevent OOM when commands produce excessive stdout/stderr.
- **shared**: Fixed `matchGlob` to escape regex metacharacters (`.`, `(`, `)`, `[`, `]`, `+`, `{`, `}`) before glob-to-regex conversion. Previously `src/utils.ts` would incorrectly match `src/utilsXts`.
- **shared**: Fixed `deepMerge` to skip `undefined` source values instead of overwriting existing target values. Explicit `null` still overwrites as intended.
- **mcp-file**: Fixed `isRegularFile` and `isDirectory` to return `false` for non-existent paths instead of throwing `ENOENT`.

### Changed
- **shared**: Extracted `DEFAULT_LLM_TEMPERATURE` (0.2) and `DEFAULT_LLM_MAX_TOKENS` (4096) as shared constants. Previously CLI used 0.2 while runtime-node used 0.7, causing inconsistent model behavior.

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
