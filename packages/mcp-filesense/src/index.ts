/**
 * @frontagent/mcp-filesense - Agent-friendly directory indexing for FrontAgent
 *
 * Provides:
 * - Recursive directory indexing with FILES.json per directory
 * - Heuristic semantic summaries in FILES.notes.json
 * - MCP tool schemas and handlers for integration with FrontAgent's MCP server
 * - Engine API for programmatic use in planner/executor
 */

export * from './types.js';
export * from './engine.js';
export {
  allFilesenseSchemas,
  filesenseInitSchema,
  filesenseSyncSchema,
  filesenseSummarizeSchema,
  filesenseQuerySchema,
  filesenseCheckSchema,
  filesenseSyncAndSummarizeSchema,
  filesenseNavigateSchema,
  handleFilesenseTool,
  type FilesenseToolResult,
} from './tools.js';
