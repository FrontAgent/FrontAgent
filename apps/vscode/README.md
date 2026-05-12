# FrontAgent

FrontAgent can now be used in two ways: the original `fa` CLI for terminal-first workflows, and this VS Code extension for a sidebar chat workflow.

This extension brings FrontAgent into VS Code as a Copilot-style sidebar chat. Configure your model once, attach the current file or selection, and ask FrontAgent to explain, edit, or debug your workspace without leaving the editor.

## Usage

1. Install the extension from the VS Code Marketplace.
2. Open a project folder in VS Code.
3. Run `FrontAgent: Configure` and set your OpenAI-compatible or Anthropic API key.
4. Open the FrontAgent chat view from the Activity Bar.
5. Ask a question or request an edit, optionally with the current file, selected text, or a browser URL attached.

You can still use the CLI in the same project:

```bash
fa init
fa run "Create a user login page"
```

## Features

- Chat with FrontAgent from the Activity Bar.
- Use the current file or selected text as chat context.
- Attach a browser URL as task context.
- Review phase, step, and RAG details in a collapsible run panel.
- Approve or reject sensitive tool actions inline.
- Initialize and validate `sdd.yaml`.
- Open run logs written under `.frontagent/runs`.

## Requirements

FrontAgent for VS Code is a desktop extension. It uses Node.js, local file system access, shell tooling, and browser automation capabilities from the FrontAgent runtime.

Configure a provider, model, base URL, and API key with `FrontAgent: Configure` or the sidebar configuration panel before running tasks. API keys entered there are stored in VS Code SecretStorage. You can also use `frontagent.apiKey` in Settings as a fallback when you explicitly want a settings-based key.

## Extension Settings

- `frontagent.provider`: LLM provider, `anthropic` or `openai`.
- `frontagent.model`: Model name.
- `frontagent.baseUrl`: API base URL.
- `frontagent.apiKey`: Optional API key fallback; SecretStorage is recommended.
- `frontagent.maxTokens`: Maximum output tokens.
- `frontagent.temperature`: Sampling temperature.
- `frontagent.securityMode`: Tool execution security mode.
- `frontagent.rag.enabled`: Enable the remote knowledge-base RAG flow.
- `frontagent.rag.repo`: Knowledge-base Git repository.
- `frontagent.rag.branch`: Knowledge-base branch.
- `frontagent.runLog.enabled`: Enable run logs.

Use `FrontAgent: Show Extension Logs` to inspect activation, command registration, runtime loading, and webview errors.

## Known Limits

- Web extensions are not supported.
- Only one active FrontAgent run is allowed per workspace in this first version.
- Cancel is cooperative and stops at phase/step boundaries.
