import { describe, expect, it } from 'vitest';
import type { DevServerDetectionDeps } from './dev-server-detection.js';
import { detectDevServerPort } from './dev-server-detection.js';

const noopDeps: DevServerDetectionDeps = {
  debugLog: () => {},
  debugWarn: () => {},
};

describe('detectDevServerPort', () => {
  describe('vite.config detection', () => {
    it('detects port from vite.config.ts', () => {
      const files = new Map([['vite.config.ts', 'export default { server: { port: 4000 } }']]);
      expect(detectDevServerPort(noopDeps, files)).toBe(4000);
    });

    it('detects port from vite.config.js', () => {
      const files = new Map([['vite.config.js', 'module.exports = { server: { port: 8080 } }']]);
      expect(detectDevServerPort(noopDeps, files)).toBe(8080);
    });

    it('detects port from nested path containing vite.config', () => {
      const files = new Map([
        ['apps/web/vite.config.ts', 'defineConfig({ server: { port: 3001 } })'],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(3001);
    });
  });

  describe('package.json script detection', () => {
    it('detects --port flag in dev script', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ scripts: { dev: 'vite --port 4200' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(4200);
    });

    it('detects -p flag in start script', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ scripts: { start: 'serve -p 9000' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(9000);
    });

    it('prefers dev script over start script', () => {
      const files = new Map([
        [
          'package.json',
          JSON.stringify({
            scripts: { dev: 'vite --port 3333', start: 'serve -p 9000' },
          }),
        ],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(3333);
    });
  });

  describe('framework defaults', () => {
    it('returns 5173 for Vite projects', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ dependencies: { vite: '^5.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(5173);
    });

    it('returns 3000 for Next.js projects', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ dependencies: { next: '14.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(3000);
    });

    it('returns 3000 for CRA projects', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ devDependencies: { 'react-scripts': '5.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(3000);
    });

    it('returns 4200 for Angular projects', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ devDependencies: { '@angular/cli': '17.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(4200);
    });

    it('returns 5173 for Vue projects', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ dependencies: { vue: '^3.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(5173);
    });

    it('checks devDependencies too', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ devDependencies: { vite: '^5.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(5173);
    });
  });

  describe('priority', () => {
    it('vite.config takes priority over package.json framework', () => {
      const files = new Map([
        ['vite.config.ts', 'export default { server: { port: 7777 } }'],
        ['package.json', JSON.stringify({ dependencies: { next: '14.0.0' } })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(7777);
    });

    it('script port flag takes priority over framework default', () => {
      const files = new Map([
        [
          'package.json',
          JSON.stringify({
            scripts: { dev: 'next dev --port 4444' },
            dependencies: { next: '14.0.0' },
          }),
        ],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(4444);
    });
  });

  describe('fallback', () => {
    it('returns 5173 when no files are collected', () => {
      expect(detectDevServerPort(noopDeps, new Map())).toBe(5173);
    });

    it('returns 5173 when package.json has no relevant info', () => {
      const files = new Map([
        ['package.json', JSON.stringify({ name: 'my-lib', version: '1.0.0' })],
      ]);
      expect(detectDevServerPort(noopDeps, files)).toBe(5173);
    });
  });

  describe('error handling', () => {
    it('handles malformed package.json gracefully', () => {
      const files = new Map([['package.json', 'not valid json {{{']]);
      expect(detectDevServerPort(noopDeps, files)).toBe(5173);
    });

    it('calls debugWarn on parse failure', () => {
      const warnings: unknown[][] = [];
      const deps: DevServerDetectionDeps = {
        debugLog: () => {},
        debugWarn: (...args) => warnings.push(args),
      };
      const files = new Map([['package.json', '{invalid']]);
      detectDevServerPort(deps, files);
      expect(warnings.length).toBe(1);
      expect(warnings[0][0]).toContain('Failed to parse');
    });
  });
});
