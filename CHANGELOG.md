# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [2.1.1] - 2026-06-09

### Changed

- **core/executor**: Decomposed executor tool-call handling, validation skip handling, progress enforcement, step feedback, and trace recording into focused helpers. This keeps task execution behavior intact while making MCP task invocation, progress checks, and step trace output easier to test and maintain.
- **core/agent**: Extracted agent context gathering, facts update flushing, project prescan preparation, task execution setup, and execution callback wiring out of the main FrontAgent orchestration path. This reduces the size and coupling of the core agent loop without changing the public execution contract.
- **core/context**: Split context fact serialization, facts merge helpers, filesystem fact updates, and module dependency graph updates from `ContextManager`, improving maintainability around context persistence and workspace fact refreshes.
- **core/planner**: Split planner phase helper logic into dedicated modules and expanded planner tests around phase handling.
- **mcp-filesense**: Extracted engine helper, indexing, notes, query, and schema orchestration responsibilities from the Filesense engine. Query, notes, schema, and index persistence behavior now have focused module boundaries and tests.
- **mcp-memory**: Extracted memory preload/recall helpers and persistence writer responsibilities from `MemoryStore`, keeping memory I/O behavior isolated from recall orchestration.
- **mcp-memory/rag**: Extracted semantic search orchestration from the knowledge-base implementation while preserving hybrid RAG behavior.
- **runtime-node**: Extracted runtime MCP task invocation setup from the MCP server path, clarifying schema assertions and task handler wiring.
- **vscode**: Split the webview body, script, style, and template rendering helpers into smaller units with dedicated tests while preserving the sidebar UI behavior.
- **sub-agents**: Split code-quality subagent prompt policy into a focused helper with tests.
- **tooling**: Removed the temporary GitNexus release-candidate patch and aligned the Biome schema version.

### Fixed

- **vscode/security**: Hardened VS Code webview nonce generation.
- **filesense**: Preserved relative path semantics in Filesense query results.
- **filesense**: Preserved notes schema path ownership when generating Filesense notes.
- **workflow**: Restored and hardened the local GitNexus contract gate.
- **workflow**: Resolved relative core worktree paths and guarded bootstrap against mismatched worktrees.

### Tests

- Added focused CLI command router coverage.
- Added runtime MCP contract and schema assertion coverage.
- Added hybrid RAG knowledge-base coverage.
- Added executor coverage for validation skipping, progress enforcement, step feedback, tool-call handling, and trace recording.
- Added agent coverage for context gathering, facts flushing, project prescan preparation, execution callbacks, and task execution setup.
- Added ContextManager coverage for fact serialization, facts merging, filesystem fact updates, and module dependency graph behavior.
- Added Filesense coverage for engine helpers, indexing persistence writes, notes generation, query result behavior, and schema orchestration.
- Added memory coverage for preload/recall helpers and persistence writers.
- Added VS Code webview renderer coverage for body, script, style, and template extraction.
- Cleaned Biome warnings in executor, shared utility, and LLM service tests.

### Dependencies

- Updated production dependency lockfile entries from the Dependabot production dependency group.

### Compatibility Notes

- The published CLI package and VS Code extension are now versioned as `2.1.1`.
- Node.js remains `>=20.0.0`.
- The VS Code extension still requires VS Code `^1.120.0`.

## [2.1.0] - 2026-06-08

### Added

- **core**: Added opt-in Open Memory Gateway integration for managed long-term memory. FrontAgent can now write Gateway-compatible Markdown memories, separate draft and active memory states, and recall active memories while preserving the existing `.frontagent/memory` fallback when Gateway mode is disabled or unavailable.
- **workflow**: Added OSS Harness assets for open-source maintenance, including contribution guidance, workflow documentation, GitNexus knowledge contracts, CODEOWNERS, issue templates, PR template, local git hooks, and workflow rule tests.
- **workflow**: Added local quality and contract scripts: `agent:bootstrap`, `quality:predev`, `quality:precommit`, `quality:ci`, `quality:local`, `contract:*`, and `test:workflows`.
- **dx**: Added `.env.example` and Dependabot configuration for npm and GitHub Actions dependency maintenance.

### Changed

- **core**: Extracted `PhaseRunner` from `Executor` and step callback handling from `FrontAgent`, making execution flow and callback behavior easier to test and maintain.
- **core**: Split Skill Lab behavior benchmarking, trigger benchmarking, improvement, reporting, and scaffolding into focused modules.
- **shared/core**: Introduced a structured logger and migrated core debug logging to shared logging utilities.
- **type-safety**: Tightened source type safety by enabling stricter `noExplicitAny` checks and replacing remaining loose source types with explicit interfaces.
- **dependencies**: Upgraded the development toolchain and runtime dependencies, including Biome 2.x, TypeScript 6.x, Vitest 4.x, Playwright 1.60.x, Turbo 2.9.x, AI SDK, MCP SDK, and LangChain-related packages.
- **vscode**: Raised the minimum VS Code engine requirement to `^1.120.0`.

### Fixed

- **security**: Patched high-severity dependency vulnerabilities through dependency upgrades and pnpm overrides for packages including `hono`, `path-to-regexp`, `fast-uri`, `ws`, `yaml`, and `ajv`.
- **lint**: Fixed Biome formatting and `noExplicitAny` lint failures introduced by merged test and Skill Lab changes.
- **ci**: Unified Node 20 and Node 22 matrix results under a single aggregate CI status check.

### Tests

- Added focused unit coverage for FrontAgent, answer generation, Executor, PhaseRunner, ContextManager, LLM service, planner behavior, memory store behavior, Open Memory Gateway integration, security rules, mcp-filesense engine behavior, shared logger behavior, SDD workflow rules, and OSS Harness workflow contracts.
- Added workflow rule tests for OSS Harness automation and CI aggregate workflow behavior.

### CI/CD

- Updated GitHub Actions CI to run the full `quality:ci` gate across Node 20 and Node 22, including lint, typecheck, tests, workflow tests, and build.
- Added Contract Guard for PRs targeting `develop`, enforcing GitNexus contract checks and impact-summary discipline for critical skeleton changes.
- Added Repo Guard workflow support for PR, issue, and issue-comment review paths with fork and actor safeguards.
- Upgraded GitHub Actions dependencies to `actions/checkout@v6`, `actions/setup-node@v6`, and `pnpm/action-setup@v6`.

### Documentation

- Added OSS Harness engineering workflow documentation, contributor guidance, GitNexus knowledge contract documentation, and superpowers implementation plans/specs for Repo Guard, OSS Harness, and Open Memory Gateway.
- Added Claude/GitNexus skill assets and workflow automation assets for repository-native agent workflows.

### Compatibility Notes

- The published CLI package and VS Code extension are now versioned as `2.1.0`.
- Node.js remains `>=20.0.0`.
- The VS Code extension now requires VS Code `^1.120.0`.

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
