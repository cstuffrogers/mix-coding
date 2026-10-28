// 仓库根的配置文件里不许出现明文凭据。
//
// 为什么要有这条测试：`codewhale-config.toml` 曾经把一把 `sk-` 明文 key 提交进仓库
// （`013c00c`），而当时的 `secret-scan.js` 连 `sk-` 规则都没有，从头到尾报「未发现
// 明文密钥」（详见 docs/SECURITY.md §1）。检测器修好了，但检测器只在 review 场景
// step 4.551 跑——也就是说「有人手滑把 key 粘回模板文件」这件事，只要没人跑全量
// review 就没人管。测试是最后一道防线：改坏了立刻红。
//
// 范围刻意很窄：只看仓库根的配置文件。src/** 里的测试夹具本来就要放各种假 key
// （`ghp_test123` 之类），扫全仓库会把守卫变成噪声，噪声守卫等于没有守卫。
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

// 各家凭据的字面前缀 / 结构。加新规则时同步 docs/SECURITY.md 的覆盖表。
const CREDENTIAL_PATTERNS = [
  ['sk- 明文 key', /sk-[A-Za-z0-9_-]{16,}/],
  ['GitHub PAT (ghp_)', /ghp_[A-Za-z0-9]{20,}/],
  ['GitHub PAT (github_pat_)', /github_pat_\w{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['PEM 私钥', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./],
];

/** 仓库根下需要盯的配置文件（存在才检查，新增模板文件请加进来） */
const ROOT_CONFIG_FILES = new Set([
  'codewhale-config.toml',
  'codewhale-config.local.toml',
  'ruff.toml',
  '.codeguardian.yaml',
  '.env.example',
  'config.toml',
]);

function rootConfigFiles() {
  const extraToml = (() => {
    try {
      return readdirSync(REPO_ROOT)
        .filter(n => n.endsWith('.toml') && !ROOT_CONFIG_FILES.has(n));
    } catch {
      return [];
    }
  })();
  return [...new Set([...ROOT_CONFIG_FILES, ...extraToml])]
    .filter(n => existsSync(join(REPO_ROOT, n)));
}

describe('仓库根配置文件的明文凭据守卫', () => {
  it('至少能读到模板文件（守卫自己不能空转）', () => {
    expect(rootConfigFiles()).toContain('codewhale-config.toml');
  });

  it('没有任何文件含明文凭据', () => {
    const hits = [];
    for (const name of rootConfigFiles()) {
      const text = readFileSync(join(REPO_ROOT, name), 'utf-8');
      for (const [label, re] of CREDENTIAL_PATTERNS) {
        if (re.test(text)) hits.push(`${name}: ${label}`);
      }
    }
    expect(hits, '这些文件里出现了明文凭据（改成 ${ENV_VAR} 占位符，并去供应商后台轮换）：').toEqual([]);
  });

  it('模板文件保持占位符，不许被“帮忙”填成真值', () => {
    const text = readFileSync(join(REPO_ROOT, 'codewhale-config.toml'), 'utf-8');
    expect(text).toContain('${CODEWHALE_API_KEY}');
  });

  it('守卫规则本身对真凭据有效（反向自检）', () => {
    const sample = 'api_key = "sk-abcdef0123456789abcdef"';
    expect(CREDENTIAL_PATTERNS.some(([, re]) => re.test(sample))).toBe(true);
  });
});
