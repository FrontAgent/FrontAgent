import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserManager, createBrowserManager } from './browser.js';

type Internals = { browser: unknown; context: unknown; page: unknown };
function internals(m: BrowserManager): Internals {
  return m as unknown as Internals;
}

function createMockPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue('Test Page'),
    url: vi.fn().mockReturnValue('http://localhost:3000'),
    viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    evaluate: vi.fn().mockResolvedValue([]),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    setDefaultTimeout: vi.fn(),
    accessibility: { snapshot: vi.fn().mockResolvedValue(null) },
  };
}

function createMockBrowser(mockPage: ReturnType<typeof createMockPage>) {
  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
  };
  return {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe('BrowserManager', () => {
  describe('constructor and config defaults', () => {
    it('uses default config values', () => {
      const manager = new BrowserManager();
      expect(manager).toBeInstanceOf(BrowserManager);
      expect(manager.getPage()).toBeNull();
    });

    it('accepts custom config', () => {
      const manager = new BrowserManager({ headless: false, slowMo: 100, timeout: 5000 });
      expect(manager).toBeInstanceOf(BrowserManager);
    });
  });

  describe('createBrowserManager factory', () => {
    it('returns a BrowserManager instance', () => {
      const manager = createBrowserManager({ headless: true });
      expect(manager).toBeInstanceOf(BrowserManager);
    });
  });
  describe('with mocked Playwright', () => {
    let manager: BrowserManager;
    let mockPage: ReturnType<typeof createMockPage>;

    beforeEach(async () => {
      mockPage = createMockPage();
      const mockBrowser = createMockBrowser(mockPage);

      vi.doMock('playwright', () => ({
        chromium: {
          launch: vi.fn().mockResolvedValue(mockBrowser),
        },
      }));

      const mod = await import('./browser.js');
      manager = new mod.BrowserManager();

      // Force launch to inject mocks
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      const context = await (
        browser as unknown as { newContext: () => Promise<unknown> }
      ).newContext();
      const page = await (context as unknown as { newPage: () => Promise<unknown> }).newPage();
      // Inject via private fields
      internals(manager).browser = browser;
      internals(manager).context = context;
      internals(manager).page = page;
    });

    afterEach(async () => {
      vi.doUnmock('playwright');
      vi.resetModules();
    });

    describe('navigate', () => {
      it('returns success with title on successful navigation', async () => {
        const result = await manager.navigate('http://localhost:3000');
        expect(result).toEqual({ success: true, title: 'Test Page' });
        expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000', {
          waitUntil: 'domcontentloaded',
        });
      });

      it('returns error on navigation failure', async () => {
        mockPage.goto.mockRejectedValueOnce(new Error('net::ERR_CONNECTION_REFUSED'));
        const result = await manager.navigate('http://localhost:9999');
        expect(result.success).toBe(false);
        expect(result.error).toContain('ERR_CONNECTION_REFUSED');
      });

      it('blocks SSRF to cloud metadata without calling goto', async () => {
        const result = await manager.navigate('http://169.254.169.254/latest/meta-data/');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Access denied/i);
        expect(mockPage.goto).not.toHaveBeenCalled();
      });

      it('blocks file: scheme without calling goto', async () => {
        const result = await manager.navigate('file:///etc/passwd');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Access denied/i);
        expect(mockPage.goto).not.toHaveBeenCalled();
      });
    });

    describe('click', () => {
      it('returns success on valid click', async () => {
        const result = await manager.click('#btn');
        expect(result).toEqual({ success: true });
        expect(mockPage.click).toHaveBeenCalledWith('#btn', { timeout: 5000 });
      });

      it('returns error when element not found', async () => {
        mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
        const result = await manager.click('.missing');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Element not found');
      });
    });

    describe('type', () => {
      it('fills input with text', async () => {
        const result = await manager.type('#input', 'hello');
        expect(result).toEqual({ success: true });
        expect(mockPage.fill).toHaveBeenCalledWith('#input', 'hello');
      });

      it('returns error on failure', async () => {
        mockPage.fill.mockRejectedValueOnce(new Error('Not an input'));
        const result = await manager.type('#div', 'text');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Not an input');
      });
    });

    describe('scroll', () => {
      it('scrolls down by default amount', async () => {
        const result = await manager.scroll('down');
        expect(result).toEqual({ success: true });
        expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), { x: 0, y: 500 });
      });

      it('scrolls up with custom amount', async () => {
        const result = await manager.scroll('up', 200);
        expect(result).toEqual({ success: true });
        expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), { x: 0, y: -200 });
      });

      it('scrolls left', async () => {
        await manager.scroll('left', 300);
        expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), { x: -300, y: 0 });
      });

      it('scrolls right', async () => {
        await manager.scroll('right', 100);
        expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function), { x: 100, y: 0 });
      });
    });

    describe('screenshot', () => {
      it('takes full page screenshot', async () => {
        const result = await manager.screenshot({ fullPage: true });
        expect(result.success).toBe(true);
        expect(result.base64).toBeDefined();
        expect(mockPage.screenshot).toHaveBeenCalledWith({ fullPage: true });
      });

      it('returns error when element selector not found', async () => {
        mockPage.$.mockResolvedValueOnce(null);
        const result = await manager.screenshot({ selector: '.missing' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('Element not found: .missing');
      });

      it('takes element screenshot when found', async () => {
        const mockElement = { screenshot: vi.fn().mockResolvedValue(Buffer.from('element-png')) };
        mockPage.$.mockResolvedValueOnce(mockElement);
        const result = await manager.screenshot({ selector: '#hero' });
        expect(result.success).toBe(true);
        expect(result.base64).toBe(Buffer.from('element-png').toString('base64'));
      });
    });

    describe('waitForSelector', () => {
      it('returns success when element appears', async () => {
        const result = await manager.waitForSelector('.loaded');
        expect(result).toEqual({ success: true });
        expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loaded', { timeout: 30000 });
      });

      it('uses custom timeout', async () => {
        await manager.waitForSelector('.slow', 5000);
        expect(mockPage.waitForSelector).toHaveBeenCalledWith('.slow', { timeout: 5000 });
      });

      it('returns error on timeout', async () => {
        mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout 5000ms exceeded'));
        const result = await manager.waitForSelector('.never', 5000);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Timeout');
      });
    });

    describe('evaluate', () => {
      it('returns evaluated result', async () => {
        mockPage.evaluate.mockResolvedValueOnce(42);
        const result = await manager.evaluate('1 + 41');
        expect(result).toEqual({ success: true, result: 42 });
      });

      it('returns error on script failure', async () => {
        mockPage.evaluate.mockRejectedValueOnce(new Error('ReferenceError: x is not defined'));
        const result = await manager.evaluate('x.y.z');
        expect(result.success).toBe(false);
        expect(result.error).toContain('ReferenceError');
      });
    });

    describe('getAccessibilityTree', () => {
      it('returns empty array when snapshot is null', async () => {
        const result = await manager.getAccessibilityTree();
        expect(result).toEqual([]);
      });

      it('transforms snapshot nodes', async () => {
        internals(manager).page = {
          ...mockPage,
          accessibility: {
            snapshot: vi.fn().mockResolvedValue({
              role: 'WebArea',
              name: 'Test',
              children: [{ role: 'button', name: 'Click me' }],
            }),
          },
        };
        const result = await manager.getAccessibilityTree();
        expect(result).toHaveLength(1);
        expect(result[0].role).toBe('WebArea');
        expect(result[0].children?.[0].role).toBe('button');
        expect(result[0].children?.[0].name).toBe('Click me');
      });
    });

    describe('close', () => {
      it('closes browser and nullifies references', async () => {
        const mockBrowser = internals(manager).browser as {
          close: ReturnType<typeof vi.fn>;
        };
        await manager.close();
        expect(mockBrowser.close).toHaveBeenCalled();
        expect(manager.getPage()).toBeNull();
      });

      it('is idempotent when already closed', async () => {
        internals(manager).browser = null;
        internals(manager).page = null;
        await manager.close();
        expect(manager.getPage()).toBeNull();
      });
    });

    describe('getPageStructure', () => {
      it('returns page metadata and DOM tree', async () => {
        mockPage.evaluate.mockResolvedValueOnce([{ tag: 'body', children: [] }]);
        const result = await manager.getPageStructure();
        expect(result.title).toBe('Test Page');
        expect(result.url).toBe('http://localhost:3000');
        expect(result.viewport).toEqual({ width: 1920, height: 1080 });
        expect(result.domTree).toEqual([{ tag: 'body', children: [] }]);
      });
    });
  });

  describe('loadPlaywright error', () => {
    it('throws descriptive error when playwright is not available', async () => {
      vi.doMock('playwright', () => {
        throw new Error('Cannot find module');
      });

      const { BrowserManager: FreshManager } = await import('./browser.js');
      const manager = new FreshManager();

      await expect(manager.navigate('http://localhost')).rejects.toThrow('Playwright is required');

      vi.doUnmock('playwright');
      vi.resetModules();
    });
  });
});
