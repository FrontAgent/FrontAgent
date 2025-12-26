#!/usr/bin/env node
/**
 * MCP Web Server
 * 提供浏览器感知与交互的 MCP 工具接口
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BrowserManager } from './browser.js';

// 创建浏览器管理器
const browserManager = new BrowserManager({
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO ?? '0', 10)
});

// 创建 MCP Server
const server = new Server(
  {
    name: 'frontagent-web-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 工具定义
const tools = [
  {
    name: 'navigate',
    description: '导航到指定 URL',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: '要导航到的 URL'
        }
      },
      required: ['url']
    }
  },
  {
    name: 'get_page_structure',
    description: '获取当前页面的结构化 DOM 信息',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: '可选，限定范围的 CSS 选择器'
        }
      },
      required: []
    }
  },
  {
    name: 'get_accessibility_tree',
    description: '获取当前页面的 Accessibility Tree，用于语义化理解页面结构',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'get_interactive_elements',
    description: '获取页面上所有可交互元素',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'buttons', 'inputs', 'links'],
          description: '过滤类型，默认 all'
        }
      },
      required: []
    }
  },
  {
    name: 'click',
    description: '点击页面上的元素',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS 选择器'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'type',
    description: '在输入框中输入文本',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS 选择器'
        },
        text: {
          type: 'string',
          description: '要输入的文本'
        }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'scroll',
    description: '滚动页面',
    inputSchema: {
      type: 'object' as const,
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: '滚动方向'
        },
        amount: {
          type: 'number',
          description: '滚动距离（像素），默认 500'
        }
      },
      required: ['direction']
    }
  },
  {
    name: 'screenshot',
    description: '获取页面截图',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fullPage: {
          type: 'boolean',
          description: '是否截取整个页面，默认 false'
        },
        selector: {
          type: 'string',
          description: '可选，只截取特定元素'
        }
      },
      required: []
    }
  },
  {
    name: 'wait_for_selector',
    description: '等待元素出现',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS 选择器'
        },
        timeout: {
          type: 'number',
          description: '超时时间（毫秒），默认 30000'
        }
      },
      required: ['selector']
    }
  },
  {
    name: 'evaluate',
    description: '在页面中执行 JavaScript 代码',
    inputSchema: {
      type: 'object' as const,
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript 代码'
        }
      },
      required: ['script']
    }
  },
  {
    name: 'close_browser',
    description: '关闭浏览器',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  }
];

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'navigate': {
        const { url } = args as { url: string };
        const result = await browserManager.navigate(url);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_page_structure': {
        const { selector } = args as { selector?: string };
        const result = await browserManager.getPageStructure(selector);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_accessibility_tree': {
        const result = await browserManager.getAccessibilityTree();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'get_interactive_elements': {
        const { filter } = args as { filter?: 'all' | 'buttons' | 'inputs' | 'links' };
        const result = await browserManager.getInteractiveElements(filter);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'click': {
        const { selector } = args as { selector: string };
        const result = await browserManager.click(selector);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'type': {
        const { selector, text } = args as { selector: string; text: string };
        const result = await browserManager.type(selector, text);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'scroll': {
        const { direction, amount } = args as { direction: 'up' | 'down' | 'left' | 'right'; amount?: number };
        const result = await browserManager.scroll(direction, amount);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'screenshot': {
        const { fullPage, selector } = args as { fullPage?: boolean; selector?: string };
        const result = await browserManager.screenshot({ fullPage, selector });
        if (result.success && result.base64) {
          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true, message: 'Screenshot captured' }, null, 2) },
              { type: 'image', data: result.base64, mimeType: 'image/png' }
            ],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'wait_for_selector': {
        const { selector, timeout } = args as { selector: string; timeout?: number };
        const result = await browserManager.waitForSelector(selector, timeout);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'evaluate': {
        const { script } = args as { script: string };
        const result = await browserManager.evaluate(script);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'close_browser': {
        await browserManager.close();
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Web Server started');
}

// 清理
process.on('SIGINT', async () => {
  await browserManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserManager.close();
  process.exit(0);
});

main().catch(console.error);

