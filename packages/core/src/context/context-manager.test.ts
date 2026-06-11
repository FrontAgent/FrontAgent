import type { AgentTask, ExecutionPlan, ExecutionStep, SDDConfig } from '@frontagent/shared';
import { describe, expect, it } from 'vitest';
import type { Message, ModuleInfo, ProjectFactsUpdate } from '../types.js';
import { ContextManager, createContextManager } from './context-manager.js';
import {
  exportProjectFactsSnapshot,
  mergeProjectFactsUpdate,
  projectFactsFromSnapshot,
} from './facts-merge-helpers.js';
import { updateFilesystemFactsFromToolResult } from './filesystem-facts-update.js';

function makeTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    type: 'create',
    description: 'Test task',
    ...overrides,
  };
}

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    stepId: 'step-1',
    description: 'Test step',
    action: 'create',
    tool: 'test-tool',
    params: {},
    dependencies: [],
    validation: [],
    status: 'pending',
    phase: 'build',
    ...overrides,
  };
}

function makePlan(steps: ExecutionStep[] = [makeStep()]): ExecutionPlan {
  return {
    steps,
    reasoning: 'test plan',
    estimatedDuration: 1000,
  };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    role: 'user',
    content: 'hello',
    ...overrides,
  };
}

describe('ContextManager', () => {
  describe('createContext', () => {
    it('creates context with task and initial state', () => {
      const manager = new ContextManager();
      const task = makeTask();
      const context = manager.createContext(task);

      expect(context.task).toBe(task);
      expect(context.executedSteps).toEqual([]);
      expect(context.messages).toEqual([]);
      expect(context.collectedContext.files).toBeInstanceOf(Map);
      expect(context.collectedContext.files.size).toBe(0);
      expect(context.facts.revision).toBe(0);
      expect(context.facts.filesystem.existingFiles).toBeInstanceOf(Set);
      expect(context.facts.filesystem.existingFiles.size).toBe(0);
      expect(context.facts.project.devServerRunning).toBe(false);
      expect(context.facts.project.buildStatus).toBe('unknown');
    });

    it('stores sddConfig when provided', () => {
      const manager = new ContextManager();
      const sddConfig: SDDConfig = { constraints: ['constraint-1'] } as unknown as SDDConfig;
      const context = manager.createContext(makeTask(), sddConfig);
      expect(context.sddConfig).toBe(sddConfig);
    });

    it('returns same context for getContext', () => {
      const manager = new ContextManager();
      const task = makeTask({ id: 't1' });
      const created = manager.createContext(task);
      expect(manager.getContext('t1')).toBe(created);
    });
  });

  describe('getContext', () => {
    it('returns undefined for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.getContext('nonexistent')).toBeUndefined();
    });
  });

  describe('setPlan', () => {
    it('sets plan on existing context', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      const plan = makePlan();
      manager.setPlan('t1', plan);
      expect(manager.getContext('t1')?.plan).toBe(plan);
    });

    it('ignores unknown taskId', () => {
      const manager = new ContextManager();
      manager.setPlan('nonexistent', makePlan());
      // no error thrown
    });
  });

  describe('addExecutedStep', () => {
    it('appends step to executedSteps', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      const step1 = makeStep({ stepId: 's1' });
      const step2 = makeStep({ stepId: 's2' });

      manager.addExecutedStep('t1', step1);
      manager.addExecutedStep('t1', step2);

      const steps = manager.getContext('t1')?.executedSteps;
      expect(steps).toHaveLength(2);
      expect(steps?.[0]).toBe(step1);
      expect(steps?.[1]).toBe(step2);
    });

    it('ignores unknown taskId', () => {
      const manager = new ContextManager();
      manager.addExecutedStep('nonexistent', makeStep());
    });
  });

  describe('addFile', () => {
    it('adds file to collectedContext', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addFile('t1', 'src/index.ts', 'export {}');

      const files = manager.getContext('t1')?.collectedContext.files;
      expect(files?.get('src/index.ts')).toBe('export {}');
    });

    it('overwrites existing file content', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addFile('t1', 'src/index.ts', 'old');
      manager.addFile('t1', 'src/index.ts', 'new');
      expect(manager.getContext('t1')?.collectedContext.files.get('src/index.ts')).toBe('new');
    });
  });

  describe('setPageStructure', () => {
    it('sets page structure', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      const structure = { components: ['Header', 'Footer'] };
      manager.setPageStructure('t1', structure);
      expect(manager.getContext('t1')?.collectedContext.pageStructure).toBe(structure);
    });
  });

  describe('addRagResults', () => {
    it('appends RAG results', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addRagResults('t1', ['result1', 'result2']);
      manager.addRagResults('t1', ['result3']);

      expect(manager.getContext('t1')?.collectedContext.ragResults).toEqual([
        'result1',
        'result2',
        'result3',
      ]);
    });

    it('initializes when undefined', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addRagResults('t1', ['first']);
      expect(manager.getContext('t1')?.collectedContext.ragResults).toEqual(['first']);
    });
  });

  describe('setRagMetadata', () => {
    it('sets RAG metadata', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.setRagMetadata('t1', {
        matches: [{ id: 'm1', score: 0.9 }] as Array<{ id: string; score: number }>,
        searchMode: 'hybrid',
        warnings: ['warn1'],
      });

      const ctx = manager.getContext('t1')?.collectedContext;
      expect(ctx?.ragMatches).toHaveLength(1);
      expect(ctx?.ragSearchMode).toBe('hybrid');
      expect(ctx?.ragWarnings).toEqual(['warn1']);
    });
  });

  describe('addMessage / getMessages', () => {
    it('adds and retrieves messages', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addMessage('t1', makeMessage({ role: 'user', content: 'hi' }));
      manager.addMessage('t1', makeMessage({ role: 'assistant', content: 'hello' }));

      const messages = manager.getMessages('t1');
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('hi');
      expect(messages[1].content).toBe('hello');
    });

    it('returns empty array for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.getMessages('nonexistent')).toEqual([]);
    });
  });

  describe('clearContext', () => {
    it('removes context', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.clearContext('t1');
      expect(manager.getContext('t1')).toBeUndefined();
    });
  });

  describe('message history compaction', () => {
    it('compacts older messages past the threshold while keeping recent turns', () => {
      const manager = new ContextManager({
        budget: { historyCompaction: { threshold: 10, keepRecent: 4 } },
      });
      manager.createContext(makeTask({ id: 't1' }));
      manager.addMessage('t1', { role: 'system', content: 'sdd prompt' });
      for (let i = 0; i < 15; i++) {
        manager.addMessage('t1', { role: 'user', content: `message ${i}` });
      }

      const messages = manager.getMessages('t1');
      expect(messages.length).toBeLessThan(16);
      expect(messages[0].content).toBe('sdd prompt');
      expect(messages[1].content).toContain('## 历史消息摘要');
      expect(messages.at(-1)?.content).toBe('message 14');
    });

    it('does not compact below the threshold', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      for (let i = 0; i < 5; i++) {
        manager.addMessage('t1', { role: 'user', content: `message ${i}` });
      }
      expect(manager.getMessages('t1')).toHaveLength(5);
    });
  });

  describe('buildSystemPrompt', () => {
    it('returns sddPrompt when context not found', () => {
      const manager = new ContextManager();
      expect(manager.buildSystemPrompt('nonexistent', 'base prompt')).toBe('base prompt');
    });

    it('includes sddPrompt as rules zone', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      const prompt = manager.buildSystemPrompt('t1', 'SDD rules');
      expect(prompt).toContain('SDD rules');
    });

    it('includes files section when files exist', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addFile('t1', 'src/index.ts', 'line1\nline2\n');
      const prompt = manager.buildSystemPrompt('t1', 'rules');
      expect(prompt).toContain('已读取的文件');
      expect(prompt).toContain('src/index.ts');
    });

    it('includes executed steps section', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addExecutedStep('t1', makeStep({ description: 'Create file', status: 'completed' }));
      const prompt = manager.buildSystemPrompt('t1', 'rules');
      expect(prompt).toContain('已执行的步骤');
      expect(prompt).toContain('Create file');
    });

    it('truncates over-budget zones with explicit markers', () => {
      const manager = new ContextManager({
        budget: { zoneBudgets: { memory: 50 } },
      });
      manager.createContext(makeTask({ id: 't1' }));
      const ctx = manager.getContext('t1')!;
      ctx.collectedContext.memoryContext = `## Memory\n${'m'.repeat(500)}`;
      const prompt = manager.buildSystemPrompt('t1', 'rules');
      expect(prompt).toContain('[已截断：memory zone 超出 50 字符预算]');
      expect(prompt).toContain('rules');
    });

    it('includes memory context when set', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      const ctx = manager.getContext('t1')!;
      ctx.collectedContext.memoryContext = '## Memory\nKnown facts';
      const prompt = manager.buildSystemPrompt('t1', 'rules');
      expect(prompt).toContain('Known facts');
    });

    it('includes filesense context when set', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.setFilesenseContext('t1', 'src/\n  index.ts');
      const prompt = manager.buildSystemPrompt('t1', 'rules');
      expect(prompt).toContain('目录导航 (Filesense)');
      expect(prompt).toContain('src/');
    });
  });

  describe('buildContextSummary', () => {
    it('returns empty string when context not found', () => {
      const manager = new ContextManager();
      expect(manager.buildContextSummary('nonexistent')).toBe('');
    });

    it('includes task info', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1', type: 'create', description: 'Build UI' }));
      const summary = manager.buildContextSummary('t1');
      expect(summary).toContain('当前任务');
      expect(summary).toContain('create');
      expect(summary).toContain('Build UI');
    });

    it('includes file list', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addFile('t1', 'a.ts', 'content');
      manager.addFile('t1', 'b.ts', 'content');
      const summary = manager.buildContextSummary('t1');
      expect(summary).toContain('相关文件');
      expect(summary).toContain('a.ts');
      expect(summary).toContain('b.ts');
    });

    it('includes execution progress when plan exists', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.setPlan('t1', makePlan([makeStep({ stepId: 's1' }), makeStep({ stepId: 's2' })]));
      manager.addExecutedStep('t1', makeStep({ stepId: 's1', status: 'completed' }));
      const summary = manager.buildContextSummary('t1');
      expect(summary).toContain('执行进度: 1/2');
    });
  });

  describe('updateFileSystemFacts', () => {
    it('keeps filesystem helper mutations independent from revision bumping', () => {
      const manager = new ContextManager();
      const context = manager.createContext(makeTask({ id: 't1' }));

      const changed = updateFilesystemFactsFromToolResult(
        context.facts,
        'search_code',
        {},
        {
          success: true,
          files: ['src/app.ts'],
        },
      );

      expect(changed).toBe(true);
      expect(context.facts.filesystem.existingFiles.has('src/app.ts')).toBe(true);
      expect(context.facts.filesystem.existingDirectories.has('src')).toBe(true);
      expect(context.facts.revision).toBe(0);
    });

    it('records existing file on create_file success', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts('t1', 'create_file', { path: 'src/a.ts' }, { success: true });

      const facts = manager.getContext('t1')!.facts;
      expect(facts.filesystem.existingFiles.has('src/a.ts')).toBe(true);
      expect(facts.filesystem.nonExistentPaths.has('src/a.ts')).toBe(false);
      expect(facts.revision).toBe(1);
    });

    it('records non-existent path on create_file failure with "not found"', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts(
        't1',
        'create_file',
        { path: 'src/a.ts' },
        { success: false, error: 'directory not found' },
      );

      expect(manager.getContext('t1')!.facts.filesystem.nonExistentPaths.has('src/a.ts')).toBe(
        true,
      );
    });

    it('records existing file on successful read_file', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts('t1', 'read_file', { path: 'a.ts' }, { success: true });

      expect(manager.getContext('t1')!.facts.filesystem.existingFiles.has('a.ts')).toBe(true);
    });

    it('records non-existent file on read_file with exists=false', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts(
        't1',
        'read_file',
        { path: 'a.ts' },
        { success: false, skipped: true, exists: false },
      );

      expect(manager.getContext('t1')!.facts.filesystem.nonExistentPaths.has('a.ts')).toBe(true);
    });

    it('records directory contents on list_directory', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts(
        't1',
        'list_directory',
        { path: 'src' },
        {
          success: true,
          entries: [
            { name: 'a.ts', path: 'src/a.ts', type: 'file' },
            { name: 'utils', path: 'src/utils', type: 'directory' },
          ],
        },
      );

      const facts = manager.getContext('t1')!.facts;
      expect(facts.filesystem.existingDirectories.has('src')).toBe(true);
      expect(facts.filesystem.existingFiles.has('src/a.ts')).toBe(true);
      expect(facts.filesystem.existingDirectories.has('src/utils')).toBe(true);
      expect(facts.filesystem.directoryContents.get('src')).toEqual(['src/a.ts', 'src/utils']);
    });

    it('records files from search_code results', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts(
        't1',
        'search_code',
        {},
        { success: true, files: ['src/a.ts'], matches: [{ file: 'src/b.ts' }] },
      );

      const facts = manager.getContext('t1')!.facts;
      expect(facts.filesystem.existingFiles.has('src/a.ts')).toBe(true);
      expect(facts.filesystem.existingFiles.has('src/b.ts')).toBe(true);
    });

    it('does not bump revision when nothing changed', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts('t1', 'unknown_tool', {}, { success: true });
      expect(manager.getContext('t1')!.facts.revision).toBe(0);
    });
  });

  describe('updateDependencyFacts', () => {
    it('records installed package from npm install', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateDependencyFacts(
        't1',
        'run_command',
        { command: 'npm install express' },
        { success: true },
      );

      const deps = manager.getContext('t1')!.facts.dependencies;
      expect(deps.installedPackages.has('express')).toBe(true);
      expect(deps.missingPackages.has('express')).toBe(false);
    });

    it('records missing package from error', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateDependencyFacts(
        't1',
        'run_command',
        { command: 'node index.js' },
        { error: "Cannot find module 'lodash'" },
      );

      expect(manager.getContext('t1')!.facts.dependencies.missingPackages.has('lodash')).toBe(true);
    });
  });

  describe('updateProjectFacts', () => {
    it('detects dev server start', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateProjectFacts(
        't1',
        'run_command',
        { command: 'npm run dev' },
        { success: true, output: 'Server running on localhost:3000' },
      );

      const project = manager.getContext('t1')!.facts.project;
      expect(project.devServerRunning).toBe(true);
      expect(project.runningPort).toBe(3000);
    });

    it('detects successful build', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateProjectFacts(
        't1',
        'run_command',
        { command: 'npm run build' },
        { success: true },
      );

      expect(manager.getContext('t1')!.facts.project.buildStatus).toBe('success');
    });

    it('detects failed build', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateProjectFacts(
        't1',
        'run_command',
        { command: 'npm run build' },
        { success: false },
      );

      expect(manager.getContext('t1')!.facts.project.buildStatus).toBe('failed');
    });
  });

  describe('addErrorFact', () => {
    it('adds error to facts', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addErrorFact('t1', 'step-1', 'runtime', 'Something failed');

      const errors = manager.getContext('t1')!.facts.errors;
      expect(errors).toHaveLength(1);
      expect(errors[0].stepId).toBe('step-1');
      expect(errors[0].type).toBe('runtime');
      expect(errors[0].message).toBe('Something failed');
      expect(errors[0].timestamp).toBeTypeOf('number');
      expect(manager.getContext('t1')!.facts.revision).toBe(1);
    });
  });

  describe('exportFactsSnapshot / replaceFactsFromSnapshot', () => {
    it('exports and re-imports snapshot roundtrip', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addFile('t1', 'src/a.ts', 'content');
      manager.updateFileSystemFacts('t1', 'create_file', { path: 'src/a.ts' }, { success: true });
      manager.addErrorFact('t1', 's1', 'test', 'err');

      const snapshot = manager.exportFactsSnapshot('t1')!;
      expect(snapshot).toBeDefined();
      expect(snapshot.filesystem.existingFiles).toContain('src/a.ts');
      expect(snapshot.errors).toHaveLength(1);

      // Create a new context and replace
      manager.createContext(makeTask({ id: 't2' }));
      manager.replaceFactsFromSnapshot('t2', snapshot);

      const facts = manager.getContext('t2')!.facts;
      expect(facts.filesystem.existingFiles.has('src/a.ts')).toBe(true);
      expect(facts.errors).toHaveLength(1);
      expect(facts.revision).toBe(snapshot.revision);
    });

    it('returns undefined for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.exportFactsSnapshot('nonexistent')).toBeUndefined();
    });
  });

  describe('mergeFactsUpdate', () => {
    it('applies changes and bumps revision', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));

      const result = manager.mergeFactsUpdate('t1', {
        baseRevision: 0,
        source: 'sub-agent',
        changes: {
          addExistingFiles: ['src/new.ts'],
          addInstalledPackages: ['lodash'],
          addErrors: [{ stepId: 's1', type: 'test', message: 'err', timestamp: Date.now() }],
        },
      });

      expect(result.applied).toBe(true);
      expect(result.staleBaseRevision).toBe(false);
      expect(result.previousRevision).toBe(0);
      expect(result.nextRevision).toBe(1);

      const facts = manager.getContext('t1')!.facts;
      expect(facts.filesystem.existingFiles.has('src/new.ts')).toBe(true);
      expect(facts.dependencies.installedPackages.has('lodash')).toBe(true);
      expect(facts.errors).toHaveLength(1);
    });

    it('detects stale base revision', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.addErrorFact('t1', 's1', 't', 'e'); // bump to revision 1

      const result = manager.mergeFactsUpdate('t1', {
        baseRevision: 0, // stale
        source: 'sub',
        changes: { addExistingFiles: ['a.ts'] },
      });

      expect(result.staleBaseRevision).toBe(true);
      expect(result.applied).toBe(true); // still applies
    });

    it('returns applied=false for unknown taskId', () => {
      const manager = new ContextManager();
      const result = manager.mergeFactsUpdate('nonexistent', {
        baseRevision: 0,
        source: 'sub',
        changes: {},
      });
      expect(result.applied).toBe(false);
    });
  });

  describe('facts merge helpers', () => {
    it('clones mutable snapshot values when exporting and restoring facts', () => {
      const manager = new ContextManager();
      const facts = manager.createContext(makeTask({ id: 't1' })).facts;
      const moduleInfo: ModuleInfo = {
        path: 'src/app.ts',
        type: 'component',
        exports: ['App'],
        imports: ['react'],
      };

      facts.revision = 7;
      facts.filesystem.existingFiles.add('src/app.ts');
      facts.filesystem.directoryContents.set('src', ['src/app.ts']);
      facts.moduleDependencyGraph.modules.set(moduleInfo.path, moduleInfo);
      facts.moduleDependencyGraph.dependencies.set(moduleInfo.path, ['react']);
      facts.errors.push({ stepId: 's1', type: 'test', message: 'original', timestamp: 1 });

      const snapshot = exportProjectFactsSnapshot(facts);

      moduleInfo.exports.push('mutated-after-export');
      facts.filesystem.directoryContents.get('src')!.push('src/mutated.ts');
      facts.moduleDependencyGraph.dependencies.get(moduleInfo.path)!.push('mutated-dep');
      facts.errors[0].message = 'mutated-after-export';

      expect(snapshot.moduleDependencyGraph.modules[moduleInfo.path].exports).toEqual(['App']);
      expect(snapshot.filesystem.directoryContents.src).toEqual(['src/app.ts']);
      expect(snapshot.moduleDependencyGraph.dependencies[moduleInfo.path]).toEqual(['react']);
      expect(snapshot.errors[0].message).toBe('original');

      const restored = projectFactsFromSnapshot(snapshot);
      snapshot.moduleDependencyGraph.modules[moduleInfo.path].imports.push('mutated-after-restore');
      snapshot.filesystem.directoryContents.src.push('src/after-restore.ts');
      snapshot.errors[0].message = 'mutated-after-restore';

      expect(restored.moduleDependencyGraph.modules.get(moduleInfo.path)!.imports).toEqual([
        'react',
      ]);
      expect(restored.filesystem.directoryContents.get('src')).toEqual(['src/app.ts']);
      expect(restored.errors[0].message).toBe('original');
    });

    it('merges facts updates with cloned mutable payload values', () => {
      const manager = new ContextManager();
      const facts = manager.createContext(makeTask({ id: 't1' })).facts;
      const moduleInfo: ModuleInfo = {
        path: 'src/app.ts',
        type: 'component',
        exports: ['App'],
        imports: ['react'],
      };
      const update: ProjectFactsUpdate = {
        baseRevision: 0,
        source: 'sub-agent',
        timestamp: 1,
        changes: {
          setDirectoryContents: [{ path: 'src', entries: ['src/app.ts'] }],
          upsertModules: [moduleInfo],
          setDependencies: [{ path: moduleInfo.path, dependencies: ['react'] }],
          addErrors: [{ stepId: 's1', type: 'test', message: 'original', timestamp: 1 }],
        },
      };

      const result = mergeProjectFactsUpdate(facts, update);

      moduleInfo.exports.push('mutated-after-merge');
      update.changes.setDirectoryContents![0].entries.push('src/mutated.ts');
      update.changes.setDependencies![0].dependencies.push('mutated-dep');
      update.changes.addErrors![0].message = 'mutated-after-merge';

      expect(result.applied).toBe(true);
      expect(result.previousRevision).toBe(0);
      expect(result.nextRevision).toBe(1);
      expect(facts.moduleDependencyGraph.modules.get(moduleInfo.path)!.exports).toEqual(['App']);
      expect(facts.filesystem.directoryContents.get('src')).toEqual(['src/app.ts']);
      expect(facts.moduleDependencyGraph.dependencies.get(moduleInfo.path)).toEqual(['react']);
      expect(facts.errors[0].message).toBe('original');
    });

    it('reports empty facts updates without bumping revision', () => {
      const manager = new ContextManager();
      const facts = manager.createContext(makeTask({ id: 't1' })).facts;

      const result = mergeProjectFactsUpdate(facts, {
        baseRevision: 0,
        source: 'sub-agent',
        timestamp: 1,
        changes: {},
      });

      expect(result.applied).toBe(false);
      expect(result.staleBaseRevision).toBe(false);
      expect(result.previousRevision).toBe(0);
      expect(result.nextRevision).toBe(0);
      expect(facts.revision).toBe(0);
    });
  });

  describe('serializeFactsForLLM', () => {
    it('serializes facts to readable string', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateFileSystemFacts('t1', 'create_file', { path: 'a.ts' }, { success: true });
      manager.updateDependencyFacts(
        't1',
        'run_command',
        { command: 'npm install react' },
        { success: true },
      );

      const text = manager.serializeFactsForLLM('t1');
      expect(text).toContain('事实版本');
      expect(text).toContain('文件系统状态');
      expect(text).toContain('a.ts');
      expect(text).toContain('react');
    });

    it('returns empty string for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.serializeFactsForLLM('nonexistent')).toBe('');
    });
  });

  describe('validateModuleDependencies', () => {
    it('returns missing module references', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateModuleDependencyGraph(
        't1',
        'create_file',
        { path: 'src/app.ts', content: "import { x } from './missing';" },
        { success: true },
      );

      const missing = manager.validateModuleDependencies('t1');
      expect(missing.length).toBeGreaterThan(0);
      expect(missing[0].from).toBe('src/app.ts');
    });

    it('returns empty for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.validateModuleDependencies('nonexistent')).toEqual([]);
    });
  });

  describe('getCreatedModulePaths', () => {
    it('returns module paths from graph and filesystem', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.updateModuleDependencyGraph(
        't1',
        'create_file',
        { path: 'src/a.ts', content: 'export const x = 1;' },
        { success: true },
      );
      manager.updateFileSystemFacts('t1', 'create_file', { path: 'src/b.ts' }, { success: true });

      const paths = manager.getCreatedModulePaths('t1');
      expect(paths).toContain('src/a.ts');
      expect(paths).toContain('src/b.ts');
    });

    it('returns empty for unknown taskId', () => {
      const manager = new ContextManager();
      expect(manager.getCreatedModulePaths('nonexistent')).toEqual([]);
    });
  });

  describe('setFilesenseContext', () => {
    it('sets filesense context string', () => {
      const manager = new ContextManager();
      manager.createContext(makeTask({ id: 't1' }));
      manager.setFilesenseContext('t1', 'src/\n  index.ts');
      expect(manager.getContext('t1')?.collectedContext.filesenseContext).toBe('src/\n  index.ts');
    });
  });

  describe('createContextManager factory', () => {
    it('returns a ContextManager instance', () => {
      const manager = createContextManager();
      expect(manager).toBeInstanceOf(ContextManager);
    });
  });
});
