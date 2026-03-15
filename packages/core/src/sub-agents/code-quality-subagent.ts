/**
 * Code Quality SubAgent
 * Uses A2A protocol for generated code quality evaluation
 * LLM review first, rule-based checks as fallback
 */

import type { SDDConfig } from "@frontagent/shared";
import { generateId } from "@frontagent/shared";
import type { A2AAgent, A2ARequest, A2AResponse } from "../a2a.js";
import type { LLMService } from "../llm.js";
import type {
  ProjectFactsSnapshot,
  ProjectFactsUpdate,
} from "../types.js";
import { z } from "zod";

export interface CodeQualityReviewFile {
  path: string;
  content: string;
}

export interface CodeQualityIssue {
  severity: "error" | "warning";
  filePath: string;
  line?: number;
  rule: string;
  message: string;
  suggestion?: string;
}

export interface CodeQualityReviewRequest {
  taskId: string;
  phase: string;
  files: CodeQualityReviewFile[];
  sddConfig?: SDDConfig;
  sharedFacts?: ProjectFactsSnapshot;
}

export interface CodeQualityReviewResponse {
  passed: boolean;
  score: number;
  summary: string;
  issues: CodeQualityIssue[];
  factUpdates?: ProjectFactsUpdate;
}

export interface CodeQualitySubAgentOptions {
  llmService?: LLMService;
  enableRuleFallback?: boolean;
  maxFilesForLLM?: number;
  maxCharsPerFileForLLM?: number;
  debug?: boolean;
}

export class CodeQualitySubAgent implements A2AAgent<
  CodeQualityReviewRequest,
  CodeQualityReviewResponse
