/**
 * Worker entry for process-isolated code quality evaluation.
 * Reads one JSON request from stdin and writes one JSON response to stdout.
 */

import { generateId } from "@frontagent/shared";
import { A2A_PROTOCOL_NAME, A2A_PROTOCOL_VERSION } from "../a2a.js";
import { LLMService } from "../llm.js";
import type { LLMConfig } from "../types.js";
import {
  CodeQualitySubAgent,
  type CodeQualityReviewRequest,
  type CodeQualityReviewResponse,
} from "./code-quality-subagent.js";
import type { A2ARequest, A2AResponse } from "../a2a.js";

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

// Keep stdout clean for machine-readable JSON responses.
const originalConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  const text = args.map(arg => String(arg)).join(" ");
  process.stderr.write(`${text}\n`);
};

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", chunk => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
  });
}

function buildErrorResponse(
  request: A2ARequest<CodeQualityReviewRequest> | undefined,
  message: string,
): A2AResponse<CodeQualityReviewResponse> {
  return {
    protocol: A2A_PROTOCOL_NAME,
    version: A2A_PROTOCOL_VERSION,
    kind: "response",
    messageId: generateId("a2a-res"),
    inReplyTo: request?.messageId ?? "",
    timestamp: Date.now(),
    from: "subagent.code-quality",
    to: request?.from ?? "frontagent.main",
    intent: request?.intent ?? "code_quality.review_generated_files",
    success: false,
    error: message,
  };
}

async function main(): Promise<void> {
  let request: A2ARequest<CodeQualityReviewRequest> | undefined;

  try {
    const raw = await readStdin();
    const input = JSON.parse(raw) as WorkerInput;
    request = input.request;

    const llmService =
      input.options.enableLLMReview && input.llmConfig
        ? new LLMService(input.llmConfig)
        : undefined;

    const subAgent = new CodeQualitySubAgent({
      llmService,
      enableRuleFallback: input.options.enableRuleFallback,
      maxFilesForLLM: input.options.maxFilesForLLM,
      maxCharsPerFileForLLM: input.options.maxCharsPerFileForLLM,
      debug: input.options.debug,
    });

    const response = await subAgent.handleRequest(input.request);
    process.stdout.write(JSON.stringify(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response = buildErrorResponse(request, message);
    process.stdout.write(JSON.stringify(response));
    process.exitCode = 1;
  } finally {
    console.log = originalConsoleLog;
  }
}

void main();
