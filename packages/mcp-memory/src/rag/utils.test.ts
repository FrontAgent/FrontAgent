import { describe, expect, it } from 'vitest';
import {
  getNumber,
  getString,
  hashText,
  normalizeBaseUrl,
  normalizeEmbeddingBaseUrl,
  normalizeOptionalBaseUrl,
  normalizeRepoPath,
  normalizeRerankerBaseUrl,
  parseOptionalBoolean,
  parseOptionalInt,
  parseStringList,
  sameStringSet,
  toBlobUrl,
} from './utils.js';

describe('normalizeRepoPath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizeRepoPath('src\\utils\\index.ts')).toBe('src/utils/index.ts');
  });

  it('strips leading ./', () => {
    expect(normalizeRepoPath('./src/index.ts')).toBe('src/index.ts');
  });

  it('strips leading /', () => {
    expect(normalizeRepoPath('/src/index.ts')).toBe('src/index.ts');
  });

  it('strips multiple leading slashes', () => {
    expect(normalizeRepoPath('///src/index.ts')).toBe('src/index.ts');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeRepoPath('')).toBe('');
  });
});

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
    expect(normalizeBaseUrl('https://api.example.com///')).toBe('https://api.example.com');
  });

  it('leaves clean URLs unchanged', () => {
    expect(normalizeBaseUrl('https://api.example.com')).toBe('https://api.example.com');
  });
});

describe('normalizeOptionalBaseUrl', () => {
  it('returns undefined for empty/whitespace', () => {
    expect(normalizeOptionalBaseUrl('')).toBeUndefined();
    expect(normalizeOptionalBaseUrl('   ')).toBeUndefined();
    expect(normalizeOptionalBaseUrl(undefined)).toBeUndefined();
  });

  it('trims and normalizes', () => {
    expect(normalizeOptionalBaseUrl('  https://api.example.com/  ')).toBe(
      'https://api.example.com',
    );
  });
});

describe('normalizeEmbeddingBaseUrl', () => {
  it('appends /embeddings if missing', () => {
    expect(normalizeEmbeddingBaseUrl('https://api.openai.com/v1')).toBe(
      'https://api.openai.com/v1/embeddings',
    );
  });

  it('does not double-append /embeddings', () => {
    expect(normalizeEmbeddingBaseUrl('https://api.openai.com/v1/embeddings')).toBe(
      'https://api.openai.com/v1/embeddings',
    );
  });

  it('strips trailing slash before appending', () => {
    expect(normalizeEmbeddingBaseUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/embeddings',
    );
  });
});

describe('normalizeRerankerBaseUrl', () => {
  it('appends /rerank if missing', () => {
    expect(normalizeRerankerBaseUrl('https://api.jina.ai/v1')).toBe(
      'https://api.jina.ai/v1/rerank',
    );
  });

  it('does not double-append /rerank', () => {
    expect(normalizeRerankerBaseUrl('https://api.jina.ai/v1/rerank')).toBe(
      'https://api.jina.ai/v1/rerank',
    );
  });
});

describe('toBlobUrl', () => {
  it('builds a GitHub blob URL', () => {
    expect(toBlobUrl('https://github.com/user/repo.git', 'main', 'src/index.ts')).toBe(
      'https://github.com/user/repo/blob/main/src/index.ts',
    );
  });

  it('encodes branch and path segments', () => {
    expect(toBlobUrl('https://github.com/user/repo', 'feat/new thing', 'dir/file name.ts')).toBe(
      'https://github.com/user/repo/blob/feat%2Fnew%20thing/dir/file%20name.ts',
    );
  });
});

describe('hashText', () => {
  it('returns a sha256 hex digest', () => {
    const hash = hashText('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('is deterministic', () => {
    expect(hashText('test')).toBe(hashText('test'));
  });

  it('differs for different inputs', () => {
    expect(hashText('a')).not.toBe(hashText('b'));
  });
});

describe('parseOptionalInt', () => {
  it('returns undefined for empty/undefined', () => {
    expect(parseOptionalInt(undefined)).toBeUndefined();
    expect(parseOptionalInt('')).toBeUndefined();
  });

  it('parses valid integers', () => {
    expect(parseOptionalInt('42')).toBe(42);
    expect(parseOptionalInt('0')).toBe(0);
  });

  it('returns undefined for non-numeric', () => {
    expect(parseOptionalInt('abc')).toBeUndefined();
  });
});

describe('parseOptionalBoolean', () => {
  it('returns undefined for empty/undefined', () => {
    expect(parseOptionalBoolean(undefined)).toBeUndefined();
    expect(parseOptionalBoolean('')).toBeUndefined();
  });

  it('parses truthy values', () => {
    expect(parseOptionalBoolean('true')).toBe(true);
    expect(parseOptionalBoolean('1')).toBe(true);
    expect(parseOptionalBoolean('yes')).toBe(true);
    expect(parseOptionalBoolean('on')).toBe(true);
    expect(parseOptionalBoolean('TRUE')).toBe(true);
  });

  it('parses falsy values', () => {
    expect(parseOptionalBoolean('false')).toBe(false);
    expect(parseOptionalBoolean('0')).toBe(false);
    expect(parseOptionalBoolean('no')).toBe(false);
    expect(parseOptionalBoolean('off')).toBe(false);
  });

  it('returns undefined for unrecognized values', () => {
    expect(parseOptionalBoolean('maybe')).toBeUndefined();
  });
});

describe('parseStringList', () => {
  it('returns undefined for empty/undefined', () => {
    expect(parseStringList(undefined)).toBeUndefined();
    expect(parseStringList('')).toBeUndefined();
    expect(parseStringList('   ')).toBeUndefined();
  });

  it('splits by comma and normalizes paths', () => {
    expect(parseStringList('src/a, docs/b')).toEqual(['src/a', 'docs/b']);
  });

  it('strips leading ./ from items', () => {
    expect(parseStringList('./vendor,./dist')).toEqual(['vendor', 'dist']);
  });
});

describe('sameStringSet', () => {
  it('returns true for identical arrays', () => {
    expect(sameStringSet(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('returns true regardless of order', () => {
    expect(sameStringSet(['b', 'a'], ['a', 'b'])).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(sameStringSet(['a'], ['a', 'b'])).toBe(false);
  });

  it('returns false for different content', () => {
    expect(sameStringSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('returns true for empty arrays', () => {
    expect(sameStringSet([], [])).toBe(true);
  });
});

describe('getString', () => {
  it('returns string for non-empty strings', () => {
    expect(getString('hello')).toBe('hello');
  });

  it('returns undefined for empty/whitespace strings', () => {
    expect(getString('')).toBeUndefined();
    expect(getString('   ')).toBeUndefined();
  });

  it('returns undefined for non-string values', () => {
    expect(getString(42)).toBeUndefined();
    expect(getString(null)).toBeUndefined();
    expect(getString(undefined)).toBeUndefined();
  });
});

describe('getNumber', () => {
  it('returns number for finite numbers', () => {
    expect(getNumber(42)).toBe(42);
    expect(getNumber(0)).toBe(0);
    expect(getNumber(-1.5)).toBe(-1.5);
  });

  it('returns undefined for non-finite/non-number', () => {
    expect(getNumber(Number.NaN)).toBeUndefined();
    expect(getNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(getNumber('42')).toBeUndefined();
    expect(getNumber(null)).toBeUndefined();
  });
});
