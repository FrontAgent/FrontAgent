import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { getChangedFiles } from '../workflows/contract-check.mjs';
import {
  classifyContractPaths,
  evaluateGitNexusContract,
  extractImpactSummary,
} from '../workflows/contract-rules.mjs';

const validImpactSummary = [
  '- Risk level: LOW',
  '- Critical skeleton changes: repo-harness scripts and workflow tests only.',
  '- GitNexus impact: detect_changes reported Harness scripts only; context on evaluateGitNexusContract shows tests as callers.',
  '- Verification: node --test scripts/tests/workflow-rules.test.mjs passed.',
].join('\n');

function listPublicClaudeAssets() {
  const tracked = execFileSync('git', ['ls-files', '.claude'], { encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '.claude'], {
    encoding: 'utf8',
  });
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))].sort();
}

test('classifyContractPaths separates critical and non-critical changes', () => {
  const result = classifyContractPaths([
    'scripts/workflows/contract-check.mjs',
    'scripts/tests/workflow-rules.test.mjs',
    'docs/README-CN.md',
  ]);

  assert.deepEqual(result.critical, [
    { file: 'scripts/workflows/contract-check.mjs', category: 'repo-harness' },
  ]);
  assert.deepEqual(result.nonCritical, [
    'scripts/tests/workflow-rules.test.mjs',
    'docs/README-CN.md',
  ]);
});

test('classifyContractPaths treats Claude reusable assets as repo harness', () => {
  const result = classifyContractPaths([
    '.claude/workflows/oss-harness-engineering-workflow.js',
    '.claude/skills/gitnexus/gitnexus-cli/SKILL.md',
  ]);

  assert.deepEqual(result.critical, [
    {
      file: '.claude/workflows/oss-harness-engineering-workflow.js',
      category: 'repo-harness',
    },
    {
      file: '.claude/skills/gitnexus/gitnexus-cli/SKILL.md',
      category: 'repo-harness',
    },
  ]);
  assert.deepEqual(result.nonCritical, []);
});

test('critical changes require matching tests and structured GitNexus impact summary', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['scripts/workflows/contract-check.mjs'],
    impactSummary: '',
  });

  assert.equal(result.ok, false);
  assert.match(
    result.reasons.join('\n'),
    /Missing contract test for critical file: scripts\/workflows\/contract-check\.mjs/u,
  );
  assert.match(result.reasons.join('\n'), /Missing structured GitNexus impact summary/u);
});

test('critical changes pass with matching tests and structured GitNexus impact summary', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['scripts/workflows/contract-check.mjs', 'scripts/tests/workflow-rules.test.mjs'],
    impactSummary: validImpactSummary,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.reasons, []);
});

test('package scoped critical changes reject unrelated package tests', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['packages/mcp-web/src/server.ts', 'packages/mcp-file/src/security.test.ts'],
    impactSummary: validImpactSummary,
  });

  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /Missing contract test for critical file/u);
  assert.match(result.reasons.join('\n'), /packages\/mcp-web\/src\/server\.ts/u);
});

test('mcp-memory files classify as memory boundary before generic mcp boundary', () => {
  const result = classifyContractPaths(['packages/mcp-memory/src/index.ts']);

  assert.deepEqual(result.critical, [
    { file: 'packages/mcp-memory/src/index.ts', category: 'memory-boundary' },
  ]);
});

test('local contract mode does not require a PR impact summary', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['scripts/workflows/contract-check.mjs', 'scripts/tests/workflow-rules.test.mjs'],
    impactSummary: '',
    requireImpactSummary: false,
  });

  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /not enforced locally/u);
});

test('GitNexus analyze streams output to avoid spawn buffer limits', () => {
  const contractCheck = readFileSync('scripts/workflows/contract-check.mjs', 'utf8');
  const analyzeFunction = contractCheck.slice(
    contractCheck.indexOf('function runGitNexusAnalyze'),
    contractCheck.indexOf('function getGitNexusAnalyzeInvocation'),
  );

  assert.match(
    analyzeFunction,
    /spawnSync\(command, args, \{\s*stdio: 'inherit',\s*timeout: timeoutMs,\s*\}\)/u,
  );
  assert.doesNotMatch(analyzeFunction, /encoding: 'utf8'/u);
});

test('non-critical changes keep GitNexus advisory', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['docs/README-CN.md'],
    impactSummary: '',
  });

  assert.equal(result.ok, true);
  assert.match(result.warnings.join('\n'), /advisory/u);
});

