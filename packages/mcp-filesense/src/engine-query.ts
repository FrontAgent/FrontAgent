import path from 'node:path';
import type { IndexFile, NotesFile, QueryResult } from './types.js';

export interface BuildQueryResultOptions {
  root: string;
  target: string;
  index: IndexFile;
  notes: NotesFile | null;
}

export function buildQueryResult({
  root,
  target,
  index,
  notes,
}: BuildQueryResultOptions): QueryResult {
  const relative = path.relative(root, target);
  return {
    root,
    target,
    rootRelativePath: relative === '' ? '.' : relative,
    index,
    notes,
  };
}
