import { describe, expect, it } from 'vitest';
import { WebMCPClient } from './mcp-clients.js';

describe('WebMCPClient web_fetch wiring', () => {
  it('lists web_fetch as an available tool', async () => {
    // Construction is cheap: the playwright browser is launched lazily, not in
    // the constructor, so this stays hermetic (no browser, no network).
    const client = new WebMCPClient();
    const tools = await client.listTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toContain('web_fetch');
    // Sanity: the existing browser tools are still present alongside it.
    expect(names).toContain('browser_navigate');
  });

  it('throws for an unknown web tool', async () => {
    const client = new WebMCPClient();
    await expect(client.callTool('definitely_not_a_tool', {})).rejects.toThrow(/Unknown web tool/);
  });
});
