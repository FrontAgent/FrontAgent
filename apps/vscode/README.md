# FrontAgent

FrontAgent can now be used in two ways: the original `fa` CLI for terminal-first workflows, and this VS Code extension for a sidebar-driven desktop workflow.

This extension brings the FrontAgent task flow into VS Code so you can run AI frontend engineering tasks, review progress, approve tool actions, and open logs without leaving your workspace.

## Usage

1. Install the extension from the VS Code Marketplace.
2. Open a project folder in VS Code.
3. Run `FrontAgent: Configure` and set your OpenAI-compatible or Anthropic API key.
4. Open the FrontAgent view from the Activity Bar.
5. Enter a task, optionally attach the current file/selection or a browser URL, then run it.

You can still use the CLI in the same project:

```bash
fa init
fa run "Create a user login page"
```

## Features

- Run FrontAgent tasks from the Activity Bar.
- Use the current file or selected text as task context.
- Attach a browser URL as task context.
- Review phase and step progress as structured status.
- Approve or reject sensitive tool actions in VS Code.
- Initialize and validate `sdd.yaml`.
- Open run logs written under `.frontagent/runs`.

## Requirements

FrontAgent for VS Code is a desktop extension. It uses Node.js, local file system access, shell tooling, and browser automation capabilities from the FrontAgent runtime.

Configure an Anthropic or OpenAI-compatible API key with `FrontAgent: Configure` before running tasks.

## Extension Settings

- `frontagent.provider`: LLM provider, `anthropic` or `openai`.
- `frontagent.model`: Optional model override.
- `frontagent.baseUrl`: Optional API base URL.
- `frontagent.maxTokens`: Maximum output tokens.
- `frontagent.temperature`: Sampling temperature.
- `frontagent.securityMode`: Tool execution security mode.
- `frontagent.rag.enabled`: Enable the remote knowledge-base RAG flow.
- `frontagent.rag.repo`: Knowledge-base Git repository.
- `frontagent.rag.branch`: Knowledge-base branch.
- `frontagent.runLog.enabled`: Enable run logs.

## Known Limits

- Web extensions are not supported.
- Only one active FrontAgent run is allowed per workspace in this first version.
- Cancel is cooperative and stops at phase/step boundaries.