> {
  // a2a 协议中 Id
  readonly agentId = "subagent.code-quality";
  // 角色扮演
  readonly capabilities = ["code_quality.review_generated_files"];

  // === 配置区
  // TODO: 等未来token便宜之后取消规则函数与无关配置
  private readonly llmService?: LLMService; // 启动LLM评估
  private readonly enableRuleFallback: boolean; // 规则函数检查
  private readonly maxFilesForLLM: number; // LLM评估最多文件数
  private readonly maxCharsPerFileForLLM: number; // 上下文上限
  private readonly debug: boolean; // 失败日志

  constructor(options: CodeQualitySubAgentOptions = {}) {
    this.llmService = options.llmService;
    this.enableRuleFallback = options.enableRuleFallback ?? true;
    this.maxFilesForLLM = options.maxFilesForLLM ?? 6;
    this.maxCharsPerFileForLLM = options.maxCharsPerFileForLLM ?? 12000;
    this.debug = options.debug ?? false;
  }

  async handleRequest(
    request: A2ARequest<CodeQualityReviewRequest>,
  ): Promise<A2AResponse<CodeQualityReviewResponse>> {
    if (request.intent !== "code_quality.review_generated_files") {
      return this.errorResponse(
        request,
        `Unsupported intent: ${request.intent}`,
      );
    }

    const payload = request.payload;
    if (!payload || !Array.isArray(payload.files)) {
      return this.errorResponse(
        request,
        "Invalid request payload: files is required",
      );
    }

    const ruleIssues: CodeQualityIssue[] = [];
    if (this.enableRuleFallback) {
      for (const file of payload.files) {
        ruleIssues.push(...this.evaluateFile(file, payload.sddConfig));
      }
    }

    let llmIssues: CodeQualityIssue[] = [];
    let llmSummary: string | undefined;

    if (this.llmService) {
      try {
        const llmReview = await this.evaluateWithLLM(payload);
        llmIssues = llmReview.issues;
        llmSummary = llmReview.summary;
      } catch (error) {
        if (this.debug) {
          console.warn(
            "[CodeQualitySubAgent] LLM review failed, fallback to rule-based issues:",
            error,
          );
        }
      }
    }

    const issues = this.mergeIssues(llmIssues, ruleIssues);

    const errorCount = issues.filter(
      (issue) => issue.severity === "error",
    ).length;
    const warningCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;
    const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

    const summary = llmSummary
      ? `${llmSummary} (merged with ${ruleIssues.length} rule issue(s))`
      : `CodeQualitySubAgent reviewed ${payload.files.length} file(s): ${errorCount} error(s), ${warningCount} warning(s), score ${score}/100.`;

    const review: CodeQualityReviewResponse = {
      passed: errorCount === 0,
      score,
      summary,
      issues,
      factUpdates: this.buildFactUpdates(payload, issues),
    };

    return {
      protocol: "A2A",
      version: "1.0",
      kind: "response",
      messageId: generateId("a2a-res"),
      inReplyTo: request.messageId,
      timestamp: Date.now(),
      from: this.agentId,
      to: request.from,
      intent: request.intent,
      success: true,
      payload: review,
    };
  }

  private async evaluateWithLLM(
    payload: CodeQualityReviewRequest,
  ): Promise<{ summary: string; issues: CodeQualityIssue[] }> {
    if (!this.llmService) {
      return { summary: "LLM review disabled.", issues: [] };
    }

    const reviewSchema = z.object({
      summary: z.string(),
      issues: z.array(
        z.object({
          severity: z.enum(["error", "warning"]),
          filePath: z.string(),
          line: z.number().int().positive().optional(),
          rule: z.string(),
          message: z.string(),
          suggestion: z.string().optional(),
        }),
      ),
    });

    const filesForLLM = payload.files
      .slice(0, this.maxFilesForLLM)
      .map((file) => ({
        path: file.path,
        content: this.truncateFileContent(file.content),
      }));

    const sddSummary = this.buildSddSummary(payload.sddConfig);
    const sharedFactsSummary = this.summarizeSharedFacts(payload.sharedFacts);

    const userPrompt = [
      `Task ID: ${payload.taskId}`,
      `Phase: ${payload.phase}`,
      "",
      "SDD constraints summary:",
      sddSummary,
      "",
      "Shared project facts snapshot:",
      sharedFactsSummary,
      "",
      "Files to review:",
      JSON.stringify(filesForLLM, null, 2),
      "",
      "Return concrete issues with filePath/line/rule/message.",
    ].join("\n");

    const llmResult = await this.llmService.generateObject({
      system: [
        "You are a strict code quality review sub-agent.",
        "Evaluate generated code against SDD constraints and maintainability.",
        "Output only actionable issues.",
        "Set severity=error only for clear correctness or hard-constraint violations.",
      ].join(" "),
      messages: [{ role: "user", content: userPrompt }],
      schema: reviewSchema,
      temperature: 0.1,
      maxTokens: 3000,
    });

    return {
      summary: llmResult.summary,
      issues: llmResult.issues.map((issue) => ({
        severity: issue.severity,
        filePath: issue.filePath,
        line: issue.line,
        rule: issue.rule,
        message: issue.message,
        suggestion: issue.suggestion,
      })),
    };
  }

  private evaluateFile(
    file: CodeQualityReviewFile,
    sddConfig?: SDDConfig,
  ): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];
    const lines = file.content.split("\n");

    const maxFileLines = sddConfig?.codeQuality.maxFileLines ?? 400;
    const maxFunctionLines = sddConfig?.codeQuality.maxFunctionLines ?? 80;
    const maxParameters = sddConfig?.codeQuality.maxParameters ?? 5;
    const forbiddenPatterns = sddConfig?.codeQuality.forbiddenPatterns ?? [];

    if (lines.length > maxFileLines) {
      issues.push({
        severity: "warning",
        filePath: file.path,
        rule: "max_file_lines",
        message: `File has ${lines.length} lines, exceeds limit ${maxFileLines}.`,
        suggestion: "Split file into smaller modules.",
      });
    }

    for (const pattern of forbiddenPatterns) {
      let regex: RegExp;
      try {
        regex = new RegExp(pattern);
      } catch {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          issues.push({
            severity: "error",
            filePath: file.path,
            line: i + 1,
            rule: "forbidden_pattern",
            message: `Forbidden pattern "${pattern}" found.`,
            suggestion: "Remove or replace this pattern.",
          });
        }
        regex.lastIndex = 0;
      }
    }

    const candidates = this.extractFunctionCandidates(file.content);
    for (const fn of candidates) {
      if (fn.parameterCount > maxParameters) {
        issues.push({
          severity: "warning",
          filePath: file.path,
          line: fn.line,
          rule: "max_parameters",
          message: `Function "${fn.name}" has ${fn.parameterCount} parameters, exceeds limit ${maxParameters}.`,
          suggestion: "Use an options object or split responsibilities.",
        });
      }

      const estimatedLines = this.estimateFunctionBodyLines(lines, fn.line);
      if (estimatedLines !== null && estimatedLines > maxFunctionLines) {
        issues.push({
          severity: "warning",
          filePath: file.path,
          line: fn.line,
          rule: "max_function_lines",
          message: `Function "${fn.name}" has ${estimatedLines} lines, exceeds limit ${maxFunctionLines}.`,
          suggestion: "Extract helper functions to reduce complexity.",
        });
      }
    }

    return issues;
  }

  private buildSddSummary(sddConfig?: SDDConfig): string {
    if (!sddConfig) {
      return "No SDD config provided.";
    }

    return [
      `maxFileLines=${sddConfig.codeQuality.maxFileLines}`,
      `maxFunctionLines=${sddConfig.codeQuality.maxFunctionLines}`,
      `maxParameters=${sddConfig.codeQuality.maxParameters}`,
      `forbiddenPatterns=${sddConfig.codeQuality.forbiddenPatterns.join(", ") || "(none)"}`,
      `forbiddenPackages=${sddConfig.techStack.forbiddenPackages.join(", ") || "(none)"}`,
    ].join("\n");
  }

  private summarizeSharedFacts(sharedFacts?: ProjectFactsSnapshot): string {
    if (!sharedFacts) {
      return "No shared facts provided.";
    }

    const existingFiles = sharedFacts.filesystem.existingFiles.slice(0, 20);
    const missingPackages = sharedFacts.dependencies.missingPackages.slice(0, 20);
    const installedPackages = sharedFacts.dependencies.installedPackages.slice(0, 30);
    const recentErrors = sharedFacts.errors.slice(-5);

    return [
      `revision=${sharedFacts.revision}`,
      `existingFiles(${sharedFacts.filesystem.existingFiles.length})=${existingFiles.join(", ") || "(none)"}`,
      `installedPackages(${sharedFacts.dependencies.installedPackages.length})=${installedPackages.join(", ") || "(none)"}`,
      `missingPackages(${sharedFacts.dependencies.missingPackages.length})=${missingPackages.join(", ") || "(none)"}`,
      `moduleCount=${Object.keys(sharedFacts.moduleDependencyGraph.modules).length}`,
      `recentErrors=${recentErrors.map(err => `[${err.type}] ${err.message}`).join(" | ") || "(none)"}`,
    ].join("\n");
  }

  private buildFactUpdates(
    payload: CodeQualityReviewRequest,
    issues: CodeQualityIssue[],
  ): ProjectFactsUpdate | undefined {
    const sharedFacts = payload.sharedFacts;
    if (!sharedFacts) {
      return undefined;
    }

    const installedPackages = new Set(sharedFacts.dependencies.installedPackages);
    const knownMissingPackages = new Set(sharedFacts.dependencies.missingPackages);

    const usedExternalPackages = this.collectExternalPackages(payload.files);
    const detectedMissingPackages: string[] = [];

    for (const pkg of usedExternalPackages) {
      if (!installedPackages.has(pkg) && !knownMissingPackages.has(pkg)) {
        detectedMissingPackages.push(pkg);
      }
    }

    const blockingIssues = issues
      .filter(issue => issue.severity === "error")
      .slice(0, 10)
      .map(issue => ({
        stepId: `subagent-code-quality:${payload.phase}`,
        type: "code_quality",
        message: `${issue.filePath}${issue.line ? `:${issue.line}` : ""} [${issue.rule}] ${issue.message}`,
        timestamp: Date.now(),
      }));

    const hasChanges =
      detectedMissingPackages.length > 0 ||
      blockingIssues.length > 0;

    if (!hasChanges) {
      return undefined;
    }

    return {
      baseRevision: sharedFacts.revision,
      source: this.agentId,
      timestamp: Date.now(),
      changes: {
        addMissingPackages: detectedMissingPackages,
        addErrors: blockingIssues,
      },
    };
  }

  private collectExternalPackages(files: CodeQualityReviewFile[]): string[] {
    const packages = new Set<string>();
    const importRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    for (const file of files) {
      let match: RegExpExecArray | null;

      while ((match = importRegex.exec(file.content)) !== null) {
        const maybePackage = this.normalizeExternalPackageName(match[1]);
        if (maybePackage) {
          packages.add(maybePackage);
        }
      }
      importRegex.lastIndex = 0;

      while ((match = requireRegex.exec(file.content)) !== null) {
        const maybePackage = this.normalizeExternalPackageName(match[1]);
        if (maybePackage) {
          packages.add(maybePackage);
        }
      }
      requireRegex.lastIndex = 0;
    }

    return Array.from(packages);
  }

  private normalizeExternalPackageName(specifier: string): string | null {
    if (
      !specifier ||
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      specifier.startsWith("@/")
    ) {
      return null;
    }

    if (specifier.startsWith("@")) {
      const parts = specifier.split("/");
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
      return specifier;
    }

    return specifier.split("/")[0];
  }

  private truncateFileContent(content: string): string {
    if (content.length <= this.maxCharsPerFileForLLM) {
      return content;
    }
    return `${content.slice(0, this.maxCharsPerFileForLLM)}\n/* truncated */`;
  }

  private mergeIssues(
    primary: CodeQualityIssue[],
    secondary: CodeQualityIssue[],
  ): CodeQualityIssue[] {
    const result: CodeQualityIssue[] = [];
    const seen = new Set<string>();

    for (const issue of [...primary, ...secondary]) {
      const key = `${issue.severity}|${issue.filePath}|${issue.line ?? 0}|${issue.rule}|${issue.message}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(issue);
    }

    return result;
  }

  private extractFunctionCandidates(content: string): Array<{
    name: string;
    line: number;
    parameterCount: number;
  }> {
    const candidates: Array<{
      name: string;
      line: number;
      parameterCount: number;
    }> = [];

    const functionDeclarationRegex =
      /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{/gm;
    const arrowFunctionRegex =
      /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>\s*\{/gm;

    let match: RegExpExecArray | null;
    while ((match = functionDeclarationRegex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split("\n").length;
      candidates.push({
        name: match[1] || "anonymous",
        line,
        parameterCount: this.countParameters(match[2] || ""),
      });
    }

    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      const line = content.slice(0, match.index).split("\n").length;
      candidates.push({
        name: match[1] || "anonymous",
        line,
        parameterCount: this.countParameters(match[2] || match[3] || ""),
      });
    }

    return candidates;
  }

  private countParameters(paramText: string): number {
    const cleaned = paramText.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!cleaned) {
      return 0;
    }

    return cleaned
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  private estimateFunctionBodyLines(
    lines: string[],
    startLine: number,
  ): number | null {
    const startIndex = startLine - 1;
    if (startIndex < 0 || startIndex >= lines.length) {
      return null;
    }

    let started = false;
    let depth = 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") {
          depth--;
          if (started && depth === 0) {
            return i + 1 - startLine + 1;
          }
        }
      }
    }

    return null;
  }

  private errorResponse(
    request: A2ARequest<CodeQualityReviewRequest>,
    message: string,
  ): A2AResponse<CodeQualityReviewResponse> {
    return {
      protocol: "A2A",
      version: "1.0",
      kind: "response",
      messageId: generateId("a2a-res"),
      inReplyTo: request.messageId,
      timestamp: Date.now(),
      from: this.agentId,
      to: request.from,
      intent: request.intent,
      success: false,
      error: message,
    };
  }
}
