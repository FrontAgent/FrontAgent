/**
 * 语法有效性检查
 * 验证代码语法是否正确
 */

import type { HallucinationCheckResult } from '@frontagent/shared';

export interface SyntaxValidityCheckInput {
  code: string;
  language: 'typescript' | 'javascript' | 'json' | 'yaml';
  filePath?: string;
}

interface SyntaxError {
  line: number;
  column: number;
  message: string;
}

/**
 * 检查代码语法有效性
 */
export async function checkSyntaxValidity(
  input: SyntaxValidityCheckInput
): Promise<HallucinationCheckResult> {
  const { code, language, filePath } = input;

  try {
    let errors: SyntaxError[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript':
        errors = checkJavaScriptSyntax(code);
        break;
      case 'json':
        errors = checkJsonSyntax(code);
        break;
      case 'yaml':
        // YAML 语法检查需要额外的库，这里简化处理
        errors = [];
        break;
    }

    if (errors.length > 0) {
      return {
        pass: false,
        type: 'syntax_validity',
        severity: 'block',
        message: `Syntax errors found in ${filePath ?? 'code'}`,
        details: { errors, language }
      };
    }

    return {
      pass: true,
      type: 'syntax_validity',
      severity: 'info',
      message: `Syntax is valid for ${language}`
    };
  } catch (error) {
    return {
      pass: false,
      type: 'syntax_validity',
      severity: 'block',
      message: `Syntax check failed: ${error instanceof Error ? error.message : String(error)}`,
      details: { error: String(error) }
    };
  }
}

/**
 * 检查 JavaScript/TypeScript 语法
 */
function checkJavaScriptSyntax(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];

  // 简化的括号匹配检查
  const bracketErrors = checkBrackets(code);
  errors.push(...bracketErrors);

  // 检查常见语法错误模式
  const patternErrors = checkCommonPatterns(code);
  errors.push(...patternErrors);

  return errors;
}

/**
 * 检查括号匹配
 */
function checkBrackets(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const stack: Array<{ char: string; line: number; column: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  const lines = code.split('\n');
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultiLineComment = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    
    for (let colIdx = 0; colIdx < line.length; colIdx++) {
      const char = line[colIdx];
      const prevChar = colIdx > 0 ? line[colIdx - 1] : '';
      const nextChar = colIdx < line.length - 1 ? line[colIdx + 1] : '';

      // 处理字符串
      if (!inComment && !inMultiLineComment) {
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
          continue;
        }
        if (inString) continue;
      }

      // 处理注释
      if (char === '/' && nextChar === '/' && !inMultiLineComment) {
        inComment = true;
        continue;
      }
      if (char === '/' && nextChar === '*' && !inComment) {
        inMultiLineComment = true;
        continue;
      }
      if (char === '*' && nextChar === '/' && inMultiLineComment) {
        inMultiLineComment = false;
        colIdx++;
        continue;
      }
      if (inComment || inMultiLineComment) continue;

      // 检查括号
      if (pairs[char]) {
        stack.push({ char, line: lineIdx + 1, column: colIdx + 1 });
      } else if (closers[char]) {
        const last = stack.pop();
        if (!last || last.char !== closers[char]) {
          errors.push({
            line: lineIdx + 1,
            column: colIdx + 1,
            message: `Unmatched closing bracket: ${char}`
          });
        }
      }
    }
    
    inComment = false;
  }

  // 未闭合的括号
  for (const item of stack) {
    errors.push({
      line: item.line,
      column: item.column,
      message: `Unclosed bracket: ${item.char}`
    });
  }

  return errors;
}

/**
 * 检查常见语法错误模式
 */
function checkCommonPatterns(code: string): SyntaxError[] {
  const errors: SyntaxError[] = [];
  const lines = code.split('\n');

  // 未来可扩展的错误模式
  // const errorPatterns = [
  //   { pattern: /[^=!<>]==[^=]/, message: 'Possible loose equality, consider using ===' },
  //   { pattern: /\)\s*{[^}]+}\s*else/, message: 'Possible missing newline before else' },
  //   { pattern: /return\s*\n\s*[^;{]/, message: 'Possible unintended return due to automatic semicolon insertion' }
  // ];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // 检查未闭合的字符串（简化）
    const singleQuotes = (line.match(/(?<!\\)'/g) || []).length;
    const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length;
    const templateLiterals = (line.match(/(?<!\\)`/g) || []).length;

    if (singleQuotes % 2 !== 0) {
      errors.push({
        line: lineIdx + 1,
        column: 1,
        message: 'Possible unclosed single-quoted string'
      });
    }

    if (doubleQuotes % 2 !== 0) {
      errors.push({
        line: lineIdx + 1,
        column: 1,
        message: 'Possible unclosed double-quoted string'
      });
    }

    if (templateLiterals % 2 !== 0) {
      errors.push({
        line: lineIdx + 1,
        column: 1,
        message: 'Possible unclosed template literal'
      });
    }
  }

  return errors;
}

/**
 * 检查 JSON 语法
 */
function checkJsonSyntax(code: string): SyntaxError[] {
  try {
    JSON.parse(code);
    return [];
  } catch (error) {
    if (error instanceof SyntaxError) {
      // 尝试从错误消息中提取位置
      const match = error.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1], 10) : 0;
      
      // 将位置转换为行号和列号
      let line = 1;
      let column = 1;
      for (let i = 0; i < position && i < code.length; i++) {
        if (code[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }

      return [{
        line,
        column,
        message: error.message
      }];
    }
    return [{
      line: 1,
      column: 1,
      message: String(error)
    }];
  }
}

