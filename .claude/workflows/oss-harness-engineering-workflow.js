export const meta = {
  name: 'oss-harness-engineering-workflow',
  description: 'Research and synthesize a portable OSS Harness engineering workflow for FrontAgent',
  phases: [
    {
      title: 'Research',
      detail:
        'Parallel readers inspect current repo docs, contract scripts, and any maintainer-provided Harness reference',
    },
    {
      title: 'Synthesize',
      detail: 'Compare workflow options and produce an OSS community Harness workflow',
    },
    {
      title: 'Critique',
      detail:
        'Adversarially check for training-camp leakage, unsupported claims, and missing gates',
    },
  ],
};

const EVIDENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          implication: { type: 'string' },
        },
        required: ['claim', 'evidence', 'implication'],
      },
    },
    exclusions: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['scope', 'findings', 'exclusions', 'openQuestions'],
};

const WORKFLOW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    workflow: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          phase: { type: 'string' },
          goal: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { type: 'string' } },
          gate: { type: 'string' },
        },
        required: ['phase', 'goal', 'actions', 'evidence', 'gate'],
      },
    },
    approachesCompared: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          tradeoff: { type: 'string' },
          recommendation: { type: 'boolean' },
        },
        required: ['name', 'tradeoff', 'recommendation'],
      },
    },
    doNotInclude: { type: 'array', items: { type: 'string' } },
    saveablePromptNotes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'title',
    'summary',
    'workflow',
    'approachesCompared',
    'doNotInclude',
    'saveablePromptNotes',
  ],
};

const CRITIQUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['accept', 'revise'] },
    issues: { type: 'array', items: { type: 'string' } },
    missing: { type: 'array', items: { type: 'string' } },
    correctedGuidance: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'issues', 'missing', 'correctedGuidance'],
};

export default async function runOssHarnessEngineeringWorkflow() {
  phase('Research');
  const research = await parallel([
    () =>
      agent(
        "Read and summarize FrontAgent's public workflow, OSS, and Harness documentation. Use GitNexus query/context where useful, and read relevant docs such as README.md, CONTRIBUTING.md, docs/workflow.md, docs/knowledge-contract.md, docs/architecture.md, docs/design.md, AGENTS.md, CLAUDE.md, and package scripts. Do not edit files. Return claims with path:line evidence. Focus on what a reusable OSS Harness engineering workflow should require.",
        { label: 'frontagent-docs', phase: 'Research', schema: EVIDENCE_SCHEMA },
      ),
    () =>
      agent(
        'Inspect the current FrontAgent repository implementation for Harness engineering gates and contracts: scripts/workflows, tests, quality scripts, GitNexus contract guard, and related phase checks if relevant. Use GitNexus tools before reading symbols when appropriate, but do not edit. Return claims with path:line evidence and implications for workflow design.',
        { label: 'frontagent-code', phase: 'Research', schema: EVIDENCE_SCHEMA },
      ),
    () =>
      agent(
        'If the task provides a public URL, branch, or local path for prior Harness research, study only the reusable Harness engineering material. Explicitly exclude training-camp claims, score labels, progress ledgers, timeout-close automation, comment-triggered auto-merge, and cohort or competition workflow. If no reference is provided, rely on in-repository evidence only. Do not edit. Return claims with path:line evidence, and list excluded non-OSS materials.',
        { label: 'harness-reference', phase: 'Research', schema: EVIDENCE_SCHEMA },
      ),
    () =>
      agent(
        'Review the gathered evidence from the perspective of what not to carry into an OSS community Harness workflow. Identify non-OSS mechanisms to exclude, and neutral Harness practices that are safe to keep. Do not edit. Return claims with path:line evidence.',
        { label: 'oss-exclusions', phase: 'Research', schema: EVIDENCE_SCHEMA },
      ),
  ]);

  phase('Synthesize');
  const synthesis = await agent(
    `Using the following research JSON, synthesize a concise but actionable Harness engineering workflow suitable for saving later as a project workflow. The workflow must be for open-source community work, not training camp. Compare 2-3 possible workflow shapes, recommend one, and include phases, gates, evidence expected, and explicit exclusions. Research: ${JSON.stringify(research.filter(Boolean))}`,
    { label: 'workflow-synthesis', phase: 'Synthesize', schema: WORKFLOW_SCHEMA },
  );

  phase('Critique');
  const critique = await agent(
    `Adversarially review this proposed OSS Harness workflow. Try to find unsupported claims, missing gates from the current repository instructions, ambiguity, and any leakage of training-camp-specific concepts. Return accept/revise and corrected guidance. Proposed workflow: ${JSON.stringify(synthesis)} Research: ${JSON.stringify(research.filter(Boolean))}`,
    { label: 'oss-scope-critic', phase: 'Critique', schema: CRITIQUE_SCHEMA },
  );

  return { research: research.filter(Boolean), synthesis, critique };
}
