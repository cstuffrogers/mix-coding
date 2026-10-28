#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let pkg = { version: '0.0.0' };
try {
  pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
} catch (e) {
  if (e.code === 'ENOENT') {
    console.error(chalk.red('✖ 未找到 package.json，使用默认版本号'));
  } else if (e instanceof SyntaxError) {
    console.error(chalk.red('✖ package.json 格式错误，使用默认版本号'));
  } else {
    console.error(chalk.red('✖ 无法读取 package.json，使用默认版本号'));
  }
}

const program = new Command();

program
  .name('claude-scene')
  .description(chalk.cyan('Claude Code 场景选择器 — 按场景模板自动编排开发流程'))
  .version(pkg.version);

program
  .command('list')
  .description('查看所有可用场景')
  .option('-v, --verbose', '显示详细场景信息')
  .action(async (...args) => {
    const { listScenes } = await import('./commands/list.js');
    return listScenes(...args);
  });

program
  .command('start')
  .description('启动指定场景')
  .argument('<scene_id>', '场景ID（如 new-project / feature / bugfix / review）')
  .option('-p, --prompt <text>', '用户需求描述')
  .option('--dry-run', '仅显示执行计划，不实际执行')
  .option('-t, --target <path>', '目标项目路径')
  .option('--auto', '自动模式，跳过所有交互式提示，使用默认值')
  .option('--enh <keys>', '逗号分隔的增强项键名（覆盖默认勾选）')
  .option('--theme <name>', '指定主题（daisyui/animal-island/custom）')
  .option('-k, --kind <id>', '指定单选分支（setup: e2e/monitor/property）')
  .option('-i, --iterations <n>', '迭代轮数（loop 等自动迭代场景，默认 1，上限 20）')
  .option('-F, --force-iterations', '发现数不下降也把 --iterations 轮数跑满（默认会提前收敛退出）')
  .option('-e, --strict-enclosure', '边界越限立即中止整个工作流（默认只判该步骤失败并继续）')
  .option('-S, --with-sweep', 'review 前现场跑一次探测器自检（2~3 分钟，需工作区干净），否则 2.7 只能读旧记录')
  .option('--skip-sweep', 'review 明确跳过现场自检；非交互环境下代替用户回答「不跑」')
  .option('-y, --yes', '对需要确认的步骤（提交/推送/发布/回滚/自动重构…）统一回答「是」；非交互环境下代替用户表态')
  .option('--decline', '对需要确认的步骤统一回答「否」；非交互环境下代替用户表态（--no 在 commander 里是取反语法，故用此名）')
  .option('--choice <value>', '对需要单选的步骤（版本类型/更新策略/性能问题/回滚目标…）直接给值，不再默认取第一项')
  .option('--brand <name>', 'design/new-project/ui-polish: 指定品牌设计系统（vercel/linear/stripe/notion/apple…），不再默认取列表第一个')
  .option('--no-fold', '不折叠步骤输出（默认超过 6 行的 pass/warn 输出折成摘要，完整内容落盘 .claude/logs/）')
  // 旧习惯 `start loop --auto "需求"` 会把需求当多余位置参数直接报错退出。
  // 允许通过，但明确提示应该写 -p，并把它当需求用（否则用户只看到一行 red 报错）。
  .allowExcessArguments(true)
  .action(async (sceneId, options, command) => {
    const extraArgs = (command?.args || []).slice(1);
    if (extraArgs.length > 0) {
      console.log(chalk.yellow(`  ⚠ 需求应写成 -p "..."，已把多余的位置参数当作需求：${extraArgs.join(' ').slice(0, 40)}`));
      options.prompt = options.prompt || extraArgs.join(' ');
    }
    const { startScene } = await import('./commands/start.js');
    return startScene(sceneId, options);
  });

program
  .command('show')
  .description('查看场景详情')
  .argument('<scene_id>', '场景ID')
  .action(async (...args) => {
    const { showScene } = await import('./commands/show.js');
    return showScene(...args);
  });

