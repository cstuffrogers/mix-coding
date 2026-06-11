#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
  .option('--theme <name>', '指定主题（daisyui/animal-island/custom）')
  .action(async (...args) => {
    const { startScene } = await import('./commands/start.js');
    return startScene(...args);
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
  .action(async (action, options) => {
    const { executeAction } = await import('./actions.js');
    const targetPath = process.cwd();
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
    syncAllDocs(projectRoot);
  });

program.parse();