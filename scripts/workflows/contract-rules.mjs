export const CONTRACT_DIFF_FILTER = 'ACDMRTUXB';

const impactSummaryFields = [
  'Risk level',
  'Critical skeleton changes',
  'GitNexus impact',
  'Verification',
];
const impactSummaryPlaceholders = new Set(['-', 'none', 'n/a', 'na', 'todo', 'tbd', 'pending']);
const riskLevels = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const criticalContractRules = [
  {
    category: 'agent-core',
    testPattern: /^packages\/core\/src\/.*\.test\.tsx?$/u,
    matchesTest: (testFile, changedFile) => {
      if (changedFile.startsWith('packages/core/src/agent/')) {
        return /^packages\/core\/src\/agent\/.*\.test\.tsx?$/u.test(testFile);
      }
      const directTest = changedFile.replace(/\.tsx?$/u, '.test.ts');
      return (
        testFile === directTest || /^packages\/core\/src\/executor\/.*\.test\.tsx?$/u.test(testFile)
      );
    },
    matches: (file) =>
      file.startsWith('packages/core/src/agent/') ||
      file === 'packages/core/src/planner.ts' ||
      file === 'packages/core/src/executor.ts',
  },
  {
    category: 'sdd-workflow',
    testPattern: /^packages\/sdd\/src\/.*\.test\.ts$/u,
    matches: (file) =>
      file.startsWith('packages/sdd/src/') ||
      file === 'docs/design.md' ||
      file === 'docs/architecture.md',
  },
  {
    category: 'memory-boundary',
    testPattern: /^(packages\/mcp-memory\/src|packages\/core\/src\/memory)\/.*\.test\.ts$/u,
    matchesTest: (testFile, changedFile) => {
      if (changedFile.startsWith('packages/mcp-memory/src/')) {
        return /^packages\/mcp-memory\/src\/.*\.test\.ts$/u.test(testFile);
      }
      if (changedFile.startsWith('packages/core/src/memory/')) {
        return /^packages\/core\/src\/memory\/.*\.test\.ts$/u.test(testFile);
      }
      return false;
    },
    matches: (file) =>
      file.startsWith('packages/mcp-memory/src/') || file.startsWith('packages/core/src/memory/'),
  },
  {
    category: 'mcp-boundary',
    testPattern: /^(packages\/mcp-[^/]+|packages\/runtime-node)\/src\/.*\.test\.ts$/u,
    matchesTest: (testFile, changedFile) => {
      const packageRoot = changedFile.match(/^(packages\/(?:mcp-[^/]+|runtime-node))\/src\//u)?.[1];
      return Boolean(
        packageRoot &&
          new RegExp(`^${escapeRegExp(packageRoot)}/src/.*\\.test\\.ts$`, 'u').test(testFile),
      );
    },
    matches: (file) =>
      /^packages\/mcp-[^/]+\/src\//u.test(file) || file.startsWith('packages/runtime-node/src/'),
  },
  {
    category: 'repo-harness',
    testPattern: /^scripts\/tests\//u,
    matches: (file) =>
      file.startsWith('.github/workflows/') ||
      file.startsWith('.github/ISSUE_TEMPLATE/') ||
      file === '.github/PULL_REQUEST_TEMPLATE.md' ||
      file === '.github/CODEOWNERS' ||
      file.startsWith('.claude/workflows/') ||
      file.startsWith('.claude/skills/') ||
      file.startsWith('.githooks/') ||
      file.startsWith('scripts/workflows/'),
  },
  {
    category: 'authority-docs',
    testPattern: /^scripts\/tests\//u,
    matches: (file) =>
      [
        'README.md',
        'AGENTS.md',
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'docs/workflow.md',
        'docs/knowledge-contract.md',
      ].includes(file),
  },
];

export function classifyContractPaths(files) {
  const critical = [];
  const nonCritical = [];

  for (const file of normalizeFiles(files)) {
    const rule = criticalContractRules.find((candidate) => candidate.matches(file));
    if (rule) {
      critical.push({ file, category: rule.category });
    } else {
      nonCritical.push(file);
    }
  }

  return { critical, nonCritical };
}

export function combineChangedFiles(...fileGroups) {
  return normalizeFiles(fileGroups.flatMap((files) => files ?? []));
}

export function evaluateGitNexusContract({
  changedFiles,
  impactSummary = '',
  requireImpactSummary = true,
}) {
  const normalized = normalizeFiles(changedFiles);
  const classification = classifyContractPaths(normalized);
  const reasons = [];
  const warnings = [];
  const suggestions = [
    'Run GitNexus detect_changes to inspect current diff impact.',
    'Use query/context/impact for touched symbols before editing critical skeleton code.',
    'Summarize the GitNexus impact result in the PR self-check.',
  ];

  if (classification.critical.length === 0) {
    warnings.push(
      'No critical contract surface changed; GitNexus analysis is advisory for this diff.',
    );
    return { ok: true, reasons, warnings, suggestions, ...classification };
  }

  for (const item of classification.critical) {
    const rule = criticalContractRules.find((candidate) => candidate.category === item.category);
    if (!rule) continue;
    const hasMatchingTest = normalized.some((file) =>
      rule.matchesTest ? rule.matchesTest(file, item.file) : rule.testPattern.test(file),
    );
    if (!hasMatchingTest) {
      reasons.push(`Missing contract test for critical file: ${item.file}`);
    }
  }

  if (requireImpactSummary) {
    reasons.push(...validateStructuredImpactSummary(impactSummary));
  } else if (isPlaceholder(impactSummary)) {
    warnings.push(
      'Structured GitNexus impact summary is not enforced locally; fill it before opening a PR.',
    );
  } else {
    reasons.push(...validateStructuredImpactSummary(impactSummary));
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
    suggestions,
    ...classification,
  };
}

export function extractImpactSummary(text) {
  const lines = text.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^#{1,6}\s*GitNexus\s*Impact\s*Summary\s*$/iu.test(line.trim()),
  );
  if (headingIndex === -1) return text.trim();

  const section = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^#{1,6}\s+\S/u.test(line.trim())) break;
    section.push(line);
  }
  return section.join('\n').trim();
}

