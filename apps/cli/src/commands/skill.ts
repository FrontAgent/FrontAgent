import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import { SkillLab, type SkillLabConfig } from '@frontagent/core';
import { resolveBuiltInSkillRoots, resolveLLMConfigFromOptions } from '../bootstrap.js';

function createSkillLabFromCli(
  projectRoot: string,
  options: {
    outputRoot?: string;
    debug?: boolean;
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    maxTokens?: string;
    temperature?: string;
    topP?: string;
    topK?: string;
  },
  requireLlm: boolean,
): SkillLab {
  const config: SkillLabConfig = {
    projectRoot,
    outputRoot: options.outputRoot ? resolve(projectRoot, options.outputRoot) : undefined,
    skillContent: {
      builtInSkillRoots: resolveBuiltInSkillRoots(),
    },
    debug: options.debug,
  };

  if (requireLlm) {
    config.llm = resolveLLMConfigFromOptions(options);
  }

  return new SkillLab(config);
}

export function registerSkillCommand(parent: Command) {
  const skillCommand = parent
    .command('skill')
    .description('管理内容技能与 Skill Lab 自我迭代流程');

  skillCommand
    .command('list')
    .description('列出当前可见的内容技能')
    .option('-o, --output-root <path>', 'Skill Lab 输出目录')
    .action((options) => {
      const skillLab = createSkillLabFromCli(process.cwd(), options, false);
      const skills = skillLab.listSkills();

      if (skills.length === 0) {
        console.log(chalk.yellow('未找到任何内容技能'));
        return;
      }

      console.log(chalk.cyan('\n🧩 可见内容技能\n'));
      for (const skill of skills) {
        console.log(chalk.white(`- ${skill.name}`));
        console.log(chalk.gray(`  ${skill.description || '(无描述)'}`));
        console.log(chalk.gray(`  source=${skill.source}`));
        console.log(chalk.gray(`  path=${skill.skillFilePath}`));
      }
    });

  skillCommand
    .command('scaffold')
    .description('创建一个新的内容技能骨架')
    .argument('<skill-name>', 'skill 名称')
    .option('-d, --description <text>', 'skill 描述')
    .option('-f, --force', '覆盖已有 skill 目录', false)
    .action((skillName, options) => {
      const spinner = ora(`正在创建 skill ${skillName}...`).start();

      try {
        const skillLab = createSkillLabFromCli(process.cwd(), options, false);
        const result = skillLab.scaffoldSkill(skillName, options.description, Boolean(options.force));
        spinner.succeed(`已创建 skill 骨架: ${result.skillDir}`);
        console.log(chalk.gray(`   SKILL.md: ${result.skillFilePath}`));
        console.log(chalk.gray(`   agents/openai.yaml: ${result.agentConfigPath}`));
        console.log(chalk.gray(`   下一步建议: frontagent skill init-evals ${skillName}`));
      } catch (error) {
        spinner.fail('创建失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  skillCommand
    .command('init-evals')
    .description('为指定 skill 生成 trigger eval starter suite')
    .argument('<skill-name>', 'skill 名称')
    .option('-o, --output <path>', 'trigger eval 输出路径')
    .option('-r, --output-root <path>', 'Skill Lab 输出目录')
    .option('-f, --force', '覆盖已有 eval 文件', false)
    .action((skillName, options) => {
      const spinner = ora(`正在为 ${skillName} 初始化 trigger evals...`).start();

      try {
        const skillLab = createSkillLabFromCli(process.cwd(), options, false);
        const result = skillLab.initTriggerEvals(skillName, options.output, Boolean(options.force));
        spinner.succeed(`已生成 trigger evals: ${result.evalSuitePath}`);
        console.log(chalk.gray(`   Cases: ${result.suite.cases.length}`));
        console.log(chalk.gray('   这是 starter suite，建议先按真实业务 prompt 编辑后再 benchmark。'));
      } catch (error) {
        spinner.fail('初始化失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  skillCommand
    .command('init-behavior-evals')
    .description('为指定 skill 生成 behavior eval starter suite')
    .argument('<skill-name>', 'skill 名称')
    .option('-o, --output <path>', 'behavior eval 输出路径')
    .option('-r, --output-root <path>', 'Skill Lab 输出目录')
    .option('-f, --force', '覆盖已有 eval 文件', false)
    .action((skillName, options) => {
      const spinner = ora(`正在为 ${skillName} 初始化 behavior evals...`).start();

      try {
        const skillLab = createSkillLabFromCli(process.cwd(), options, false);
        const result = skillLab.initBehaviorEvals(skillName, options.output, Boolean(options.force));
        spinner.succeed(`已生成 behavior evals: ${result.evalSuitePath}`);
        console.log(chalk.gray(`   Cases: ${result.suite.cases.length}`));
        console.log(chalk.gray('   这是 starter suite，建议按真实任务补齐 checks 后再用于 improve。'));
      } catch (error) {
        spinner.fail('初始化失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  const llmOptions = (cmd: Command) =>
    cmd
      .option('--provider <provider>', 'LLM 提供商 (openai/anthropic)')
      .option('--model <model>', 'LLM 模型')
      .option('--base-url <url>', 'LLM API 基础 URL')
      .option('--api-key <key>', 'LLM API Key')
      .option('--max-tokens <tokens>', '最大 token 数')
      .option('--temperature <temp>', '温度参数')
      .option('--top-p <n>', 'Nucleus sampling (top_p)')
      .option('--top-k <n>', 'Top-k sampling');

  llmOptions(
    skillCommand
      .command('benchmark')
      .description('运行指定 skill 的 benchmark（trigger，可选 behavior）')
      .argument('<skill-name>', 'skill 名称')
      .option('-e, --eval <path>', 'trigger eval JSON 路径')
      .option('-b, --behavior', '同时运行 behavior eval（默认读取 skill-lab 内 behavior-evals.json）', false)
      .option('--behavior-eval <path>', 'behavior eval JSON 路径')
      .option('-r, --output-root <path>', 'Skill Lab 输出目录')
      .option('--debug', '启用调试模式', false),
  ).action(async (skillName, options) => {
    const spinner = ora(`正在 benchmark ${skillName}...`).start();

    try {
      const includeBehaviorEval = Boolean(options.behavior || options.behaviorEval);
      const skillLab = createSkillLabFromCli(process.cwd(), options, includeBehaviorEval);
      const result = await skillLab.benchmarkSkill(skillName, {
        evalSuitePath: options.eval,
        includeBehaviorEval,
        behaviorEvalSuitePath: options.behaviorEval,
      });
      spinner.succeed(`Benchmark 完成: ${(result.benchmark.summary.passRate * 100).toFixed(1)}%`);
      console.log(chalk.gray(`   Output JSON: ${result.outputPath}`));
      console.log(chalk.gray(`   Summary MD: ${result.summaryPath}`));
      console.log(chalk.gray(`   False Positives: ${result.benchmark.summary.falsePositives}`));
      console.log(chalk.gray(`   False Negatives: ${result.benchmark.summary.falseNegatives}`));
      if (result.behaviorBenchmark) {
        console.log(chalk.cyan('\n🧪 Behavior Benchmark'));
        console.log(chalk.gray(`   Behavior Cases: ${result.behaviorBenchmark.summary.totalCases}`));
        console.log(chalk.gray(`   Behavior Pass Rate: ${(result.behaviorBenchmark.summary.passRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Check Pass Rate: ${(result.behaviorBenchmark.summary.checkPassRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Score Rate: ${(result.behaviorBenchmark.summary.scoreRate * 100).toFixed(1)}%`));
        if (result.behaviorOutputPath) {
          console.log(chalk.gray(`   Behavior JSON: ${result.behaviorOutputPath}`));
        }
      }
    } catch (error) {
      spinner.fail('Benchmark 失败');
      console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
    }
  });

  llmOptions(
    skillCommand
      .command('improve')
      .description('基于 eval 自动生成候选 skill，并与基线对比（trigger，可选 behavior）')
      .argument('<skill-name>', 'skill 名称')
      .option('-e, --eval <path>', 'trigger eval JSON 路径')
      .option('-b, --behavior', '同时运行 behavior eval 并纳入改进判定', false)
      .option('--behavior-eval <path>', 'behavior eval JSON 路径')
      .option('-r, --output-root <path>', 'Skill Lab 输出目录')
      .option('--apply-if-better', '若候选优于基线则自动覆盖原 skill', false)
      .option('-f, --force', '即使基线已满分也强制生成候选', false)
      .option('--debug', '启用调试模式', false),
  ).action(async (skillName, options) => {
    const spinner = ora(`正在改进 ${skillName}...`).start();

    try {
      const skillLab = createSkillLabFromCli(process.cwd(), options, true);
      const result = await skillLab.improveSkill(skillName, {
        evalSuitePath: options.eval,
        includeBehaviorEval: Boolean(options.behavior || options.behaviorEval),
        behaviorEvalSuitePath: options.behaviorEval,
        applyIfBetter: Boolean(options.applyIfBetter),
        force: Boolean(options.force),
      });

      spinner.succeed(`候选 skill 已生成: ${result.candidateId}`);
      console.log(chalk.gray(`   Candidate Root: ${result.candidateRoot}`));
      console.log(chalk.gray(`   Candidate Skill: ${result.candidateSkillDir}`));
      console.log(chalk.gray(`   Baseline Pass Rate: ${(result.baseline.summary.passRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Candidate Pass Rate: ${(result.candidate.summary.passRate * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Improved: ${result.comparison.improved ? 'yes' : 'no'}`));
      console.log(chalk.gray(`   Benchmark JSON: ${result.benchmarkPath}`));
      console.log(chalk.gray(`   Summary MD: ${result.summaryPath}`));
      if (result.baselineBehavior && result.candidateBehavior) {
        console.log(chalk.cyan('\n🧪 Behavior Comparison'));
        console.log(chalk.gray(`   Baseline Score Rate: ${(result.baselineBehavior.summary.scoreRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Candidate Score Rate: ${(result.candidateBehavior.summary.scoreRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Baseline Check Pass: ${(result.baselineBehavior.summary.checkPassRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Candidate Check Pass: ${(result.candidateBehavior.summary.checkPassRate * 100).toFixed(1)}%`));
        console.log(chalk.gray(`   Behavior Improved: ${result.comparison.behavior?.improved ? 'yes' : 'no'}`));
      }

      if (result.changes.length > 0) {
        console.log(chalk.cyan('\n📝 Candidate Changes'));
        for (const change of result.changes) {
          console.log(chalk.gray(`   - ${change}`));
        }
      }

      if (result.applied) {
        console.log(chalk.green('\n✅ Candidate 已自动应用到原 skill'));
        if (result.backupPath) {
          console.log(chalk.gray(`   Backup: ${result.backupPath}`));
        }
      } else {
        console.log(chalk.yellow('\nℹ️ Candidate 未自动应用，可用 promote 命令手动提升。'));
      }
    } catch (error) {
      spinner.fail('改进失败');
      console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
    }
  });

  skillCommand
    .command('promote')
    .description('将某个候选 skill 提升为当前项目 skill')
    .argument('<skill-name>', 'skill 名称')
    .argument('<candidate-id>', '候选版本 ID')
    .option('-r, --output-root <path>', 'Skill Lab 输出目录')
    .action((skillName, candidateId, options) => {
      const spinner = ora(`正在应用候选 ${candidateId} 到 ${skillName}...`).start();

      try {
        const skillLab = createSkillLabFromCli(process.cwd(), options, false);
        const result = skillLab.promoteCandidate(skillName, candidateId);
        spinner.succeed(`已应用候选 ${candidateId}`);
        console.log(chalk.gray(`   Target: ${result.targetPath}`));
        console.log(chalk.gray(`   Backup: ${result.backupPath}`));
      } catch (error) {
        spinner.fail('应用失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
