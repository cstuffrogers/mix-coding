/**
 * 探测器变异扫描 —— 回答「这些守卫测试是真的会红，还是写着好看？」
 *
 * 对每个守卫测试注入一次真实违规，确认它会红；再用内存备份复原，确认它回绿。
 * 注入点匹配不到 = 用例过期（被测代码改过），会显式报 ⚠ 而不是静默跳过。
 *
 * 用法：node scripts/detector-sweep.cjs
 * 注意：会临时改写工作区文件，跑完必须复原（失败也会在 finally 里复原）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ENGINE = 'E:/auto-coding/claude-scene';
const REPO = 'E:/auto-coding';
const BT = String.fromCodePoint(96); // 反引号：避免和 shell 引号打架
const LF = String.fromCodePoint(10);
const VITEST = path.join(ENGINE, 'node_modules', 'vitest', 'vitest.mjs');

const CASES = [
  {
    name: '场景契约：场景里出现未知动作',
    test: 'src/lib/scene-contract.test.js',
    mutations: [{
      file: path.join(REPO, '.claude/scenes/loop.json'),
      from: '"action": "codeguardian_optimize"',
      to: '"action": "ghostAction999"',
    }],
  },
  {
    name: '假绿哨兵：skip 打绿 ✔',
    test: 'src/commands/false-green-guard.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/commands/start.js'),
      from: "if (stepStatus === 'skip') return 'info';",
      to: "if (stepStatus === 'skip') return 'succeed';",
    }],
  },
  {
    name: '假绿哨兵：空结果记 pass',
    test: 'src/commands/false-green-guard.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/commands/start.js'),
      // 第三十三轮修：start.js 后来给这条 warn 补了 warnKind: 'silent'，注入点跟着走，
      // 否则用例一直「注入点没匹配到（用例过期）」—— 守卫是否还灵，就没人验过了
      from: "return { resultStr: '（处理器没有返回任何结果，检查该动作是否真的执行了）', stepStatus: 'warn', warnKind: 'silent' };",
      to: "return { resultStr: '', stepStatus: 'pass' };",
    }],
  },
  {
    name: '文档三方对齐：文档承诺了幽灵命令，但没有任何入口',
    test: 'src/lib/docs-scene-alignment.test.js',
    append: {
      file: path.join(REPO, 'CLAUDE.md'),
      text: BT + '/ghost-cmd-xyz' + BT + ' 是文档里承诺、但仓库里没有任何入口的命令。',
    },
  },
  {
    name: '文档三方对齐：新增场景 ghost-scene 没有命令入口',
    test: 'src/lib/docs-scene-alignment.test.js',
    create: {
      file: path.join(REPO, '.claude/scenes/ghost-scene.json'),
      text: JSON.stringify({ scene_id: 'ghost-scene', workflow: 'ghost-scene', name: '幽灵', description: '无入口', status: 'active', flow: [] }, undefined, 2),
    },
  },
  {
    name: '未跑成哨兵：裸字符串 + 本轮未执行',
    test: 'src/lib/not-run-status.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/handlers/mobile/audit.js'),
      // 第三十三轮修：这个处理器后来改成「声明的工具名就是真去查的那个」+ 返回对象，
      // 原文案已不存在。注入点跟着改成当前写法，注入后仍是「裸字符串 + 本轮未执行」
      from: "if (!installed) return { status: 'skip', message: `${tool} 未安装，源代码 SAST 未执行（不计为通过）` };",
      to: "if (!installed) return `${tool} 未安装，本轮未执行`;",
    }],
  },
  {
    name: '围栏：零通过也算围栏已建立',
    test: 'src/handlers/fence.test.js',
    mutations: [{ file: path.join(ENGINE, 'src/handlers/fence.js'), from: '  if (passed === 0) {', to: '  if (false) {' }],
  },
  {
    name: '指标：回滚失败计入已回滚',
    test: 'src/handlers/enclosure-metrics.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/handlers/enclosure-metrics.js'),
      from: 'const restores = restoreEvents.filter((e) => e.failed !== true).length;',
      to: 'const restores = restoreEvents.length;',
    }],
  },
  {
    name: 'strict 圈地：越界不中止',
    test: 'src/commands/enclosure-strict.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/commands/start.js'),
      from: '  if (!context?.strictEnclosure) return false;',
      to: '  return false;',
    }],
  },
  {
    // 半截描述不会被任何测试抓住，却会被 sync-docs 原样抄进文档表格
    name: '场景契约：description 被截成半句话',
    test: 'src/lib/scene-contract.test.js',
    mutations: [{
      file: path.join(REPO, '.claude/scenes/loop.json'),
      from: '"description": "无人值守自动迭代（集成CE知识沉淀）"',
      to: '"description": "无人值守自动迭代（集成CE知识沉淀"',
    }],
  },
  {
    // 把锚点正则改成只认空格形式（等于没处理 #25-个场景）→ 目录链接该断没断在测试里
    name: 'sync-docs：目录锚点里的场景数漏改',
    test: 'src/lib/sync-docs.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/lib/sync-docs.js'),
      // 用占位拼反斜杠，避免手写转义把注入点弄花
      from: ['    .replace(/#', 'd{1,5}-个场景/g, `#${count}-个场景`)'].join(String.fromCodePoint(92)),
      to: ['    .replace(/#', 'd{1,5} 个场景/g, `#${count} 个场景`)'].join(String.fromCodePoint(92)),
    }],
  },
  {
    // 旧实现拿 LF 去匹配 CRLF 文件：标记在也被报成 missing-marker。
    // 绕过行尾归一化 = 复现那个假阴性。
    name: 'sync-docs：CRLF 文件里的标记被误报缺失',
    test: 'src/lib/sync-docs.test.js',
    mutations: [{
      file: path.join(ENGINE, 'src/lib/sync-docs.js'),
      from: "  if (!re.test(lf)) return 'missing-marker';",
      to: "  if (!re.test(raw)) return 'missing-marker';",
    }],
  },
];

function runTest(testFile) {
  try {
    // 直接用当前 node 跑 vitest，不经过 PATH（否则 PATH 里有什么就跑什么）
    execFileSync(process.execPath, [VITEST, 'run', testFile], {
      cwd: ENGINE, stdio: 'pipe', encoding: 'utf8', timeout: 240_000,
    });
    return 0;
  } catch (error) {
    return error.status ?? 1;
  }
}

function undoAll(undo) {
  while (undo.length > 0) {
    try { undo.pop()(); } catch { /* 已复原 */ }
  }
}

