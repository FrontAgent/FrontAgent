import { extname } from 'node:path';

export function chunkText(
  content: string,
  path: string,
  chunkSize: number,
  chunkOverlap: number,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  if (!content.trim()) {
    return [];
  }

  const semanticBlocks = createSemanticBlocks(content, path)
    .flatMap((block) => splitOversizedBlock(block, chunkSize))
    .filter((block) => block.text.trim().length > 0);

  if (semanticBlocks.length === 0) {
    return [];
  }

  const chunks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let startIndex = 0;

  while (startIndex < semanticBlocks.length) {
    let endIndex = startIndex;
    let currentLength = 0;

    while (endIndex < semanticBlocks.length) {
      const separatorLength = endIndex > startIndex ? 2 : 0;
      const candidateLength =
        currentLength + separatorLength + semanticBlocks[endIndex].text.length;
      if (candidateLength > chunkSize && endIndex > startIndex) {
        break;
      }
      currentLength = candidateLength;
      endIndex++;
    }

    const selectedBlocks = semanticBlocks.slice(startIndex, endIndex);
    const text = selectedBlocks
      .map((block) => block.text)
      .join('\n\n')
      .trim();
    if (text) {
      chunks.push({
        text,
        lineStart: selectedBlocks[0].lineStart,
        lineEnd: selectedBlocks[selectedBlocks.length - 1].lineEnd,
      });
    }

    if (endIndex >= semanticBlocks.length) {
      break;
    }

    let overlapChars = 0;
    let nextStart = endIndex;
    while (nextStart > startIndex + 1 && overlapChars < chunkOverlap) {
      nextStart--;
      overlapChars += semanticBlocks[nextStart].text.length + 2;
    }

    startIndex = Math.max(nextStart, startIndex + 1);
  }

  return chunks;
}