export function validateStructuredImpactSummary(value) {
  const normalized = value.trim();
  if (isPlaceholder(normalized)) {
    return [
      'Missing structured GitNexus impact summary. Fill the PR template fields for critical skeleton changes.',
    ];
  }

  const fields = parseImpactSummaryFields(normalized);
  const reasons = [];
  for (const field of impactSummaryFields) {
    const fieldValue = fields.get(field);
    if (fieldValue === undefined) {
      reasons.push(`Missing GitNexus impact summary field: ${field}`);
    } else if (isPlaceholder(fieldValue)) {
      reasons.push(`GitNexus impact summary field is empty or placeholder: ${field}`);
    }
  }

  const riskLevel = fields.get('Risk level')?.toUpperCase();
  if (riskLevel && !riskLevels.has(riskLevel)) {
    reasons.push('Invalid GitNexus risk level. Use LOW, MEDIUM, HIGH, or CRITICAL.');
  }

  const impact = fields.get('GitNexus impact')?.toLowerCase();
  if (
    impact &&
    (!impact.includes('detect_changes') || !/\b(query|context|impact)\b/u.test(impact))
  ) {
    reasons.push('GitNexus impact must mention detect_changes and one of query/context/impact.');
  }

  return reasons;
}

function parseImpactSummaryFields(value) {
  const fields = new Map();
  for (const line of value.split(/\r?\n/)) {
    const match = /^\s*(?:[-*]\s*)?(?:\*\*)?([^:*：]+?)(?:\*\*)?\s*[:：]\s*(.*)\s*$/u.exec(line);
    if (match) fields.set(match[1].trim(), match[2].trim());
  }
  return fields;
}

function isPlaceholder(value) {
  return !value.trim() || impactSummaryPlaceholders.has(value.trim().toLowerCase());
}

function normalizeFiles(files) {
  return [...new Set((files ?? []).map((file) => file.replaceAll('\\', '/')).filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
