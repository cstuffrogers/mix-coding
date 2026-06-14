import { readFileSync, existsSync } from 'fs';
import { scanDir } from './scan-dir.js';

export function readCodeFiles(dir) {
  if (!existsSync(dir)) return [];
  const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.go', '.rs', '.java', '.kt'];
  return scanDir(dir)
    .filter(f => codeExts.some(ext => f.endsWith(ext)))
    .map(f => {
      try { return { path: f, content: readFileSync(f, 'utf-8') }; }
      catch { return null; }
    })
    .filter(Boolean);
}

function preserveNewlines(match, replacement) {
  const count = (match.match(/\n/g) || []).length;
  return count === 0 ? replacement : '\n'.repeat(count) + replacement;
}

export function stripCommentsAndStrings(code) {
  /* eslint-disable sonarjs/slow-regex */
  // Order matters: strip strings first so path separators inside quotes
  // don't get mistaken for regex literals by the regex-stripping step.
  // Multi-line comments and template literals preserve newline count so
  // that line numbers computed from the stripped text match the original.
  return code
    .replace(/\/\/.*$/gm, ' ')           // single-line comments
    .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, (m) => preserveNewlines(m, ' ')) // multi-line comments
    .replace(/'[^']*'/g, '""')           // single-quoted strings
    .replace(/"[^"]*"/g, '""')           // double-quoted strings
    .replace(/`[^`]*`/g, (m) => preserveNewlines(m, '""')) // template literals
    .replace(/\/(?:[^\/\\\n\r]|\\.)+\/[gimsuy]*\b/g, ' '); // regex literals
  /* eslint-enable sonarjs/slow-regex */
}

function findMatchingClose(text, openIdx, openCh, closeCh) {
  let depth = 1;
  let j = openIdx + 1;
  while (j < text.length && depth > 0) {
    const ch = text[j];
    if (ch === openCh) depth++;
    else if (ch === closeCh) depth--;
    j++;
  }
  return depth === 0 ? j : -1;
}

function computeLoopBodyEnd(stripped, start, isMethod) {
  const parenStart = stripped.indexOf('(', start);
  if (parenStart === -1) return start;
  const afterParen = findMatchingClose(stripped, parenStart, '(', ')');
  if (afterParen === -1) return start;
  if (isMethod) return afterParen;
  let bodyStart = afterParen;
  while (bodyStart < stripped.length && /\s/.test(stripped[bodyStart])) bodyStart++;
  if (stripped[bodyStart] === '{') {
    const end = findMatchingClose(stripped, bodyStart, '{', '}');
    return end === -1 ? bodyStart + 1 : end;
  }
  const semi = stripped.indexOf(';', bodyStart);
  return semi > 0 ? semi : bodyStart + 1;
}

export const CTRL_FLOW = new Set(['if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'try', 'finally', 'with', 'return', 'throw', 'new', 'delete', 'typeof', 'void', 'async', 'await', 'export', 'import', 'const', 'let', 'var', 'default', 'extends', 'implements']);

export function getFunctionComplexities(code, threshold) {
  const stripped = stripCommentsAndStrings(code);
  const results = [];

  // Match: function name(  |  const/let/var name = (async) (params) =>  |  (async) (static) name(params) {
  const funcRe = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(?:async\s+)?(?:static\s+)?\s*(\w+)\s*\([^)]*\)\s*\{)/g;
  const seen = new Set();

  let m;
  while ((m = funcRe.exec(stripped)) !== null) {
    const name = m[1] || m[2] || m[3];
    if (!name || CTRL_FLOW.has(name)) continue;

    const openBrace = stripped.indexOf('{', m.index + m[0].length - 1);
    if (openBrace === -1) continue;

    const closeBrace = findMatchingClose(stripped, openBrace, '{', '}');
    if (closeBrace === -1) continue;

    const posKey = `${openBrace}:${closeBrace}`;
    if (seen.has(posKey)) continue;
    seen.add(posKey);

    const body = stripped.slice(openBrace + 1, closeBrace);
    const branches = (body.match(/\b(if|else|for|while|switch|case|catch)\b|\?(?![\?.])/g) || []).length;

    if (branches > threshold) {
      const lineNum = stripped.slice(0, m.index).split('\n').length;
      results.push({ name, line: lineNum, complexity: branches });
    }
  }

  return results;
}

export function detectNestedLoops(code) {
  const stripped = stripCommentsAndStrings(code);
  const loopRe = /\b(for|while)\s*\(|(?<![.\w])\.(forEach|map|filter|reduce|some|every|flatMap)\s*\(/g;
  const items = [];
  let m;
  while ((m = loopRe.exec(stripped)) !== null) items.push({ start: m.index, isMethod: !!m[2] });
  if (items.length < 2) return { count: 0, deepest: 0 };

  const sorted = items
    .map(it => ({ start: it.start, end: computeLoopBodyEnd(stripped, it.start, it.isMethod) }))
    .sort((a, b) => a.start - b.start);

  let triplePlus = 0;
  const stack = [];
  for (const node of sorted) {
    while (stack.length && stack[stack.length - 1].end <= node.start) stack.pop();
    if (stack.length >= 2) triplePlus++;
    stack.push(node);
  }
  return { count: triplePlus, deepest: triplePlus > 0 ? 3 : 2 };
}
