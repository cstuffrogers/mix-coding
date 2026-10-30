/**
 * 「外部工具」名单一致性：正文清单 / 逐工具表 / 按类型表 / 真值表，必须是同一批名字。
 *
 * 用法：node scripts/check-toolchain-lists.cjs [root]
 *
 * 退出码：
 *   0 = 全部对得上
 *   1 = 有名单跟真值对不上（逐条打印「真值里有、这里没有」/「这里写了、真值里没有」）
 *   2 = 扫描面塌了（文档读不到、表格没认出来、真值少得离谱）—— 结论不可信
 *
 * 为什么不能只比「声明的数字 vs 点了几个名」：那样 `README.md` 的「29 个工具（…29 个名…）」
 * 是自洽的，`check-doc-counts` 一路绿灯 —— **文件跟自己对齐**被当成了「跟真值对齐」。
 * 真值是 `security-toolchain.md` 的工具表（引擎步骤由 check-tool-steps.cjs 校验）。
 *
 * 两个概念别混：
 *   · 外部**安全**工具链 = 真值表 33 个（正文清单、逐工具表都必须等于这一批）
 *   · 外部工具（按类型）= 安装清单 28 个（含 act/restic/specify-cli，不含 codeguardian/critiq）
 *     —— 只自查内部算术（Count 列之和 = 标题数）与中英两版是否同一批东西。
 */
const path = require('path');
const { checkRoot } = require('./lib/toolchain.cjs');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const { code, problems, facts } = checkRoot(ROOT);

for (const fact of facts) console.log(`  ${fact}`);

if (code === 2) {
  console.error('\n✗ 扫描面塌了 —— 这些结论不可信：');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(2);
}

if (code === 1) {
  console.error(`\n✗ 名单跟真值对不上（${problems.length} 条）：`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\n修法：以 security-toolchain.md 的工具表为准，名单只能搬它的名字（工具名写错不是「同义词」）。');
  process.exit(1);
}

console.log('\n✓ 正文清单 / 逐工具表 / 按类型表 全部与真值一致');