test('impact summary rejects placeholders and invalid risk levels', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['AGENTS.md', 'scripts/tests/workflow-rules.test.mjs'],
    impactSummary: [
      '- Risk level: UNKNOWN',
      '- Critical skeleton changes: -',
      '- GitNexus impact: detect_changes only.',
      '- Verification: -',
    ].join('\n'),
  });

  assert.equal(result.ok, false);
  assert.match(result.reasons.join('\n'), /Invalid GitNexus risk level/u);
  assert.match(result.reasons.join('\n'), /Critical skeleton changes/u);
  assert.match(result.reasons.join('\n'), /GitNexus impact must mention detect_changes/u);
  assert.match(result.reasons.join('\n'), /Verification/u);
});

test('extractImpactSummary reads only the PR template impact section', () => {
  const body = [
    '## Summary',
    '',
    '- something',
    '',
    '## GitNexus Impact Summary',
    '',
    validImpactSummary,
    '',
    '## Verification',
    '',
    '- node --test',
  ].join('\n');

  assert.equal(extractImpactSummary(body), validImpactSummary);
});

test('package exposes required OSS Harness scripts', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  assert.equal(pkg.scripts.prepare, 'pnpm hooks:install');
  assert.equal(pkg.scripts['hooks:install'], 'node scripts/workflows/install-hooks.mjs');
  assert.equal(
    pkg.scripts['agent:bootstrap'],
    'node scripts/workflows/contract-check.mjs bootstrap',
  );
  assert.equal(pkg.scripts['contract:local'], 'node scripts/workflows/contract-check.mjs local');
  assert.equal(pkg.scripts['contract:check'], 'node scripts/workflows/contract-check.mjs check');
  assert.equal(
    pkg.scripts['contract:gitnexus'],
    'node scripts/workflows/contract-check.mjs gitnexus',
  );
  assert.equal(pkg.scripts['quality:predev'], 'pnpm hooks:install && pnpm contract:local');
  assert.equal(pkg.scripts['test:workflows'], 'node --test scripts/tests/*.test.mjs');
  assert.equal(
    pkg.scripts['quality:precommit'],
    'pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows',
  );
  assert.equal(
    pkg.scripts['quality:ci'],
    'pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows && pnpm build',
  );
  assert.equal(pkg.scripts['quality:local'], 'pnpm contract:local && pnpm quality:ci');
});

test('hook files exist and invoke intended quality gates', () => {
  const preCommit = readFileSync('.githooks/pre-commit', 'utf8');
  const prePush = readFileSync('.githooks/pre-push', 'utf8');

  assert.match(preCommit, /pnpm quality:precommit/u);
  assert.match(preCommit, /SKIP_QUALITY_HOOKS/u);
  assert.match(prePush, /pnpm quality:local/u);
  assert.match(prePush, /SKIP_QUALITY_HOOKS/u);
  assert.equal(Boolean(statSync('.githooks/pre-commit').mode & 0o111), true);
  assert.equal(Boolean(statSync('.githooks/pre-push').mode & 0o111), true);
});

test('local contract mode compares committed branch changes and worktree changes', () => {
  const calls = [];
  const result = getChangedFiles('local', {
    env: {},
    git: {
      refExists: (ref) => ref === 'origin/develop',
      fetchBaseRef: () => {
        throw new Error('local mode should not fetch the base branch');
      },
      lines: (args) => {
        calls.push(args);
        const command = args.join(' ');
        if (command.includes('origin/develop...HEAD'))
          return ['scripts/workflows/contract-check.mjs'];
        if (command.includes('--cached')) return ['.github/workflows/contract-guard.yml'];
        if (command.includes('diff') && command.includes('HEAD')) return ['AGENTS.md'];
        if (command.includes('ls-files')) return ['scripts/tests/workflow-rules.test.mjs'];
        return [];
      },
    },
  });

  assert.deepEqual(result, [
    'scripts/workflows/contract-check.mjs',
    '.github/workflows/contract-guard.yml',
    'AGENTS.md',
    'scripts/tests/workflow-rules.test.mjs',
  ]);
  assert.ok(calls.some((args) => args.includes('origin/develop...HEAD')));
  assert.ok(calls.some((args) => args.includes('--cached')));
  assert.ok(calls.some((args) => args.includes('--others')));
});

test('CI and contract guard target develop and call named quality scripts', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const contractGuard = readFileSync('.github/workflows/contract-guard.yml', 'utf8');

  assert.match(ci, /branches:\s*\[develop\]/u);
  assert.match(ci, /node-version:\s*\[20,\s*22\]/u);
  assert.match(ci, /pnpm quality:ci/u);
  assert.match(ci, /\n\s+ci:\n\s+name:\s+CI\n/u);
  assert.match(ci, /\n\s+needs:\s+check\n/u);
  assert.match(ci, /needs\.check\.result/u);
  assert.match(contractGuard, /branches:\s*\[develop\]/u);
  assert.match(contractGuard, /pnpm contract:gitnexus/u);
  assert.match(contractGuard, /GITNEXUS_IMPACT_SUMMARY/u);
});

