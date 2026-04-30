import type { MCPClient } from '@frontagent/core';
import {
  readFile,
  applyPatch,
  createFile,
  searchCode,
  listDirectory,
  getAST,
  SnapshotManager,
} from '@frontagent/mcp-file';
import { ragQuery, type KnowledgeBaseConfig } from '@frontagent/mcp-memory';
import { BrowserManager, createBrowserManager } from '@frontagent/mcp-web';

export class FileMCPClient implements MCPClient {
  private readonly snapshotManager: SnapshotManager;

  constructor(private readonly projectRoot: string) {
    this.snapshotManager = new SnapshotManager(projectRoot);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'read_file':
        return readFile(args as any, this.projectRoot);
      case 'apply_patch':
        return applyPatch(args as any, this.projectRoot, this.snapshotManager);
      case 'create_file':
        return createFile(args as any, this.projectRoot, this.snapshotManager);
      case 'search_code':
        return searchCode(args as any, this.projectRoot);
      case 'list_directory':
        return listDirectory(args as any, this.projectRoot);
      case 'get_ast':
        return getAST(args as any, this.projectRoot);
      case 'rollback':
        return this.snapshotManager.rollback((args as any).snapshotId);
      case 'get_snapshots': {
        const filePath = (args as any).filePath;
        if (filePath) {
          return { snapshots: this.snapshotManager.getFileSnapshots(filePath) };
        }
        return { snapshots: [] };
      }
      default:
        throw new Error(`Unknown file tool: ${name}`);
    }
  }

  async listTools() {
    return [
      { name: 'read_file', description: '读取文件内容' },
      { name: 'apply_patch', description: '应用代码补丁' },
      { name: 'create_file', description: '创建新文件' },
      { name: 'search_code', description: '搜索代码' },
      { name: 'list_directory', description: '列出目录' },
      { name: 'get_ast', description: '获取 AST 分析' },
      { name: 'rollback', description: '回滚修改' },
      { name: 'get_snapshots', description: '获取快照列表' },
    ];
  }
}

export class WebMCPClient implements MCPClient {
  private readonly browserManager: BrowserManager;

  constructor() {
    this.browserManager = createBrowserManager({
      headless: true,
      timeout: 30000,
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'browser_navigate':
      case 'navigate':
        return this.browserManager.navigate((args as { url: string }).url);
      case 'get_page_structure':
        return this.browserManager.getPageStructure((args as { selector?: string }).selector);
      case 'browser_click':
      case 'click':
        return this.browserManager.click((args as { selector: string }).selector);
      case 'browser_type':
      case 'type': {
        const { selector, text } = args as { selector: string; text: string };
        return this.browserManager.type(selector, text);
      }
      case 'browser_screenshot':
      case 'screenshot': {
        const { fullPage, selector } = args as { fullPage?: boolean; selector?: string };
        return this.browserManager.screenshot({ fullPage, selector });
      }
      case 'get_accessibility_tree':
        return this.browserManager.getAccessibilityTree();
      case 'get_interactive_elements':
        return this.browserManager.getInteractiveElements(
          (args as { filter?: 'all' | 'buttons' | 'inputs' | 'links' }).filter,
        );
      case 'browser_scroll':
      case 'scroll': {
        const { direction, amount } = args as {
          direction: 'up' | 'down' | 'left' | 'right';
          amount?: number;
        };
        return this.browserManager.scroll(direction, amount);
      }
      case 'browser_wait_for_selector':
      case 'wait_for_selector': {
        const { selector, timeout } = args as { selector: string; timeout?: number };
        return this.browserManager.waitForSelector(selector, timeout);
      }
      default:
        throw new Error(`Unknown web tool: ${name}`);
    }
  }

  async listTools() {
    return [
      { name: 'browser_navigate', description: '导航到指定 URL' },
      { name: 'get_page_structure', description: '获取页面 DOM 结构' },
      { name: 'get_accessibility_tree', description: '获取页面无障碍树' },
      { name: 'get_interactive_elements', description: '获取可交互元素列表' },
      { name: 'browser_click', description: '点击页面元素' },
      { name: 'browser_type', description: '在输入框中输入文本' },
      { name: 'browser_scroll', description: '滚动页面' },
      { name: 'browser_screenshot', description: '截取页面截图' },
      { name: 'browser_wait_for_selector', description: '等待元素出现' },
    ];
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }
}

export class MemoryMCPClient implements MCPClient {
  constructor(private readonly knowledgeBaseConfig: KnowledgeBaseConfig) {}

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'rag_query':
        return ragQuery(args as any, this.knowledgeBaseConfig);
      default:
        throw new Error(`Unknown memory tool: ${name}`);
    }
  }

  async listTools() {
    return [
      { name: 'rag_query', description: '查询远程知识库索引（BM25 + embedding 混合检索）' },
    ];
  }
}
