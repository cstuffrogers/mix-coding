import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

const ENDPOINT_GLOBS = ['src/routes', 'src/api', 'pages/api', 'app/api', 'src/controllers', 'api'];

function checkRunme(targetPath) {
  try {
    const out = safeExec('npx runme --version 2>&1', targetPath, { stdio: 'pipe' }).toString().trim();
    return { available: true, version: out };
  } catch { return { available: false, version: '' }; }
}

function scanEndpoints(targetPath) {
  const endpoints = [];
  for (const dir of ENDPOINT_GLOBS) {
    const full = join(targetPath, dir);
    if (!existsSync(full)) continue;
    try {
      const entries = readdirSync(full, { recursive: true });
      for (const entry of entries) {
        const ext = entry.split('.').pop();
        if (['ts', 'js', 'tsx', 'jsx', 'py', 'go', 'rb', 'rs'].includes(ext)) {
          endpoints.push({ dir, file: entry, path: join(full, entry) });
        }
      }
    } catch { /* skip unreadable dirs */ }
  }
  return endpoints;
}

function detectPort(targetPath) {
  const pkgPath = join(targetPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkgRaw = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      const devScript = pkg.scripts?.dev || '';
      const portMatch = devScript.match(/(?:--port[=\s]+|PORT=)(\d{4,5})/i);
      if (portMatch) return portMatch[1];
    } catch { /* ignore */ }
  }
  const envPath = join(targetPath, '.env');
  if (existsSync(envPath)) {
    try {
      const env = readFileSync(envPath, 'utf-8');
      const portMatch = env.match(/PORT\s*=\s*(\d{4,5})/i);
      if (portMatch) return portMatch[1];
    } catch { /* ignore */ }
  }
  return '3000';
}

function generateRunbook(ep, port) {
  const name = ep.file.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
  const route = `/${name.replace(/^index$/, '')}`;
  return `# ${name} — Incident Runbook

<!-- runme -->
<!-- {"runme":{"id":"${ep.dir}/${ep.file}"}} -->

## Service: ${ep.dir}/${ep.file}
**Port**: ${port}
**Endpoint**: \`http://localhost:${port}${route}\`

---

## 1. Health Check

\`\`\`sh {"id":"01J0000000000","name":"health-check"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}${route}
\`\`\`

\`\`\`sh {"id":"01J0000000001","name":"health-check-verbose"}
curl -v http://localhost:${port}${route} 2>&1 | head -20
\`\`\`

## 2. Common Issues

### 2.1 服务无响应
- 检查进程：\`ps aux | grep node\` (or \`tasklist | findstr node\`)
- 检查端口占用：\`lsof -i :${port}\` (or \`netstat -ano | findstr :${port}\`)
- 查看最近日志

### 2.2 5xx 错误
- 检查应用日志：\`tail -f logs/app.log\` or \`pm2 logs\`
- 检查数据库连接：确认 \`DATABASE_URL\` 正确
- 检查外部 API 可达性

### 2.3 性能下降
- 检查 CPU/内存使用率
- 检查慢查询日志
- 检查并发连接数

## 3. Escalation

| 严重度 | 响应时间 | 联系人 |
|--------|---------|--------|
| P0 — 全站不可用 | 15 min | On-call Engineer |
| P1 — 核心功能故障 | 30 min | Team Lead |
| P2 — 部分用户受影响 | 2 hours | Developer |
| P3 — 非关键问题 | Next business day | Backlog |

## 4. Logs

\`\`\`sh {"id":"01J0000000002","name":"tail-logs"}
tail -100 logs/app.log 2>/dev/null || echo "No log file found"
\`\`\`

## 5. Rollback

If this endpoint fails after deployment:

\`\`\`sh {"id":"01J0000000003","name":"rollback"}
git log --oneline -5
# git revert <commit-hash>
\`\`\`
`;
}

function generateReadme(endpoints, targetPath) {
  const entries = endpoints.map(ep => {
    const name = ep.file.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
    return `- [${name}](./${name}.md) — ${ep.dir}/${ep.file}`;
  }).join('\n');

  const projectName = targetPath.split(/[/\\]/).pop() || 'project';
  return `# Incident Runbooks — ${projectName}

Auto-generated runbooks for incident response. Each file covers one service endpoint.

## Runbooks

${entries || '- No endpoints detected. Add endpoints to `src/routes/`, `src/api/`, `pages/api/`, or `app/api/`.'}

## Usage

### With Runme (VS Code extension)
Open any \`.md\` file and click ▶ on code blocks to execute commands.

### Without Runme
Copy and paste the shell commands into your terminal.

## Adding New Endpoints

Re-run \`/incident\` after adding new API routes. Runbooks will be regenerated.
`;
}

export function handleIncidentRunbook(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n📋 正在生成 Incident Runbook...'));

  const runme = checkRunme(targetPath);
  if (runme.available) {
    console.log(chalk.dim(`  Runme: ${runme.version}`));
  } else {
    console.log(chalk.yellow('  ⚠ Runme CLI 未安装，将生成纯 Markdown（无 Runme 执行支持）'));
  }

  const endpoints = scanEndpoints(targetPath);
  const port = detectPort(targetPath);
  console.log(chalk.dim(`  检测到 ${endpoints.length} 个 API 端点，默认端口 ${port}`));

  const incidentsDir = join(targetPath, 'incidents');
  let runbookCount = 0;

  try {
    if (!existsSync(incidentsDir)) mkdirSync(incidentsDir, { recursive: true });

    if (endpoints.length === 0) {
      console.log(chalk.yellow('  ⚠ 未检测到 API 端点，生成通用 runbook'));
      const genericPath = join(incidentsDir, 'GENERIC.md');
      const genericEp = { dir: 'unknown', file: 'GENERIC.md' };
      writeFileSync(genericPath, generateRunbook(genericEp, port), 'utf-8');
      runbookCount = 1;
    } else {
      for (const ep of endpoints) {
        const name = ep.file.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
        const runbookPath = join(incidentsDir, `${name}.md`);
        writeFileSync(runbookPath, generateRunbook(ep, port), 'utf-8');
        runbookCount++;
      }
      console.log(chalk.green(`  ✅ ${runbookCount} 个 runbook 已生成`));
    }

    const readmePath = join(incidentsDir, 'README.md');
    writeFileSync(readmePath, generateReadme(endpoints, targetPath), 'utf-8');
    console.log(chalk.green('  ✅ incidents/README.md 已生成'));
  } catch (e) {
    console.log(chalk.red(`  ❌ 生成失败: ${e.message}`));
    if (context) {
      context.incidentRunbookCreated = false;
      context.lastStepFailed = true;
    }
    return 'Incident Runbook 生成失败';
  }

  if (context) {
    context.incidentRunbookCreated = true;
    context.runbookCount = runbookCount;
    context.runmeAvailable = runme.available;
  }

  return `Incident Runbook 生成完成（${runbookCount} 个端点）`;
}
