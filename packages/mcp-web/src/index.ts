/**
 * @frontagent/mcp-web - MCP Web Adapter
 */

export { type BrowserConfig, BrowserManager, createBrowserManager } from './browser.js';
export {
  checkUrlSafety,
  defaultUrlSafetyOptions,
  type UrlSafetyOptions,
  type UrlSafetyResult,
} from './url-safety.js';
