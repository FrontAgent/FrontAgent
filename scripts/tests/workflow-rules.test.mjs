import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { assertGitWorkspaceRootMatchesCwd, getChangedFiles } from '../workflows/contract-check.mjs';
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

test('authority docs pass with workflow contract tests in local mode', () => {
  const result = evaluateGitNexusContract({
    changedFiles: ['README.md', 'scripts/tests/workflow-rules.test.mjs'],
    impactSummary: '',
    requireImpactSummary: false,
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
  assert.match(contractCheck, /'--wal-checkpoint-threshold'/u);
  assert.match(contractCheck, /GITNEXUS_WAL_CHECKPOINT_THRESHOLD = '67108864'/u);
});

test('Git workspace guard accepts matching toplevel and core.worktree', () => {
  const workspaceRoot = '/tmp/frontagent-workspace';

  assert.doesNotThrow(() =>
    assertGitWorkspaceRootMatchesCwd({
      cwd: workspaceRoot,
      gitText: (args) => {
        const command = args.join(' ');
        if (command === 'rev-parse --show-toplevel') return `${workspaceRoot}\n`;
        if (command === 'config --get core.worktree') return `${workspaceRoot}\n`;
        throw new Error(`unexpected git command: ${command}`);
      },
    }),
  );
});

test('Git workspace guard accepts matching toplevel when core.worktree is unset', () => {
  const workspaceRoot = '/tmp/frontagent-workspace';

  assert.doesNotThrow(() =>
    assertGitWorkspaceRootMatchesCwd({
      cwd: workspaceRoot,
      gitText: (args) => {
        const command = args.join(' ');
        if (command === 'rev-parse --show-toplevel') return `${workspaceRoot}\n`;
        if (command === 'config --get core.worktree') {
          throw Object.assign(new Error('core.worktree unset'), { status: 1 });
        }
        throw new Error(`unexpected git command: ${command}`);
      },
    }),
  );
});

test('Git workspace guard resolves relative core.worktree from git dir', () => {
  const workspaceRoot = '/tmp/frontagent-workspace';

  assert.doesNotThrow(() =>
    assertGitWorkspaceRootMatchesCwd({
      cwd: workspaceRoot,
      gitText: (args) => {
        const command = args.join(' ');
        if (command === 'rev-parse --show-toplevel') return `${workspaceRoot}\n`;
        if (command === 'rev-parse --git-dir') return `${workspaceRoot}/.git\n`;
        if (command === 'config --get core.worktree') return '..\n';
        throw new Error(`unexpected git command: ${command}`);
      },
    }),
  );
});

test('Git workspace guard rejects mismatched toplevel and core.worktree with repair hint', () => {
  const workspaceRoot = '/tmp/frontagent-worktree';
  const gitRoot = '/tmp/frontagent-main';

  assert.throws(
    () =>
      assertGitWorkspaceRootMatchesCwd({
        cwd: workspaceRoot,
        gitText: (args) => {
          const command = args.join(' ');
          if (command === 'rev-parse --show-toplevel') return `${gitRoot}\n`;
          if (command === 'config --get core.worktree') return `${gitRoot}\n`;
          throw new Error(`unexpected git command: ${command}`);
        },
      }),
    (err) => {
      assert.match(err.message, /Git workspace root mismatch/u);
      assert.match(err.message, new RegExp(workspaceRoot, 'u'));
      assert.match(err.message, new RegExp(gitRoot, 'u'));
      assert.match(err.message, /git rev-parse --show-toplevel/u);
      assert.match(err.message, /git config --get core\.worktree/u);
      assert.match(err.message, /git config --worktree core\.worktree/u);
      assert.match(err.message, /pnpm agent:bootstrap/u);
      return true;
    },
  );
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

  assert.equal(pkg.devDependencies.gitnexus, '1.6.6');
  assert.equal(pkg.pnpm.patchedDependencies, undefined);
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
    'pnpm lint && pnpm typecheck && pnpm test && pnpm test:workflows && pnpm build:verify',
  );
  assert.equal(pkg.scripts['quality:local'], 'pnpm contract:local && pnpm quality:ci');
  assert.equal(pkg.scripts['build:verify'], 'turbo build && node build.mjs');
  assert.equal(
    pkg.scripts.build,
    'pnpm build:verify && node scripts/sync-vscode-version.mjs && pnpm --dir apps/vscode package',
  );
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
  assert.match(ci, /\n\s+package:\n/u);
  assert.match(ci, /run: pnpm build\n/u);
  // The package job also packages the Electron desktop app (unsigned --dir),
  // run via pnpm so electron-builder detects pnpm + the workspace spine, then
  // asserts the packaged renderer + main/preload are present and valid.
  assert.match(ci, /run: pnpm --filter @frontagent\/desktop package\n/u);
  assert.match(ci, /test -f "\$app\/dist\/renderer\/index\.html"/u);
  assert.match(ci, /node --check "\$app\/dist\/electron\/main\.mjs"/u);
  assert.match(ci, /node --check "\$app\/dist\/electron\/preload\.cjs"/u);
  // Headless launch smoke: launch a deterministic binary (not the first `find`
  // hit) and assert the packaged app boots and wires window.frontagent.
  assert.match(ci, /bin=apps\/desktop\/release\/linux-unpacked\/frontagent/u);
  assert.match(ci, /test -x "\$bin"/u);
  assert.match(ci, /FRONTAGENT_SMOKE=1 xvfb-run -a "\$bin" --no-sandbox/u);
  assert.doesNotMatch(ci, /find apps\/desktop\/release.*head -1/u);
  assert.match(ci, /\n\s+ci:\n\s+name:\s+CI\n/u);
  assert.match(ci, /\n\s+needs:\s+\[check,\s*package\]\n/u);
  assert.match(ci, /needs\.check\.result/u);
  assert.match(ci, /needs\.package\.result/u);
  assert.match(contractGuard, /branches:\s*\[develop\]/u);
  assert.match(contractGuard, /pnpm contract:gitnexus/u);
  assert.match(contractGuard, /GITNEXUS_IMPACT_SUMMARY/u);
});

test('desktop app has an unsigned electron-builder packaging path', () => {
  const pkg = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8'));
  const config = readFileSync('apps/desktop/electron-builder.yml', 'utf8');

  // A `package` script symmetric with the CLI bundle and the VSCode VSIX:
  // build first, then an unsigned host-platform (--dir) electron-builder run.
  assert.equal(pkg.scripts.package, 'pnpm run clean && pnpm run build && electron-builder --dir');
  assert.match(pkg.devDependencies['electron-builder'], /^\^?26\./u);
  // The packaged output dir is gitignored, so clean must drop it too.
  assert.equal(pkg.scripts.clean, 'rm -rf dist release');

  // No native node addons in the JS runtime spine → skip the electron-ABI
  // rebuild so CI needs no native toolchain.
  assert.match(config, /npmRebuild:\s*false/u);
  assert.match(config, /output:\s*release/u);
  // Unpacked (no asar) so CI verifies the packaged files directly.
  assert.match(config, /asar:\s*false/u);
  // Deterministic Linux binary name for the CI smoke launch.
  assert.match(config, /executableName:\s*frontagent/u);
  // Packages the renderer + esbuilt main/preload produced by `build`.
  assert.match(config, /dist\/\*\*/u);
});

test('desktop release workflow publishes per-platform zips on version tags', () => {
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  const pkg = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8'));
  const config = readFileSync('apps/desktop/electron-builder.yml', 'utf8');

  // Triggers: version tags publish; pull_request/dispatch build artifacts only.
  assert.match(release, /tags:\s*\['v\*'\]/u);
  assert.match(release, /pull_request:/u);
  assert.match(release, /workflow_dispatch:/u);
  // Build the zip on all three desktop OSes, building the workspace spine first.
  assert.match(release, /os:\s*\[ubuntu-latest,\s*macos-latest,\s*windows-latest\]/u);
  assert.match(release, /pnpm exec turbo build --filter=@frontagent\/desktop/u);
  assert.match(release, /pnpm --filter @frontagent\/desktop run release/u);
  assert.match(release, /actions\/upload-artifact/u);
  // A single publish job (needs: build) attaches all zips on tags, with explicit
  // write permission — the matrix builds never race to write the same Release.
  assert.match(release, /permissions:\s*\n\s*contents:\s*write/u);
  assert.match(release, /needs:\s*build/u);
  assert.match(release, /actions\/download-artifact/u);
  assert.match(release, /softprops\/action-gh-release/u);
  assert.match(release, /if:\s*startsWith\(github\.ref,\s*'refs\/tags\/'\)/u);

  // The release build emits unsigned per-platform zips with stable asset names.
  assert.equal(pkg.scripts.release, 'pnpm run build && electron-builder --publish never');
  assert.match(
    config,
    /artifactName:\s*frontagent-desktop-\$\{version\}-\$\{os\}-\$\{arch\}\.\$\{ext\}/u,
  );
  assert.match(config, /linux:\s*\n\s*target:\s*zip/u);
  assert.match(config, /mac:\s*\n\s*target:\s*zip/u);
  assert.match(config, /win:\s*\n\s*target:\s*zip/u);
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

test('README links the current FrontAgent planner Hugging Face collection', () => {
  const readme = readFileSync('README.md', 'utf8');

  assert.match(
    readme,
    /https:\/\/hf\.co\/collections\/ceilf6\/frontagent-frontend-engineering-agent/u,
  );
  assert.doesNotMatch(readme, /https:\/\/huggingface\.co\/ceilf6\/frontagent-planner-7B-lora/u);
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

  assert.match(repoGuard, /runs-on:\s+ubuntu-latest/u);
  assert.doesNotMatch(repoGuard, /repo-guard-intranet/u);
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
