import chalk from 'chalk';
import ora from 'ora';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Command } from 'commander';
import { getDefaultRagCacheDir } from '../bootstrap.js';

const execFileAsync = promisify(execFile);
const RAG_BUNDLE_VERSION = 1;

type RagCacheBundleManifest = {
  version: number;
  generatedAt: string;
  includesRepo: boolean;
  source: {
    repoUrl?: string;
    branch?: string;
    revision?: string;
    indexedFiles?: number;
    indexedChunks?: number;
  };
  embedding: {
    model?: string;
    baseURL?: string;
    dimensions?: number;
    vectorCount?: number;
    storeVersion?: number;
  };
  indexVersion?: number;
};

function readJsonFile(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function createRagCacheManifest(cacheDir: string, includesRepo: boolean): RagCacheBundleManifest {
  const indexPath = join(cacheDir, 'index.json');
  const embeddingPath = join(cacheDir, 'embeddings.json');
  const index = existsSync(indexPath) ? readJsonFile(indexPath) : undefined;
  const embeddingStore = existsSync(embeddingPath) ? readJsonFile(embeddingPath) : undefined;

  return {
    version: RAG_BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    includesRepo,
    source: {
      repoUrl: index?.source?.repoUrl,
      branch: index?.source?.branch,
      revision: index?.source?.revision,
      indexedFiles: index?.source?.indexedFiles,
      indexedChunks: index?.source?.indexedChunks,
    },
    embedding: {
      model: embeddingStore?.model,
      baseURL: embeddingStore?.baseURL,
      dimensions: embeddingStore?.dimensions,
      vectorCount: embeddingStore?.vectors ? Object.keys(embeddingStore.vectors).length : undefined,
      storeVersion: embeddingStore?.version,
    },
    indexVersion: index?.version,
  };
}

function getDefaultRagBundleOutputPath(cacheDir: string): string {
  const manifest = createRagCacheManifest(cacheDir, existsSync(join(cacheDir, 'repo')));
  const revision = manifest.source.revision?.slice(0, 12) || Date.now().toString();
  return resolve(process.cwd(), `frontagent-rag-cache-${revision}.tar.gz`);
}

function isHttpSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

async function createRagCacheBundle(input: {
  cacheDir: string;
  outputPath: string;
  includeRepo: boolean;
}): Promise<RagCacheBundleManifest> {
  const indexPath = join(input.cacheDir, 'index.json');
  const embeddingsPath = join(input.cacheDir, 'embeddings.json');
  if (!existsSync(indexPath) || !existsSync(embeddingsPath)) {
    throw new Error(`RAG cache is incomplete: expected ${indexPath} and ${embeddingsPath}`);
  }

  const repoDir = join(input.cacheDir, 'repo');
  if (input.includeRepo && !existsSync(repoDir)) {
    throw new Error(`RAG cache repo mirror not found: ${repoDir}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'frontagent-rag-export-'));
  const bundleRoot = join(tempRoot, 'frontagent-rag-bundle');
  const bundleCacheDir = join(bundleRoot, 'rag-cache');

  try {
    mkdirSync(bundleCacheDir, { recursive: true });
    cpSync(indexPath, join(bundleCacheDir, 'index.json'));
    cpSync(embeddingsPath, join(bundleCacheDir, 'embeddings.json'));
    if (input.includeRepo) {
      cpSync(repoDir, join(bundleCacheDir, 'repo'), { recursive: true });
    }

    const manifest = createRagCacheManifest(input.cacheDir, input.includeRepo);
    writeFileSync(join(bundleRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    mkdirSync(dirname(input.outputPath), { recursive: true });
    await execFileAsync('tar', ['-czf', input.outputPath, '-C', tempRoot, 'frontagent-rag-bundle']);
    return manifest;
  } catch (error) {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error('tar command is required to export a RAG bundle');
    }
    throw error;
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function downloadRagBundle(sourceUrl: string): Promise<{ archivePath: string; cleanupPath: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download bundle: ${response.status} ${response.statusText}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'frontagent-rag-download-'));
  const archivePath = join(tempRoot, 'bundle.tar.gz');
  const body = Buffer.from(await response.arrayBuffer());
  writeFileSync(archivePath, body);
  return { archivePath, cleanupPath: tempRoot };
}

async function importRagCacheBundle(input: {
  source: string;
  cacheDir: string;
  force: boolean;
}): Promise<RagCacheBundleManifest> {
  const extractionRoot = mkdtempSync(join(tmpdir(), 'frontagent-rag-import-'));
  let archivePath = input.source;
  let downloadCleanupPath: string | undefined;

  try {
    if (isHttpSource(input.source)) {
      const download = await downloadRagBundle(input.source);
      archivePath = download.archivePath;
      downloadCleanupPath = download.cleanupPath;
    } else {
      archivePath = resolve(process.cwd(), input.source);
      if (!existsSync(archivePath)) {
        throw new Error(`Bundle file not found: ${archivePath}`);
      }
    }

    await execFileAsync('tar', ['-xzf', archivePath, '-C', extractionRoot]);
    const bundleRoot = join(extractionRoot, 'frontagent-rag-bundle');
    const manifestPath = join(bundleRoot, 'manifest.json');
    const bundleCacheDir = join(bundleRoot, 'rag-cache');
    const indexPath = join(bundleCacheDir, 'index.json');
    const embeddingsPath = join(bundleCacheDir, 'embeddings.json');

    if (!existsSync(manifestPath) || !existsSync(indexPath) || !existsSync(embeddingsPath)) {
      throw new Error('Invalid RAG bundle: missing manifest.json, index.json, or embeddings.json');
    }

    const manifest = readJsonFile(manifestPath) as RagCacheBundleManifest;
    if (manifest.version !== RAG_BUNDLE_VERSION) {
      throw new Error(`Unsupported RAG bundle version: ${manifest.version}`);
    }

    if (existsSync(input.cacheDir)) {
      if (!input.force) {
        throw new Error(`RAG cache already exists at ${input.cacheDir}; rerun with --force to replace it`);
      }
      rmSync(input.cacheDir, { recursive: true, force: true });
    }

    mkdirSync(dirname(input.cacheDir), { recursive: true });
    cpSync(bundleCacheDir, input.cacheDir, { recursive: true });
    return manifest;
  } catch (error) {
    if (error instanceof Error && /ENOENT/.test(error.message)) {
      throw new Error('tar command is required to import a RAG bundle');
    }
    throw error;
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true });
    if (downloadCleanupPath) {
      rmSync(downloadCleanupPath, { recursive: true, force: true });
    }
  }
}

function printManifest(manifest: RagCacheBundleManifest) {
  console.log(chalk.gray(`   Repo: ${manifest.source.repoUrl || '(unknown)'}`));
  console.log(chalk.gray(`   Revision: ${manifest.source.revision || '(unknown)'}`));
  console.log(chalk.gray(`   Indexed Files: ${manifest.source.indexedFiles ?? 0}`));
  console.log(chalk.gray(`   Indexed Chunks: ${manifest.source.indexedChunks ?? 0}`));
  console.log(chalk.gray(`   Embedding Model: ${manifest.embedding.model || '(unknown)'}`));
  console.log(chalk.gray(`   Vectors: ${manifest.embedding.vectorCount ?? 0}`));
  console.log(chalk.gray(`   Includes Repo Mirror: ${manifest.includesRepo}`));
}

export function registerRagCommand(parent: Command) {
  const ragCommand = parent
    .command('rag')
    .description('管理预构建 RAG 缓存包');

  ragCommand
    .command('export')
    .description('导出当前 .frontagent/rag-cache 为可分发的 tar.gz 包')
    .option('-c, --cache-dir <path>', 'RAG 缓存目录', getDefaultRagCacheDir(process.cwd()))
    .option('-o, --output <path>', '输出 tar.gz 路径')
    .option('--without-repo', '不包含 repo 镜像目录', false)
    .action(async (options) => {
      const cacheDir = resolve(process.cwd(), options.cacheDir);
      const includeRepo = !options.withoutRepo;
      const outputPath = options.output
        ? resolve(process.cwd(), options.output)
        : getDefaultRagBundleOutputPath(cacheDir);
      const spinner = ora('正在导出 RAG 缓存包...').start();

      try {
        const manifest = await createRagCacheBundle({ cacheDir, outputPath, includeRepo });
        spinner.succeed(`RAG 缓存包已导出: ${outputPath}`);
        printManifest(manifest);
      } catch (error) {
        spinner.fail('导出失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });

  ragCommand
    .command('import')
    .description('从本地文件或 URL 导入预构建 RAG 缓存包')
    .argument('<source>', '本地 tar.gz 路径或 http(s) URL')
    .option('-c, --cache-dir <path>', 'RAG 缓存目录', getDefaultRagCacheDir(process.cwd()))
    .option('-f, --force', '覆盖现有缓存目录', false)
    .action(async (source, options) => {
      const cacheDir = resolve(process.cwd(), options.cacheDir);
      const spinner = ora('正在导入 RAG 缓存包...').start();

      try {
        const manifest = await importRagCacheBundle({
          source,
          cacheDir,
          force: Boolean(options.force),
        });
        spinner.succeed(`RAG 缓存包已导入: ${cacheDir}`);
        printManifest(manifest);
      } catch (error) {
        spinner.fail('导入失败');
        console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
