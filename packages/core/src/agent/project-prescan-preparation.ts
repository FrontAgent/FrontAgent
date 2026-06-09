import type { Executor } from '../executor.js';
import type { RagQueryTiming } from '../types.js';
import { detectDevServerPort } from './dev-server-detection.js';
import { type RagRetrievalDeps, retrieveRagContext } from './rag-retrieval.js';

interface ProjectPrescanPreparationDeps {
  executor: Pick<Executor, 'callTool'>;
  ragDeps: RagRetrievalDeps;
  emitStatus: (label: string, operation?: string, detail?: string) => void;
  debugLog: (...args: unknown[]) => void;
  debugWarn: (...args: unknown[]) => void;
}

interface ProjectPrescanPreparationInput {
  deps: ProjectPrescanPreparationDeps;
  taskId: string;
  taskDescription: string;
  projectRoot: string;
  ragEnabled: boolean;
  preScanFailureLabel: string;
  logProjectStructure?: boolean;
}

interface ProjectPrescanRagEvent {
  searchMode?: 'hybrid' | 'keyword_only' | 'openviking' | 'composite';
  reranked?: boolean;
  warnings?: string[];
  timing?: RagQueryTiming;
  matches: Array<{
    type: string;
    title: string;
    sourceUrl: string;
    snippet: string;
    path?: string;
    score?: number;
    rerankScore?: number;
  }>;
}

export interface ProjectPlanningPreparation {
  projectStructure?: string;
  devServerPort: number;
  ragResults?: string[];
  ragEvent: ProjectPrescanRagEvent;
}

export async function prepareProjectPlanningContext({
  deps,
  taskId,
  taskDescription,
  projectRoot,
  ragEnabled,
  preScanFailureLabel,
  logProjectStructure,
}: ProjectPrescanPreparationInput): Promise<ProjectPlanningPreparation> {
  const { projectStructure, preScannedFiles } = await preScanProject({
    deps,
    projectRoot,
    preScanFailureLabel,
    logProjectStructure,
  });

  deps.emitStatus('检测开发服务器端口', '检测开发服务器端口');
  const devServerPort = detectDevServerPort(
    { debugLog: deps.debugLog, debugWarn: deps.debugWarn },
    preScannedFiles,
  );

  deps.emitStatus('检索知识库', 'RAG 检索');
  const ragContext = await retrieveRagContext(deps.ragDeps, taskId, taskDescription);

  return {
    projectStructure,
    devServerPort,
    ragResults: ragContext?.formattedResults,
    ragEvent: {
      searchMode: ragContext?.searchMode,
      reranked: ragContext?.reranked,
      warnings: ragContext?.warnings,
      timing: ragContext?.timing,
      matches: ragEnabled ? (ragContext?.matches ?? []) : [],
    },
  };
}

async function preScanProject({
  deps,
  projectRoot,
  preScanFailureLabel,
  logProjectStructure,
}: {
  deps: ProjectPrescanPreparationDeps;
  projectRoot: string;
  preScanFailureLabel: string;
  logProjectStructure?: boolean;
}): Promise<{ projectStructure?: string; preScannedFiles: Map<string, string> }> {
  let projectStructure: string | undefined;
  const preScannedFiles = new Map<string, string>();

  try {
    deps.emitStatus('扫描项目结构', 'list_directory 扫描项目结构');
    const listResult = (await deps.executor.callTool('list_directory', {
      path: projectRoot,
      recursive: true,
    })) as { success: boolean; entries?: Array<{ name: string; type: string; path: string }> };

    if (listResult.success && listResult.entries) {
      const files = listResult.entries
        .filter(
          (entry) =>
            entry.type === 'file' &&
            !entry.path.includes('node_modules') &&
            !entry.path.includes('.git'),
        )
        .map((entry) => entry.path);

      if (files.length > 0) {
        projectStructure = `项目文件列表（共 ${files.length} 个文件）:\n${files.join('\n')}`;
        if (logProjectStructure) {
          deps.debugLog(`[Agent] 📂 Pre-scanned project structure: ${files.length} files`);
        }
      }

      const configFiles = files.filter(
        (filePath) => filePath.endsWith('package.json') || filePath.includes('vite.config'),
      );
      for (const configFile of configFiles) {
        try {
          const readResult = (await deps.executor.callTool('read_file', {
            path: configFile,
          })) as { success: boolean; content?: string };
          if (readResult.success && readResult.content) {
            preScannedFiles.set(configFile, readResult.content);
          }
        } catch {
          // Ignore optional pre-scan read failures.
        }
      }
    }
  } catch (error) {
    deps.debugWarn(preScanFailureLabel, error);
  }

  return { projectStructure, preScannedFiles };
}