function createSemanticBlocks(
  content: string,
  path: string,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  const extension = extname(path).toLowerCase();
  let currentLines: string[] = [];
  let currentStartLine = 1;
  let inFence = false;
  let inList = false;

  const flush = (endLine: number) => {
    const text = currentLines.join('\n').trim();
    if (!text) {
      currentLines = [];
      return;
    }

    blocks.push({
      text,
      lineStart: currentStartLine,
      lineEnd: endLine,
    });
    currentLines = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (!inFence && trimmed === '') {
      if (currentLines.length > 0) {
        flush(lineNumber - 1);
      }
      currentStartLine = lineNumber + 1;
      inList = false;
      continue;
    }

    const isFenceBoundary = /^(```|~~~)/.test(trimmed);
    if (isFenceBoundary && !inFence) {
      if (currentLines.length > 0) {
        flush(lineNumber - 1);
      }
      currentStartLine = lineNumber;
      inList = false;
    }

    const isListItem = /^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed);

    if (!inFence && currentLines.length > 0) {
      const isNewListStart = isListItem && !inList;
      if (isNewListStart || isSemanticBoundaryLine(trimmed, extension)) {
        flush(lineNumber - 1);
        currentStartLine = lineNumber;
      }
    }

    inList = isListItem;

    if (currentLines.length === 0) {
      currentStartLine = lineNumber;
    }
    currentLines.push(line);

    if (isFenceBoundary) {
      inFence = !inFence;
      if (!inFence) {
        flush(lineNumber);
        currentStartLine = lineNumber + 1;
        inList = false;
      }
    }
  }

  if (currentLines.length > 0) {
    flush(lines.length);
  }

  return blocks;
}

export function isSemanticBoundaryLine(trimmedLine: string, extension: string): boolean {
  if (!trimmedLine) {
    return false;
  }

  if (/^#{1,6}\s+/.test(trimmedLine)) {
    return true;
  }

  if (
    /^<\/?(template|script|style|main|section|article|header|footer|aside|nav)\b/i.test(trimmedLine)
  ) {
    return true;
  }

  if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(extension)) {
    return (
      /^(export\s+)?(default\s+)?(async\s+)?function\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?class\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?(interface|type|enum)\s+[A-Za-z0-9_$]+/.test(trimmedLine) ||
      /^(export\s+)?(const|let|var)\s+[A-Za-z0-9_$]+\s*=/.test(trimmedLine)
    );
  }

  if (['.css', '.scss', '.sass', '.less'].includes(extension)) {
    return /^(@media|@supports|@keyframes|:root\b|[.#a-zA-Z[\]][^{}]*\{)\s*$/.test(trimmedLine);
  }

  if (['.html', '.vue', '.md'].includes(extension)) {
    return /^<[^/!][^>]*>$/.test(trimmedLine);
  }

  if (extension === '.py') {
    return (
      /^(async\s+)?def\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^@[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (extension === '.go') {
    return (
      /^func\s+/.test(trimmedLine) ||
      /^type\s+[A-Za-z0-9_]+\s+(struct|interface)\b/.test(trimmedLine) ||
      /^var\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^const\s+[A-Za-z0-9_]/.test(trimmedLine)
    );
  }

  if (extension === '.rs') {
    return (
      /^(pub(\(crate\))?\s+)?(async\s+)?fn\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?struct\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?enum\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?impl(\s+[A-Za-z0-9_<>]+)?\b/.test(trimmedLine) ||
      /^(pub(\(crate\))?\s+)?trait\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^#\[/.test(trimmedLine)
    );
  }

  if (['.java', '.kt', '.scala'].includes(extension)) {
    return (
      /^(public|private|protected|package|internal)\s+/.test(trimmedLine) ||
      /^(abstract|sealed|data|open|override|static|final)\s+class\s+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^interface\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^object\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^@[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (['.rb', '.rake'].includes(extension)) {
    return (
      /^def\s+[A-Za-z0-9_?!]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_:]+/.test(trimmedLine) ||
      /^module\s+[A-Za-z0-9_:]+/.test(trimmedLine)
    );
  }

  if (extension === '.php') {
    return (
      /^(public|private|protected|static|abstract|final|readonly)\s+/.test(trimmedLine) ||
      /^function\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^class\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^interface\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^trait\s+[A-Za-z0-9_]+/.test(trimmedLine)
    );
  }

  if (['.c', '.cpp', '.cc', '.h', '.hpp'].includes(extension)) {
    return (
      /^[A-Za-z_][A-Za-z0-9_\s*&:<>]+\s+[A-Za-z0-9_:~]+\s*\(/.test(trimmedLine) ||
      /^(class|struct|enum|namespace|template)\s+[A-Za-z0-9_]+/.test(trimmedLine) ||
      /^#(pragma|ifndef|define|endif)\b/.test(trimmedLine)
    );
  }

  return false;
}

function splitOversizedBlock(
  block: { text: string; lineStart: number; lineEnd: number },
  maxLength: number,
): Array<{ text: string; lineStart: number; lineEnd: number }> {
  if (block.text.length <= maxLength) {
    return [block];
  }

  const pieces: Array<{ text: string; lineStart: number; lineEnd: number }> = [];
  let startOffset = 0;

  while (startOffset < block.text.length) {
    while (startOffset < block.text.length && /\s/.test(block.text[startOffset])) {
      startOffset++;
    }
    if (startOffset >= block.text.length) {
      break;
    }

    const endOffset = findPreferredSplitOffset(block.text, startOffset, maxLength);
    const raw = block.text.slice(startOffset, endOffset);
    const text = raw.trim();
    if (text) {
      pieces.push({
        text,
        lineStart: getLineNumberAtOffset(block.text, block.lineStart, startOffset),
        lineEnd: getLineNumberAtOffset(
          block.text,
          block.lineStart,
          Math.max(startOffset, endOffset - 1),
        ),
      });
    }

    startOffset = endOffset;
  }

  return pieces.length > 0 ? pieces : [block];
}

function findPreferredSplitOffset(text: string, startOffset: number, maxLength: number): number {
  const remaining = text.length - startOffset;
  if (remaining <= maxLength) {
    return text.length;
  }

  const window = text.slice(startOffset, startOffset + maxLength);
  const minimumPreferredOffset = Math.floor(maxLength * 0.45);
  const boundaryPatterns = [/\n\s*\n/g, /\n/g, /[。！？!?；;]\s+/g, /[{};>]\s*/g, /[,，]\s+/g];

  for (const pattern of boundaryPatterns) {
    const relative = findLastBoundary(window, pattern);
    if (relative >= minimumPreferredOffset) {
      return startOffset + relative;
    }
  }

  return startOffset + maxLength;
}

function findLastBoundary(window: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  let lastIndex = -1;

  while ((match = matcher.exec(window)) !== null) {
    lastIndex = match.index + match[0].length;
  }

  return lastIndex;
}

function getLineNumberAtOffset(text: string, baseLine: number, offset: number): number {
  if (offset <= 0) {
    return baseLine;
  }

  let line = baseLine;
  for (let i = 0; i < Math.min(offset, text.length); i++) {
    if (text[i] === '\n') {
      line++;
    }
  }
  return line;
}
