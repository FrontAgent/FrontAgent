/**
 * Code Quality SubAgent
 * Uses A2A protocol for generated code quality evaluation
 * LLM review first, rule-based checks as fallback
 */

import type { SDDConfig } from "@frontagent/shared";
import { generateId } from "@frontagent/shared";
import type { A2AAgent, A2ARequest, A2AResponse } from "../a2a.js";
import type { LLMService } from "../llm.js";
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
}

export interface CodeQualityReviewResponse {
  passed: boolean;
  score: number;
  summary: string;
  issues: CodeQualityIssue[];
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

    const userPrompt = [
      `Task ID: ${payload.taskId}`,
      `Phase: ${payload.phase}`,
      "",
      "SDD constraints summary:",
      sddSummary,
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
