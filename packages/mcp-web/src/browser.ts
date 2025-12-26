/**
 * 浏览器管理器
 * 封装 Playwright 提供浏览器操作能力
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import type { DOMNode, AXNode, InteractiveElement, BoundingBox } from '@frontagent/shared';

export interface BrowserConfig {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
}

/**
 * 浏览器管理器类
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Required<BrowserConfig>;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      slowMo: config.slowMo ?? 0,
      timeout: config.timeout ?? 30000
    };
  }

  /**
   * 启动浏览器
   */
  async launch(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * 导航到指定 URL
   */
  async navigate(url: string): Promise<{ success: boolean; title?: string; error?: string }> {
    await this.ensurePage();

    try {
      await this.page!.goto(url, { waitUntil: 'domcontentloaded' });
      const title = await this.page!.title();
      return { success: true, title };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取页面结构
   */
  async getPageStructure(selector?: string): Promise<{
    title: string;
    url: string;
    viewport: { width: number; height: number };
    domTree: DOMNode[];
  }> {
    await this.ensurePage();

    const page = this.page!;
    const title = await page.title();
    const url = page.url();
    const viewport = page.viewportSize() ?? { width: 1920, height: 1080 };

    // 获取 DOM 树
    const domTree = await page.evaluate((sel) => {
      function parseNode(node: Element, depth: number = 0): any {
        if (depth > 10) return null; // 限制深度

        const children: any[] = [];
        for (const child of node.children) {
          const parsed = parseNode(child, depth + 1);
          if (parsed) {
            children.push(parsed);
          }
        }

        // 获取文本内容（不包含子元素文本）
        let text = '';
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent?.trim() ?? '';
          }
        }

        // 获取属性
        const attributes: Record<string, string> = {};
        for (const attr of node.attributes) {
          if (!['style', 'class', 'id'].includes(attr.name)) {
            attributes[attr.name] = attr.value;
          }
        }

        const rect = node.getBoundingClientRect();

        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || undefined,
          className: node.className || undefined,
          text: text || undefined,
          attributes,
          children,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      }

      const root = sel ? document.querySelector(sel) : document.body;
      if (!root) return [];

      return [parseNode(root as Element)];
    }, selector);

    return { title, url, viewport, domTree };
  }

  /**
   * 获取 Accessibility Tree
   */
  async getAccessibilityTree(): Promise<AXNode[]> {
    await this.ensurePage();

    const snapshot = await this.page!.accessibility.snapshot();
    if (!snapshot) {
      return [];
    }

    function transformNode(node: any): AXNode {
      return {
        role: node.role,
        name: node.name,
        value: node.value,
        description: node.description,
        focused: node.focused,
        disabled: node.disabled,
        children: node.children?.map(transformNode)
      };
    }

    return [transformNode(snapshot)];
  }

  /**
   * 获取可交互元素
   */
  async getInteractiveElements(filter?: 'all' | 'buttons' | 'inputs' | 'links'): Promise<InteractiveElement[]> {
    await this.ensurePage();

    const selectorMap: Record<string, string> = {
      all: 'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex]',
      buttons: 'button, [role="button"], input[type="submit"], input[type="button"]',
      inputs: 'input, textarea, select',
      links: 'a, [role="link"]'
    };

    const selector = selectorMap[filter ?? 'all'];

    return await this.page!.evaluate((sel) => {
      const elements = document.querySelectorAll(sel);
      const result: any[] = [];

      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const tagName = el.tagName.toLowerCase();
        let type: string = 'button';
        
        if (tagName === 'a') type = 'link';
        else if (tagName === 'input') {
          const inputType = (el as HTMLInputElement).type;
          if (inputType === 'checkbox') type = 'checkbox';
          else if (inputType === 'radio') type = 'radio';
          else type = 'input';
        }
        else if (tagName === 'select') type = 'select';
        else if (tagName === 'textarea') type = 'textarea';

        result.push({
          selector: `[data-fa-id="${index}"]`,
          type,
          text: el.textContent?.trim().slice(0, 100),
          ariaLabel: el.getAttribute('aria-label'),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          enabled: !(el as HTMLButtonElement).disabled
        });

        // 添加临时 ID 用于选择
        el.setAttribute('data-fa-id', String(index));
      });

      return result;
    }, selector);
  }

  /**
   * 点击元素
   */
  async click(selector: string): Promise<{ success: boolean; error?: string }> {
    await this.ensurePage();

    try {
      await this.page!.click(selector, { timeout: 5000 });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 输入文本
   */
  async type(selector: string, text: string): Promise<{ success: boolean; error?: string }> {
    await this.ensurePage();

    try {
      await this.page!.fill(selector, text);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 滚动页面
   */
  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<{ success: boolean }> {
    await this.ensurePage();

    const scrollAmount = amount ?? 500;
    const scrollMap = {
      up: { x: 0, y: -scrollAmount },
      down: { x: 0, y: scrollAmount },
      left: { x: -scrollAmount, y: 0 },
      right: { x: scrollAmount, y: 0 }
    };

    const { x, y } = scrollMap[direction];
    await this.page!.evaluate(({ x, y }) => {
      window.scrollBy(x, y);
    }, { x, y });

    return { success: true };
  }

  /**
   * 截图
   */
  async screenshot(options?: {
    fullPage?: boolean;
    selector?: string;
  }): Promise<{ success: boolean; base64?: string; error?: string }> {
    await this.ensurePage();

    try {
      let buffer: Buffer;

      if (options?.selector) {
        const element = await this.page!.$(options.selector);
        if (!element) {
          return { success: false, error: `Element not found: ${options.selector}` };
        }
        buffer = await element.screenshot();
      } else {
        buffer = await this.page!.screenshot({ fullPage: options?.fullPage });
      }

      return {
        success: true,
        base64: buffer.toString('base64')
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 等待元素出现
   */
  async waitForSelector(selector: string, timeout?: number): Promise<{ success: boolean; error?: string }> {
    await this.ensurePage();

    try {
      await this.page!.waitForSelector(selector, { timeout: timeout ?? this.config.timeout });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 执行 JavaScript
   */
  async evaluate<T>(script: string): Promise<{ success: boolean; result?: T; error?: string }> {
    await this.ensurePage();

    try {
      const result = await this.page!.evaluate(script) as T;
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取当前页面
   */
  getPage(): Page | null {
    return this.page;
  }

  /**
   * 确保页面已创建
   */
  private async ensurePage(): Promise<void> {
    if (!this.page) {
      await this.launch();
    }
  }
}

/**
 * 创建浏览器管理器实例
 */
export function createBrowserManager(config?: BrowserConfig): BrowserManager {
  return new BrowserManager(config);
}

