/**
 * Process-isolated Code Quality SubAgent bridge
 * Executes code-quality evaluation in a separate Node.js process.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateId } from "@frontagent/shared";
import {
  A2A_PROTOCOL_NAME,
  A2A_PROTOCOL_VERSION,
  type A2AAgent,
  type A2ARequest,
  type A2AResponse,
} from "../a2a.js";
import type { LLMConfig } from "../types.js";
import type {
  CodeQualityReviewRequest,
  CodeQualityReviewResponse,
} from "./code-quality-subagent.js";

interface WorkerInput {
  request: A2ARequest<CodeQualityReviewRequest>;
  llmConfig?: LLMConfig;
  options: {
    enableLLMReview: boolean;
    enableRuleFallback: boolean;
    maxFilesForLLM?: number;
    maxCharsPerFileForLLM?: number;
    debug: boolean;
  };
}

function resolveDefaultWorkerPath(): string {
  // When the CLI is bundled to dist/index.cjs, the worker is emitted next to it.
  if (typeof __dirname !== "undefined") {
    const bundledCandidate = join(__dirname, "code-quality-subagent-worker.cjs");
    if (existsSync(bundledCandidate)) {
      return bundledCandidate;
    }
  }

  const moduleUrl = import.meta.url;
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const esmCandidate = join(moduleDir, "code-quality-subagent-worker.js");
  if (existsSync(esmCandidate)) {
    return esmCandidate;
  }

  if (typeof __dirname !== "undefined") {
    return join(__dirname, "code-quality-subagent-worker.cjs");
  }

  return esmCandidate;
}

export interface ProcessIsolatedCodeQualitySubAgentOptions {
  llmConfig: LLMConfig;
  enableLLMReview?: boolean;
  enableRuleFallback?: boolean;
  maxFilesForLLM?: number;
  maxCharsPerFileForLLM?: number;
  timeoutMs?: number;
  debug?: boolean;
  workerPath?: string;
}

export class ProcessIsolatedCodeQualitySubAgent
  implements A2AAgent<CodeQualityReviewRequest, CodeQualityReviewResponse>
{
  readonly agentId = "subagent.code-quality";
  readonly capabilities = ["code_quality.review_generated_files"];

  private readonly llmConfig: LLMConfig;
  private readonly enableLLMReview: boolean;
  private readonly enableRuleFallback: boolean;
  private readonly maxFilesForLLM?: number;
  private readonly maxCharsPerFileForLLM?: number;
  private readonly timeoutMs: number;
  private readonly debug: boolean;
  private readonly workerPath: string;

  constructor(options: ProcessIsolatedCodeQualitySubAgentOptions) {
    this.llmConfig = options.llmConfig;
    this.enableLLMReview = options.enableLLMReview ?? true;
    this.enableRuleFallback = options.enableRuleFallback ?? true;
    this.maxFilesForLLM = options.maxFilesForLLM;
    this.maxCharsPerFileForLLM = options.maxCharsPerFileForLLM;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.debug = options.debug ?? false;
    this.workerPath = options.workerPath ?? resolveDefaultWorkerPath();
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

    const payload: WorkerInput = {
      request,
      llmConfig: this.enableLLMReview ? this.llmConfig : undefined,
      options: {
        enableLLMReview: this.enableLLMReview,
        enableRuleFallback: this.enableRuleFallback,
        maxFilesForLLM: this.maxFilesForLLM,
        maxCharsPerFileForLLM: this.maxCharsPerFileForLLM,
        debug: this.debug,
      },
    };

    return new Promise((resolve) => {
      const child = spawn(process.execPath, [this.workerPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const complete = (result: A2AResponse<CodeQualityReviewResponse>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        complete(
          this.errorResponse(
            request,
            `CodeQualitySubAgent worker timed out after ${this.timeoutMs}ms`,
          ),
        );
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      child.on("error", (error) => {
        complete(
          this.errorResponse(
            request,
            `Failed to start code-quality worker: ${error.message}`,
          ),
        );
      });

      child.on("close", (code) => {
        if (settled) return;

        // Worker may still emit a structured error response even with non-zero exit code.
        const parsed = this.parseWorkerResponse(stdout);
        if (parsed) {
          complete(parsed);
          return;
        }

        if (code !== 0) {
          const details = stderr.trim() || stdout.trim() || "Unknown worker error";
          complete(
            this.errorResponse(
              request,
              `Code-quality worker exited with code ${code}: ${details}`,
            ),
          );
          return;
        }

        const debugDetails = [stderr.trim(), stdout.trim()]
          .filter(Boolean)
          .join("\n");
        complete(
          this.errorResponse(
            request,
            `Failed to parse code-quality worker response.${debugDetails ? ` Details: ${debugDetails}` : ""}`,
          ),
        );
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
  }

  private parseWorkerResponse(
    stdout: string,
  ): A2AResponse<CodeQualityReviewResponse> | null {
    const direct = this.tryParseResponse(stdout.trim());
    if (direct) return direct;

    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      const parsed = this.tryParseResponse(lines[i]);
      if (parsed) return parsed;
    }

    return null;
  }

  private tryParseResponse(
    raw: string,
  ): A2AResponse<CodeQualityReviewResponse> | null {
    if (!raw) return null;

    try {
      return JSON.parse(raw) as A2AResponse<CodeQualityReviewResponse>;
    } catch {
      return null;
    }
  }

  private errorResponse(
    request: A2ARequest<CodeQualityReviewRequest>,
    message: string,
  ): A2AResponse<CodeQualityReviewResponse> {
    return {
      protocol: A2A_PROTOCOL_NAME,
      version: A2A_PROTOCOL_VERSION,
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
