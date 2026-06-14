/**
 * @frontagent/mcp-web-fetch - Agent-friendly URL fetching for FrontAgent
 *
 * Provides:
 * - SSRF-safe URL validation and DNS resolution checks
 * - HTML-to-text conversion for readable page content
 * - A fetch engine with per-hop redirect re-validation, timeouts, and byte limits
 * - MCP tool schemas and handlers for integration with FrontAgent's MCP server
 */

export * from './engine.js';
export {
  allWebFetchSchemas,
  handleWebFetchTool,
  type WebFetchToolResult,
  webFetchSchema,
} from './tools.js';
export { VERSION } from './types.js';
