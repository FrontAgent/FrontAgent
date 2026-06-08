/**
 * @frontagent/mcp-file - MCP File Adapter
 */

export { type Snapshot, SnapshotManager } from './snapshot.js';
export { type ApplyPatchParams, applyPatch, applyPatchSchema } from './tools/apply-patch.js';
export {
  type CreateFileParams,
  type CreateFileResult,
  createFile,
  createFileSchema,
} from './tools/create-file.js';
export {
  type ASTResult,
  type ComponentInfo,
  type FunctionInfo,
  type GetASTParams,
  getAST,
  getASTSchema,
  type ImportInfo,
} from './tools/get-ast.js';
export {
  type FileInfo,
  type ListDirectoryParams,
  type ListDirectoryResult,
  listDirectory,
  listDirectorySchema,
} from './tools/list-directory.js';
export {
  type ReadFileParams,
  type ReadFileResult,
  readFile,
  readFileSchema,
} from './tools/read-file.js';
export {
  type SearchCodeParams,
  type SearchCodeResult,
  type SearchMatch,
  searchCode,
  searchCodeSchema,
} from './tools/search-code.js';
