import { join, dirname, resolve, delimiter } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── 两套根目录，语义不同，别混用 ─────────────────────────────────────────
//
// PACKAGE_ROOT   引擎自身的安装位置（全局安装后 = npm 全局目录）。
//                只用来找「随包分发」的资源：scenes（默认内置场景）。
//
// PROJECT_ROOT   用户当前操作的项目 = process.cwd()（可用 --target 覆盖）。
//                用来找「项目级」资源：.claude/skills、.claude/mcp.json、
//                .claude/memory、.codegraph 等 —— 这些必须属于被审查的项目，
//                而不是引擎安装目录。
//
// 为什么拆开：早期 PROJECT_ROOT 由 __dirname 上溯三级得到，等于把引擎绑定在
// 仓库结构上，装到全局后所有路径都指向 npm 全局目录，其他项目无法使用。
export const PACKAGE_ROOT = join(__dirname, '..', '..');
export const PACKAGE_SCENES_DIR = join(PACKAGE_ROOT, 'scenes');

/** 允许通过环境变量强制切换工作目录（CI、测试、脚本化调用） */
export const PROJECT_ROOT = process.env.MIX_CODING_PROJECT_DIR
  ? resolve(process.env.MIX_CODING_PROJECT_DIR)
  : process.cwd();

/** 用户级共享资源目录（跨项目复用：自建场景、共享记忆） */
export const USER_DATA_DIR = process.env.MIX_CODING_HOME
  ? resolve(process.env.MIX_CODING_HOME)
  : join(homedir(), '.mix-coding');

/**
 * 场景查找路径（按优先级从高到低）：
 *   1. $MIX_CODING_SCENES_DIR      显式覆盖（CI/调试用，只认这一个目录）
 *   2. <项目>/.claude/scenes       项目级覆盖层 —— 同名场景优先于内置
 *   3. ~/.mix-coding/scenes        用户级自建/覆盖场景
 *   4. <包>/scenes                 随包分发的内置场景（兜底，永远存在）
 */
export function getSceneDirs() {
  const explicit = process.env.MIX_CODING_SCENES_DIR;
  if (explicit) return [resolve(explicit)];
  return [
    join(PROJECT_ROOT, '.claude', 'scenes'),
    join(USER_DATA_DIR, 'scenes'),
    PACKAGE_SCENES_DIR,
  ];
}

/** 解析单个场景 JSON 的绝对路径；找不到返回 null。优先级见 getSceneDirs */
export function resolveScenePath(sceneId) {
  for (const dir of getSceneDirs()) {
    const candidate = join(dir, `${sceneId}.json`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** 列出所有可见场景 id（后层同名场景不覆盖前者，仅取首次出现） */
export function listSceneIds() {
  const seen = new Set();
  for (const dir of getSceneDirs()) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const id = file.replace(/\.json$/, '');
      if (id === 'README') continue;
      seen.add(id);
    }
  }
  return [...seen].sort();
}

/** 首个存在的场景目录（用于 --list 之类需要单一目录的场景） */
export function getPrimarySceneDir() {
  return getSceneDirs().find((d) => existsSync(d)) || PACKAGE_SCENES_DIR;
}

// ── 项目级资源（属于「被操作的那个项目」） ───────────────────────────────
export const SCENES_DIR = join(PROJECT_ROOT, '.claude', 'scenes');
export const MEMORY_DIR = join(PROJECT_ROOT, '.claude', 'memory');

// ── 用户级记忆后端 ──────────────────────────────────────────────────────
export const CLAUDE_MEM_DIR = join(homedir(), '.claude', 'memory');
export const AGENTMEMORY_DIR = join(homedir(), '.agentmemory');
export const NEXO_DIR = join(homedir(), '.nexo');
export const CODEGRAPH_DB = join(PROJECT_ROOT, '.codegraph', 'codegraph.db');

/**
 * 查找随包/随项目分发的资源目录（skills、rules、templates 等）。
 * 顺序：项目级 → 用户级 → 包级。返回首个存在者，全不存在返回项目级路径。
 */
export function findResourceDir(...segments) {
  const candidates = [
    join(PROJECT_ROOT, '.claude', ...segments),
    join(USER_DATA_DIR, ...segments),
    join(PACKAGE_ROOT, ...segments),
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

/**
 * 查找外部可选工具（open-design 等）的根目录。
 * 这些不是必装依赖，缺失时调用方应当优雅跳过。
 */
export function findOptionalToolDir(toolName) {
  const candidates = [
    process.env.MIX_CODING_TOOLS_DIR && join(process.env.MIX_CODING_TOOLS_DIR, toolName),
    join(PROJECT_ROOT, toolName),
    join(USER_DATA_DIR, 'tools', toolName),
    join(PACKAGE_ROOT, 'tools', toolName),
  ].filter(Boolean);
  return candidates.find((p) => {
    try {
      return existsSync(p) && statSync(p).isDirectory();
    } catch {
      return false;
    }
  }) || candidates[candidates.length - 1];
}

/** 供诊断输出：当前生效的解析结果 */
export function describePaths() {
  return {
    projectRoot: PROJECT_ROOT,
    packageRoot: PACKAGE_ROOT,
    userDataDir: USER_DATA_DIR,
    sceneDirs: getSceneDirs(),
    sceneCount: listSceneIds().length,
    pathSeparator: delimiter,
  };
}
