# Changelog

## 2.1.1

- Aligned the extension package with the FrontAgent `2.1.1` release.
- Split the sidebar webview HTML implementation into focused body, script, style, and template renderers.
- Added focused webview renderer tests to preserve sidebar behavior while making future UI changes easier to review.
- Kept the minimum VS Code engine requirement at `^1.120.0`.
- Build output now packages the `frontagent-2.1.1.vsix` artifact through the root `pnpm build` script.

## 2.1.0

- Added release alignment with the FrontAgent `2.1.0` CLI and runtime packages.
- Added the Open Memory Gateway-backed runtime capabilities exposed through the shared `@frontagent/runtime-node` integration.
- Updated the extension package for the OSS Harness release train and current runtime dependency set.
- Raised the minimum VS Code engine requirement to `^1.120.0`.
- Build output now packages the `frontagent-2.1.0.vsix` artifact through the root `pnpm build` script.

## 2.0.0

- Shipped the major FrontAgent 2.0 architecture refactor with focused runtime, agent, executor, LLM, context, memory, and VS Code modules.
- Kept the VS Code extension version aligned with the root `frontagent` package.

## 1.0.4

- Deferred Playwright loading until browser tools are actually used, so the FrontAgent runtime can load in the VS Code extension without a local Playwright install.

## 1.0.3

- Added FrontAgent extension logs through a dedicated output channel.
- Deferred runtime loading until a command or chat run needs it, so commands can register even if the runtime fails later.
- Added `frontagent.apiKey` as a settings fallback while keeping SecretStorage as the recommended storage path.

## 1.0.2

- Fixed extension activation by bundling the extension host entry as CommonJS.
- Fixed the Activity Bar icon path with a dedicated monochrome SVG icon.
- Reworked the sidebar into a chat-first FrontAgent experience.
- Changed LLM settings defaults to stay empty and rely on settings, secrets, or environment variables.

## 1.0.1

- Updated Marketplace README to describe the VS Code extension workflow.
- Documented the two supported FrontAgent usage modes: CLI and VS Code.

## 0.1.0

- Initial VS Code sidebar task console for FrontAgent.
- Added run, cancel, approval, SDD init/validate, configuration, and run log commands.