/** 跑注入态测试，无论红绿都先把工作区复原 */
function runWithUndo(testFile, undo) {
  try {
    return runTest(testFile);
  } finally {
    undoAll(undo);
  }
}

/** 注入违规；任一注入点匹配不到说明用例过期，回滚并标记 stale */
function applyCase(testCase) {
  const undo = [];
  if (testCase.append) {
    const original = fs.readFileSync(testCase.append.file, 'utf8');
    fs.writeFileSync(testCase.append.file, `${original}${LF}${testCase.append.text}${LF}`, 'utf8');
    undo.push(() => fs.writeFileSync(testCase.append.file, original, 'utf8'));
  }
  if (testCase.create) {
    fs.writeFileSync(testCase.create.file, testCase.create.text, 'utf8');
    undo.push(() => fs.rmSync(testCase.create.file, { force: true }));
  }
  const mutations = testCase.mutations ?? [];
  for (const mutation of mutations) {
    const original = fs.readFileSync(mutation.file, 'utf8');
    if (!original.includes(mutation.from)) {
      undoAll(undo);
      return { undo: [], isStale: true };
    }
    fs.writeFileSync(mutation.file, original.split(mutation.from).join(mutation.to), 'utf8');
    undo.push(() => fs.writeFileSync(mutation.file, original, 'utf8'));
  }
  return { undo, isStale: false };
}

/** 记录本次自检是在哪个 HEAD / 工作区状态下做的（产物新鲜度靠它判定） */
function gitState() {
  try {
    // git 是本机开发工具，PATH 由用户环境决定；这里只传固定子命令，无外部输入拼入
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: REPO, encoding: 'utf8' }).trim() !== '';
    return { gitSha: sha, workingTreeDirty: dirty };
  } catch {
    return { gitSha: null, workingTreeDirty: true };
  }
}

/**
 * 落盘产物，供 /review 的 detectorReport 步骤消费（引擎不在这里跑变异测试：
 * 它会改工作区，只适合人工/CI 触发）。产物契约见 docs/testing-guards.md。
 */
function writeReport(results, passed) {
  const state = gitState();
  const reportsDirectory = path.join(REPO, '.claude', 'reports');
  fs.mkdirSync(reportsDirectory, { recursive: true });
  const now = new Date();
  // 时间戳里的 `:` 和 `.` 在 Windows 路径上非法，统一换成 `-`
  const file = path.join(reportsDirectory, `detector-sweep-${now.toISOString().replaceAll(/[:.]/g, '-')}.json`);
  const payload = {
    stamp: now.toISOString(),
    ...state,
    total: CASES.length,
    passed,
    stale: results.filter((r) => r.stale).map((r) => r.name),
    failed: results.filter((r) => !r.ok && !r.stale).map((r) => r.name),
  };
  fs.writeFileSync(file, JSON.stringify(payload, undefined, 2), 'utf8');
  return file;
}

const results = [];
for (const testCase of CASES) {
  const applied = applyCase(testCase);
  if (applied.isStale) {
    results.push({ name: testCase.name, ok: false, stale: true });
    continue;
  }

  const mutatedExit = runWithUndo(testCase.test, applied.undo);
  const cleanExit = runTest(testCase.test);
  results.push({ name: testCase.name, ok: mutatedExit !== 0 && cleanExit === 0, stale: false, mutatedExit, cleanExit });
}

const rows = results.map((r) => {
  if (r.stale) return `⚠ 注入点没匹配到（用例过期）  ${r.name}`;
  if (r.ok) return `✅ 注入后红 / 复原后绿  ${r.name}`;
  return `❌ 注入 exit=${r.mutatedExit} 复原 exit=${r.cleanExit}  ${r.name}`;
});
process.stdout.write(rows.join(LF) + LF);

const passed = results.filter((r) => r.ok).length;
process.stdout.write(`${passed}/${CASES.length} 个探测器有效${LF}`);
process.stdout.write(`自检记录已落盘：${writeReport(results, passed)}${LF}`);
process.exitCode = passed === CASES.length ? 0 : 1;