test('PR template contains enforced GitNexus summary fields', () => {
  const template = readFileSync('.github/PULL_REQUEST_TEMPLATE.md', 'utf8');

  assert.match(template, /## GitNexus Impact Summary/u);
  assert.match(template, /Risk level:/u);
  assert.match(template, /Critical skeleton changes:/u);
  assert.match(template, /GitNexus impact:/u);
  assert.match(template, /Verification:/u);
});

test('workflow doc links the detailed OSS Harness workflow asset', () => {
  const workflow = readFileSync('docs/workflow.md', 'utf8');
  const detailedWorkflow = readFileSync('docs/oss-harness-engineering-workflow.md', 'utf8');

  assert.match(workflow, /docs\/oss-harness-engineering-workflow\.md/u);
  assert.match(detailedWorkflow, /# Open-Source Harness Engineering Workflow/u);
  assert.match(detailedWorkflow, /## Saveable Workflow Prompt/u);
  assert.match(detailedWorkflow, /open-source community workflow, not a training-camp workflow/u);
  assert.match(detailedWorkflow, /Maintainers decide merge readiness/u);
});

test('local Claude state markdown remains ignored', () => {
  assert.doesNotThrow(() =>
    execFileSync('git', ['check-ignore', '-q', '.claude/repo-evolver.local.md']),
  );
  assert.doesNotThrow(() =>
    execFileSync('git', ['check-ignore', '-q', '.claude/ralph-loop.local.md']),
  );
});

test('Claude reusable assets are public while local state stays private', () => {
  const publicClaudeAssets = listPublicClaudeAssets();

  assert.ok(publicClaudeAssets.length > 0);
  assert.ok(publicClaudeAssets.includes('.claude/workflows/oss-harness-engineering-workflow.js'));
  assert.ok(publicClaudeAssets.includes('.claude/skills/gitnexus/gitnexus-cli/SKILL.md'));
  assert.ok(
    publicClaudeAssets.every(
      (file) => file.startsWith('.claude/workflows/') || file.startsWith('.claude/skills/'),
    ),
  );
});

test('public Harness workflow assets are portable', () => {
  const publicClaudeAssets = listPublicClaudeAssets();
  const publicAssets = ['docs/oss-harness-engineering-workflow.md', ...publicClaudeAssets];
  const secretEnvNamePattern = /\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET)\b/u;

  for (const asset of publicAssets) {
    const content = readFileSync(asset, 'utf8');

    assert.doesNotMatch(content, /\/Users\//u, asset);
    assert.doesNotMatch(content, /sankuai\.com/u, asset);
    assert.doesNotMatch(content, secretEnvNamePattern, asset);
  }
});

test('Claude Harness workflow has a single portable entrypoint', () => {
  const workflowAssets = listPublicClaudeAssets().filter((file) =>
    file.startsWith('.claude/workflows/'),
  );
  const workflow = readFileSync('.claude/workflows/oss-harness-engineering-workflow.js', 'utf8');

  assert.deepEqual(workflowAssets, ['.claude/workflows/oss-harness-engineering-workflow.js']);
  assert.match(workflow, /name:\s*'oss-harness-engineering-workflow'/u);
});

test('repo guard remains advisory and training-camp workflows are absent', () => {
  const repoGuard = readFileSync('.github/workflows/repo-guard.yml', 'utf8');

  assert.doesNotMatch(repoGuard, /auto-merge|确认合并|认领|score:/u);
  assert.throws(() => readFileSync('.github/workflows/pr-auto-merge.yml', 'utf8'));
  assert.throws(() => readFileSync('.github/workflows/issue-claim.yml', 'utf8'));
  assert.throws(() => readFileSync('docs/progress.json', 'utf8'));
});

test('agent prompts describe the OSS Harness review loop', () => {
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const prompt = readFileSync(file, 'utf8');

    assert.match(prompt, /## Harness Loop/u);
    assert.match(
      prompt,
      /Start from an Issue, Discussion, or maintainer-approved task description/u,
    );
    assert.match(prompt, /Open a PR to `develop`/u);
    assert.match(prompt, /GitHub Actions, Contract Guard, Repo Guard, Codex, Copilot/u);
    assert.match(prompt, /maintainers decide merge readiness/u);
  }
});
