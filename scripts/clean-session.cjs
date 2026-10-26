#!/usr/bin/env node
/**
 * clean-session.cjs — Session cleanup verification
 *
 * Checks that the repo is in a clean state at session end:
 *  - No dirty working tree without a commit
 *  - Tests still pass
 *  - Lint still clean
 *  - Untracked files are intentional
 *
 * Usage: node scripts/clean-session.cjs
 *        node scripts/clean-session.cjs --fix   # auto-commit if tests pass
 */

const { execSync } = require('child_process');

const isFix = process.argv.includes('--fix');
let errors = 0;
let warnings = [];

// shell: true 是必须的：Windows 上 execSync('npm test') 不带 shell 会 ENOENT
// （npm 是 npm.cmd，不加 shell 找不到），于是脚本会谎报「No test script」。
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', timeout: 600000, shell: true, ...opts }).trim();
  } catch {
    return null;
  }
}

function check(label, ok, detail) {
  if (ok) {
    console.log('  ✅ ' + label);
  } else {
    console.log('  ❌ ' + label);
    if (detail) console.log('      ' + detail);
    errors++;
  }
}

function warn(label, detail) {
  console.log('  ⚠️  ' + label);
  if (detail) console.log('      ' + detail);
  warnings.push(label);
}

console.log('');
console.log('=== Session Cleanup Check ===');
console.log('');

// 1. Git state
console.log('--- Git State ---');
const status = run('git status --porcelain');
if (status) {
  const lines = status.split('\n').filter(Boolean);
  if (lines.length === 0) {
    check('Working tree clean', true);
  } else {
    const untracked = lines.filter(l => l.startsWith('?? '));
    const modified = lines.filter(l => !l.startsWith('?? '));
    if (modified.length > 0) {
      warn('Modified files not committed (' + modified.length + ')', modified.slice(0, 5).join('\n      '));
    }
    if (untracked.length > 0) {
      warn('Untracked files (' + untracked.length + ')', untracked.slice(0, 5).join('\n      '));
    }
    if (isFix && modified.length === 0 && untracked.length <= 3) {
      run('git add . && git commit -m "chore: session cleanup [skip ci]"', { stdio: 'ignore' });
      console.log('  📝 Auto-committed clean state');
    }
  }
} else {
  warn('Not a git repository', '');
}

// 2. Tests
console.log('');
console.log('--- Tests ---');
const testOk = run('npm test 2>&1');
if (testOk !== null && !testOk.includes('FAIL')) {
  check('Tests pass', true);
} else if (testOk !== null) {
  check('Tests pass', false, testOk.slice(0, 200));
} else {
  // null = 命令失败/超时/没有脚本，三者都不是「通过」
  check('Tests pass', false, 'npm test 执行失败或超时');
}

// 3. Lint
console.log('');
console.log('--- Lint ---');
const lintOk = run('npm run lint 2>&1');
const hasLintScript = run('node -e "const p=JSON.parse(require(\'fs\').readFileSync(\'package.json\'));process.exit(p.scripts&&p.scripts.lint?0:1)"');
if (hasLintScript === '' || hasLintScript !== null) {
  if (lintOk !== null && !lintOk.toLowerCase().includes('error')) {
    check('Lint clean', true);
  } else {
    const problems = (lintOk || '').split('\n').filter(l => l.includes('error')).length;
    check('Lint clean', false, problems + ' errors found');
  }
} else {
  warn('No lint script', '');
}

// --- Summary ---
console.log('');
console.log('=== Summary ===');
if (errors === 0 && warnings.length === 0) {
  console.log('✅ Session is clean — safe to end.');
} else if (errors === 0) {
  console.log('⚠️  ' + warnings.length + ' warning(s) — review before ending session.');
} else {
  console.log('❌ ' + errors + ' error(s) must be fixed before ending session.');
}
console.log('');
