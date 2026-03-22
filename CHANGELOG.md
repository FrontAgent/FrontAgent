# Changelog

All notable changes to this project will be documented in this file.

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
