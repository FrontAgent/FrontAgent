# Changelog

All notable changes to this project will be documented in this file.

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
