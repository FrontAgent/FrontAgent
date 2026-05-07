# Changelog

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
