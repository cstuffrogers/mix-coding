import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { PROJECT_ROOT } from './paths.js';

// 宿主配置位置不止一个：项目级 .pi/mcp.json 优先，其次 pi 用户级
// ~/.pi/agent/mcp.json，最后是老的 Claude Code 位置（宿主已卸载，留着只为其它机器）。
// 项目级条目按 pi 的语义覆盖同名用户级条目。
const MCP_CONFIG_RELS = [
  ['.pi', 'mcp.json'],
  ['HOME', '.pi', 'agent', 'mcp.json'],
  ['.claude', 'mcp.json'],
];

export function mcpConfigCandidates(root = PROJECT_ROOT, home = homedir()) {
  return MCP_CONFIG_RELS.map(([base, ...rest]) =>
    (base === 'HOME' ? join(home, ...rest) : join(root, base, ...rest)));
}

/**
 * 读第一个存在的 MCP 配置文件，返回 { path, servers: Set<name> }。
 * 找不到文件时 path = null、servers 为空集 —— 调用方据此判定「没装」而不是「也许有」。
 */
export function loadMcpServers(root = PROJECT_ROOT, home = homedir()) {
  for (const candidate of mcpConfigCandidates(root, home)) {
    if (!existsSync(candidate)) continue;
    const servers = new Set();
    try {
      const parsed = JSON.parse(readFileSync(candidate, 'utf-8'));
      for (const [name, cfg] of Object.entries(parsed.mcpServers || {})) {
        // pi 支持 enabled: false 只停用不删除，停用的不能算可用
        if (cfg && cfg.enabled === false) continue;
        servers.add(name);
      }
    } catch {
      // 配置语法错也必须当成「没装」，不能猜
      return { path: candidate, servers: new Set(), broken: true };
    }
    return { path: candidate, servers, broken: false };
  }
  return { path: null, servers: new Set(), broken: false };
}

// 条件名 → 配置文件里可能出现的 server 名（别名来自各家文档/官方包名）
const MCP_CONDITION_SERVERS = {
  github: ['github'],
  sentry: ['sentry'],
  tavily: ['tavily', 'tavily-search'],
  context7: ['context7'],
  codegraph: ['codegraph', 'code-review-graph', 'crg'],
  supabase: ['supabase'],
  stripe: ['stripe'],
  resend: ['resend'],
  mobsf: ['mobsf'],
  bearer: ['bearer'],
  playwright: ['playwright', '@playwright/mcp'],
};

/**
 * 某个 MCP server 是否真的配了。之前这里是 isConversationMode()，等于「在对话里就
 * 假定什么 MCP 都有」—— 配置里只剩 3 个 server 时它仍然全部返回 true，场景于是
 * 排了一堆调用不存在的工具的步骤。
 */
export function hasMcpServer(kind, root = PROJECT_ROOT, home = homedir()) {
  const aliases = MCP_CONDITION_SERVERS[kind] || [kind];
  const { servers } = loadMcpServers(root, home);
  return aliases.some((name) => servers.has(name));
}
