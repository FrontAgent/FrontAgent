import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAST } from './get-ast.js';

let roots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'mcp-file-ast-'));
  roots.push(root);
  return root;
}

const TS_FIXTURE = `import { join } from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

export const PI = 3.14;

export async function greet(name: string): Promise<string> {
  return \`hi \${name}\`;
}

export class Greeter {}

export interface GreetOptions {
  loud?: boolean;
}

export type GreetResult = string;
`;

const TSX_FIXTURE = `import { Component } from 'react';

export const Button = () => <button>ok</button>;

export function Card(props: { title: string }) {
  return <div>{props.title}</div>;
}

export class Panel extends Component {
  render() {
    return <div />;
  }
}
`;

afterEach(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
  roots = [];
});

describe('getAST (ts-morph smoke test)', () => {
  it('extracts imports, exports, functions, classes, interfaces and type aliases from a .ts file', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'sample.ts'), TS_FIXTURE, 'utf-8');

    const result = await getAST({ path: 'sample.ts' }, root);

    expect(result.success).toBe(true);

    // getImportDeclarations / getNamedImports / getNamespaceImport /
    // getDefaultImport / getModuleSpecifierValue / getStartLineNumber
    expect(result.imports).toHaveLength(3);
    const [named, namespace, def] = result.imports ?? [];
    expect(named.moduleSpecifier).toBe('node:path');
    expect(named.namedImports).toEqual(['join']);
    expect(named.line).toBe(1);
    expect(namespace.namespaceImport).toBe('fs');
    expect(def.defaultImport).toBe('os');

    // getExportedDeclarations: ReadonlyMap iterated by key
    expect(result.exports).toEqual(
      expect.arrayContaining(['PI', 'greet', 'Greeter', 'GreetOptions', 'GreetResult']),
    );

    // getFunctions / isAsync / isExported / getParameters /
    // getType().getText() / getReturnType().getText()
    const greet = result.functions?.find((f) => f.name === 'greet');
    expect(greet).toBeDefined();
    expect(greet?.isAsync).toBe(true);
    expect(greet?.isExported).toBe(true);
    expect(greet?.parameters?.[0]).toContain('name: string');
    // Loose match: type TEXT rendering may legitimately vary across TS engines
    expect(greet?.returnType).toContain('Promise<string>');

    // getClasses / getInterfaces / getTypeAliases
    expect(result.classes).toEqual([
      expect.objectContaining({ name: 'Greeter', isExported: true }),
    ]);
    expect(result.interfaces).toEqual([
      expect.objectContaining({ name: 'GreetOptions', isExported: true }),
    ]);
    expect(result.types).toEqual([
      expect.objectContaining({ name: 'GreetResult', isExported: true }),
    ]);
  });

  it('detects arrow-function, function-declaration and class React components in a .tsx file', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'components.tsx'), TSX_FIXTURE, 'utf-8');

    const result = await getAST({ path: 'components.tsx' }, root);

    expect(result.success).toBe(true);
    const componentNames = (result.components ?? []).map((c) => c.name);
    // Button: getVariableDeclarations + getInitializer + SyntaxKind.ArrowFunction
    expect(componentNames).toContain('Button');
    // Card: getFunctions + getBody() JSX heuristic (exercises jsx: 2 parsing)
    expect(componentNames).toContain('Card');
    // Panel: getClasses + getExtends
    expect(componentNames).toContain('Panel');
    expect(result.components?.find((c) => c.name === 'Panel')?.type).toBe('class');
  });

  it('rejects unsupported file extensions', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'notes.md'), '# hi', 'utf-8');

    const result = await getAST({ path: 'notes.md' }, root);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported file type');
  });
});
