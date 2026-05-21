/**
 * @frontagent/mcp-filesense - Agent-friendly directory indexing for FrontAgent
 *
 * Provides:
 * - Recursive directory indexing with FILES.json per directory
 * - Heuristic semantic summaries in FILES.notes.json
 * - MCP tool schemas and handlers for integration with FrontAgent's MCP server
 * - Engine API for programmatic use in planner/executor
 */

export * from './engine.js';
export {
  allFilesenseSchemas,
  type FilesenseToolResult,
  filesenseCheckSchema,
  filesenseInitSchema,
  filesenseNavigateSchema,
  filesenseQuerySchema,
  filesenseSummarizeSchema,
  filesenseSyncAndSummarizeSchema,
  filesenseSyncSchema,
  handleFilesenseTool,
} from './tools.js';
export * from './types.js';