program
  .command('fork')
  .description('基于现有场景创建自定义场景')
  .argument('<scene_id>', '要复制的场景ID')
  .option('-n, --name <name>', '新场景名称')
  .option('-o, --output <path>', '输出路径')
  .option('--dry-run', '仅预览，不写入文件')
  .action(async (...args) => {
    const { forkScene } = await import('./commands/fork.js');
    return forkScene(...args);
  });

program
  .command('memory')
  .description('记忆工具：recall / remember / list / consolidate')
  .argument('<action>', 'recall | remember | list | consolidate')
  .option('-t, --type <type>', '记忆类型（general/security/architecture/bugfix/audit 等）')
  .option('-d, --data <json>', '要保存的数据（JSON 字符串）')
  .option('-c, --category <cat>', '过滤类别')
  .option('-l, --limit <n>', '限制条数', '10')
  .option('-T, --target <path>', '目标项目路径（默认当前目录；-t 是记忆类型，别混用）')
  .action(async (action, options) => {
    const { executeAction } = await import('./actions.js');
    // 记忆库按项目归属：没有 --target 时只能操作 cwd，跨项目查/写会落错地方。
    // （-t 是记忆类型，不是 target，两者混用会把类型变成路径。）
    const targetPath = options.target ? resolve(options.target) : process.cwd();
    const context = { _sceneId: 'cli' };
    const actionMap = {
      recall: 'recall',
      remember: 'remember',
      list: 'listMemories',
      consolidate: 'consolidate',
    };
    const mappedAction = actionMap[action];
    if (!mappedAction) {
      console.error('未知操作: ' + action + '，可选: recall / remember / list / consolidate');
      process.exit(1);
    }
    const params = {};
    if (options.type) params.type = options.type;
    if (options.data) {
      try { params.data = JSON.parse(options.data); }
      catch { params.content = options.data; }
    }
    if (options.category) params.category = options.category;
    if (options.limit) params.limit = parseInt(options.limit, 10);
    const result = await executeAction('cli', mappedAction, params, context, targetPath);
    console.log(result);
  });

program
  .command('sync-docs')
  .description('同步文档（根据场景 JSON 自动更新 CLAUDE.md 等文件）')
  .action(async () => {
    const { syncAllDocs } = await import('./lib/sync-docs.js');
    const projectRoot = process.env.AUTO_CODING_ROOT || join(__dirname, '..', '..');
    const report = syncAllDocs(projectRoot);
    // 以前 syncAllDocs 的返回值被丢掉、自己也不打印 —— 跑完一片空白，
    // 分不清「已同步」还是「压根没找到标记」。
    if (report.updated.length > 0) {
      console.log(`✅ 已同步 ${report.updated.length} 个区块:`);
      for (const item of report.updated) console.log(`   ${item}`);
    }
    if (report.unchanged.length > 0) {
      console.log(`ℹ 内容已是最新 ${report.unchanged.length} 个区块`);
    }
    if (report.manual.length > 0) {
      // 人排的表格（CLAUDE.md 工作流速查）不自动改写。没有标记 = 不托管，不是缺失 ——
      // 两件事混成一个 ⚠，人只会去加一层本来就有的标记。
      console.log(`ℹ ${report.manual.length} 个区块人工维护（不是缺失，想接管就加 AUTO-SYNC 标记）:`);
      for (const item of report.manual) console.log(`   ${item}`);
    }
    if (report.missingMarker.length > 0) {
      console.warn(`⚠ ${report.missingMarker.length} 个目标缺 AUTO-SYNC 标记（未同步）:`);
      for (const item of report.missingMarker) console.warn(`   ${item}`);
    }
    if (report.missingFile.length > 0) {
      console.warn(`⚠ ${report.missingFile.length} 个目标文件不存在:`);
      for (const item of report.missingFile) console.warn(`   ${item}`);
    }
    if (report.updated.length === 0 && report.missingMarker.length === 0 && report.missingFile.length === 0) {
      console.log('ℹ 文档已与实际场景一致，无需修改');
    }  });

program.parse();