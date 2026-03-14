/**
 * Code Quality SubAgent
 * 基于 A2A 协议对生成代码做质量评估
 */

import type { SDDConfig } from "@frontagent/shared";
import { generateId } from "@frontagent/shared";
import type { A2AAgent, A2ARequest, A2AResponse } from "../a2a.js";

// 输入路径，内容
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

export class CodeQualitySubAgent implements A2AAgent<
  CodeQualityReviewRequest,
  CodeQualityReviewResponse
> {
  // 注册时需要的信息：ID, intent
  readonly agentId = "subagent.code-quality";
  readonly capabilities = ["code_quality.review_generated_files"];

  // 请求处理入口
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

    const issues: CodeQualityIssue[] = [];
    for (const file of payload.files) {
      issues.push(...this.evaluateFile(file, payload.sddConfig));
    }

    const errorCount = issues.filter(
      (issue) => issue.severity === "error",
    ).length;
    const warningCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;
    const score = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

    const review: CodeQualityReviewResponse = {
      passed: errorCount === 0,
      score,
      summary: `CodeQualitySubAgent reviewed ${payload.files.length} file(s): ${errorCount} error(s), ${warningCount} warning(s), score ${score}/100.`,
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

  // 私密函数：质量检查逻辑
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

    if (forbiddenPatterns.length > 0) {
      for (const pattern of forbiddenPatterns) {
        let regex: RegExp;
        try {
          regex = new RegExp(pattern);
        } catch {
          // 非法正则直接跳过，避免中断评估流程
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

    // function foo(a, b) {}
    const functionDeclarationRegex =
      /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{/gm;
    // const foo = (a, b) => {}
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

    if (!cleaned) return 0;

    return cleaned
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean).length;
  }

  /**
   * 粗略估算函数体行数：
   * 从函数声明行开始，按大括号平衡找到结束位置
   */
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
    let endLine = startLine;

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
            endLine = i + 1;
            return endLine - startLine + 1;
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
