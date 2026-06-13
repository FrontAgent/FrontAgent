import { describe, expect, it } from 'vitest';
import { chunkText, isSemanticBoundaryLine } from './chunking.js';

describe('chunkText', () => {
  it('returns empty for empty/whitespace content', () => {
    expect(chunkText('', 'test.ts', 1200, 200)).toEqual([]);
    expect(chunkText('   \n  \n  ', 'test.ts', 1200, 200)).toEqual([]);
  });

  it('returns a single chunk for short content', () => {
    const content = 'const x = 1;\nconst y = 2;';
    const chunks = chunkText(content, 'test.ts', 1200, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('const x = 1;');
    expect(chunks[0].lineStart).toBe(1);
    expect(chunks[0].lineEnd).toBe(2);
  });

  it('splits large content into multiple chunks', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `const var${i} = ${i};`);
    const content = lines.join('\n\n');
    const chunks = chunkText(content, 'test.ts', 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('preserves line numbers across chunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
    const content = lines.join('\n\n');
    const chunks = chunkText(content, 'test.md', 100, 20);
    expect(chunks[0].lineStart).toBe(1);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].lineStart).toBeGreaterThanOrEqual(chunks[i - 1].lineStart);
    }
  });

  it('handles markdown headers as semantic boundaries', () => {
    const content =
      '# Title\n\nSome intro text.\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.';
    const chunks = chunkText(content, 'readme.md', 50, 10);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('handles code fences as blocks', () => {
    const content = 'Some text\n\n```ts\nconst x = 1;\nconst y = 2;\n```\n\nMore text';
    const chunks = chunkText(content, 'doc.md', 1200, 200);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allText = chunks.map((c) => c.text).join('\n');
    expect(allText).toContain('```ts');
    expect(allText).toContain('const x = 1;');
  });

  it('recognizes TypeScript function boundaries', () => {
    const content = [
      'export function foo() {',
      '  return 1;',
      '}',
      '',
      'export function bar() {',
      '  return 2;',
      '}',
    ].join('\n');
    const chunks = chunkText(content, 'module.ts', 60, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles overlap between chunks', () => {
    const blocks = Array.from({ length: 20 }, (_, i) => `Block ${i}: ${'x'.repeat(40)}`);
    const content = blocks.join('\n\n');
    const chunks = chunkText(content, 'test.txt', 150, 60);
    if (chunks.length >= 2) {
      const firstEnd = chunks[0].lineEnd;
      const secondStart = chunks[1].lineStart;
      expect(secondStart).toBeLessThanOrEqual(firstEnd + 1);
    }
  });
});

describe('isSemanticBoundaryLine', () => {
  describe('short-circuit on empty/whitespace input', () => {
    const cases: Array<[string, string]> = [
      ['', '.ts'],
      ['', '.xyz'],
      ['   ', '.xyz'],
    ];

    it.each(cases)('returns false for %j with extension %s', (line, extension) => {
      expect(isSemanticBoundaryLine(line, extension)).toBe(false);
    });
  });

  describe('markdown headers (any extension)', () => {
    const positives: Array<[string, string]> = [
      ['# Title', '.md'],
      ['## Section', '.txt'],
      ['###### Deepest', '.xyz'],
    ];

    it.each(positives)('returns true for %j with extension %s', (line, extension) => {
      expect(isSemanticBoundaryLine(line, extension)).toBe(true);
    });

    const negatives: Array<[string, string]> = [
      ['#no-space-after-hash', '.md'],
      ['#hashtag', '.xyz'],
      ['####### too many hashes', '.md'],
      ['Regular paragraph text.', '.md'],
    ];

    it.each(negatives)('returns false for %j with extension %s', (line, extension) => {
      expect(isSemanticBoundaryLine(line, extension)).toBe(false);
    });
  });

  describe('HTML/section tags (any extension)', () => {
    const positives: Array<[string, string]> = [
      ['<template>', '.xyz'],
      ['</section>', '.xyz'],
      ['<Main class="app">', '.xyz'],
      ['<NAV>', '.xyz'],
    ];

    it.each(positives)('returns true for %j with extension %s', (line, extension) => {
      expect(isSemanticBoundaryLine(line, extension)).toBe(true);
    });

    const negatives: Array<[string, string]> = [
      ['<div>', '.xyz'],
      ['<p>Hello</p>', '.xyz'],
    ];

    it.each(negatives)('returns false for %j with extension %s', (line, extension) => {
      expect(isSemanticBoundaryLine(line, extension)).toBe(false);
    });
  });

  describe('TypeScript/JavaScript family (.ts, .tsx, .js, .jsx, .mjs, .cjs)', () => {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    describe('function declarations', () => {
      const positives = [
        'function foo() {',
        'export function foo() {',
        'export default function foo() {',
        'async function fetchData() {',
        'export async function fetchData() {',
      ];

      it.each(positives)('returns true for %j', (line) => {
        for (const extension of extensions) {
          expect(isSemanticBoundaryLine(line, extension)).toBe(true);
        }
      });
    });

    describe('class declarations', () => {
      const positives = ['class Widget {', 'export class Widget extends Base {'];

      it.each(positives)('returns true for %j', (line) => {
        for (const extension of extensions) {
          expect(isSemanticBoundaryLine(line, extension)).toBe(true);
        }
      });
    });

    describe('interface/type/enum declarations', () => {
      const positives = [
        'interface Props {',
        'export interface Props {',
        'type Foo = string;',
        'export type Foo = string;',
        'enum Color {',
        'export enum Color {',
      ];

      it.each(positives)('returns true for %j', (line) => {
        for (const extension of extensions) {
          expect(isSemanticBoundaryLine(line, extension)).toBe(true);
        }
      });
    });

    describe('const/let/var declarations', () => {
      const positives = [
        'const x = 1;',
        'export const x = 1;',
        'let y = 2;',
        'var z = 3;',
        'export const handler = () => {',
      ];

      it.each(positives)('returns true for %j', (line) => {
        for (const extension of extensions) {
          expect(isSemanticBoundaryLine(line, extension)).toBe(true);
        }
      });
    });

    describe('non-boundary statements', () => {
      const negatives = [
        'return 1;',
        '  const indentedNotTrimmed = 1;', // contains leading whitespace, not "trimmed"
        'console.log("hello");',
        'if (condition) {',
        'x.foo();',
        'const = invalidNoIdentifier;', // const without identifier before '='
      ];

      it.each(negatives)('returns false for %j', (line) => {
        for (const extension of extensions) {
          expect(isSemanticBoundaryLine(line, extension)).toBe(false);
        }
      });
    });

    it('does not apply TS/JS rules to an unrelated extension', () => {
      expect(isSemanticBoundaryLine('export const x = 1;', '.xyz')).toBe(false);
      expect(isSemanticBoundaryLine('export function foo() {', '.xyz')).toBe(false);
    });
  });

  describe('CSS family (.css, .scss, .sass, .less)', () => {
    const extensions = ['.css', '.scss', '.sass', '.less'];

    const positives = [
      '.button {',
      '#header {',
      '@media',
      '@supports',
      '@keyframes',
      ':root',
      'main > .content {',
    ];

    it.each(positives)('returns true for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(true);
      }
    });

    const negatives = ['color: red;', 'margin: 0 auto;', '}', '.button { color: red; }'];

    it.each(negatives)('returns false for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(false);
      }
    });
  });

  describe('HTML/Vue/Markdown tag lines (.html, .vue, .md)', () => {
    const extensions = ['.html', '.vue', '.md'];

    const positives = ['<div class="app">', '<MyComponent>', '<section id="intro">'];

    it.each(positives)('returns true for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(true);
      }
    });

    const negatives = [
      '</div>', // closing tag excluded by [^/!]
      '<!-- comment -->', // comment excluded by [^/!]
      'plain text <div> in middle</div>',
      '<div>text</div>', // does not end immediately after '>'
    ];

    it.each(negatives)('returns false for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(false);
      }
    });
  });

  describe('Python (.py)', () => {
    const positives = [
      'def my_func():',
      'async def my_async_func():',
      'class MyClass:',
      '@decorator',
      '@app.route("/")',
    ];

    it.each(positives)('returns true for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.py')).toBe(true);
    });

    const negatives = ['return value', 'self.x = 1', 'print("hello")', 'x = 1'];

    it.each(negatives)('returns false for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.py')).toBe(false);
    });
  });

  describe('Go (.go)', () => {
    const positives = [
      'func main() {',
      'func (r *Receiver) Method() {',
      'type Config struct {',
      'type Reader interface {',
      'var counter int',
      'const MaxRetries = 3',
    ];

    it.each(positives)('returns true for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.go')).toBe(true);
    });

    const negatives = ['return nil', 'fmt.Println("hi")', 'x := 1', 'if err != nil {'];

    it.each(negatives)('returns false for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.go')).toBe(false);
    });
  });

  describe('Rust (.rs)', () => {
    const positives = [
      'fn main() {',
      'pub fn run() {',
      'pub(crate) async fn handler() {',
      'struct Point {',
      'pub struct Point {',
      'enum Shape {',
      'pub enum Shape {',
      'impl Point {',
      'impl Display for Point {',
      'trait Drawable {',
      'pub trait Drawable {',
      '#[derive(Debug)]',
    ];

    it.each(positives)('returns true for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.rs')).toBe(true);
    });

    const negatives = ['return value;', 'let x = 1;', 'println!("hi");', 'x.method();'];

    it.each(negatives)('returns false for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.rs')).toBe(false);
    });
  });

  describe('JVM languages (.java, .kt, .scala)', () => {
    const extensions = ['.java', '.kt', '.scala'];

    const positives = [
      'public class Foo {',
      'private void doThing() {',
      'protected static final int MAX = 10;',
      'package com.example.app',
      'internal fun helper() {',
      'abstract class Base {',
      'sealed class Result {',
      'data class User(val name: String)',
      'open class Base {',
      'override class Sub {',
      'class Foo {',
      'interface Drawable {',
      'object Singleton {',
      '@Override',
      '@Component',
    ];

    it.each(positives)('returns true for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(true);
      }
    });

    const negatives = ['return result;', 'this.value = value;', 'System.out.println("hi");'];

    it.each(negatives)('returns false for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(false);
      }
    });
  });

  describe('Ruby (.rb, .rake)', () => {
    const extensions = ['.rb', '.rake'];

    const positives = [
      'def initialize(name)',
      'def valid?',
      'def save!',
      'class Account < ApplicationRecord',
      'class Foo::Bar',
      'module Authentication',
      'module Foo::Bar',
    ];

    it.each(positives)('returns true for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(true);
      }
    });

    const negatives = ['return value', 'puts "hello"', 'x = 1', 'end'];

    it.each(negatives)('returns false for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(false);
      }
    });
  });

  describe('PHP (.php)', () => {
    const positives = [
      'public function getName() {',
      'private $value;',
      'protected static function helper() {',
      'abstract function process();',
      'final class Config {',
      'readonly int $id;',
      'function helper() {',
      'class Foo {',
      'interface Drawable {',
      'trait Loggable {',
    ];

    it.each(positives)('returns true for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.php')).toBe(true);
    });

    const negatives = ['return $value;', 'echo "hello";', '$x = 1;', 'if ($x) {'];

    it.each(negatives)('returns false for %j', (line) => {
      expect(isSemanticBoundaryLine(line, '.php')).toBe(false);
    });
  });

  describe('C/C++ family (.c, .cpp, .cc, .h, .hpp)', () => {
    const extensions = ['.c', '.cpp', '.cc', '.h', '.hpp'];

    const positives = [
      'int main() {',
      'void MyClass::doSomething() {',
      'static int helper(int x) {',
      'class MyClass {',
      'struct Point {',
      'enum Color {',
      'namespace app {',
      'template MyTemplate {',
      '#pragma once',
      '#ifndef HEADER_H',
      '#define MAX_SIZE 100',
      '#endif',
    ];

    it.each(positives)('returns true for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(true);
      }
    });

    const negatives = ['return 0;', 'x = x + 1;', 'printf("hello");', '}'];

    it.each(negatives)('returns false for %j', (line) => {
      for (const extension of extensions) {
        expect(isSemanticBoundaryLine(line, extension)).toBe(false);
      }
    });
  });

  describe('unknown extension fallthrough', () => {
    it('returns false for lines that would match a known-language pattern under an unrecognized extension', () => {
      expect(isSemanticBoundaryLine('def my_func():', '.xyz')).toBe(false);
      expect(isSemanticBoundaryLine('func main() {', '.xyz')).toBe(false);
      expect(isSemanticBoundaryLine('pub fn run() {', '.unknown')).toBe(false);
      expect(isSemanticBoundaryLine('public class Foo {', '.dat')).toBe(false);
      expect(isSemanticBoundaryLine('.button {', '.xyz')).toBe(false);
    });
  });
});
