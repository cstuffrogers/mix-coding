import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  toJsRegExp,
  loadCorpus,
  refute,
  scanText,
  handleInsecureDefaults,
  formatCandidates,
} from './insecure-defaults.js';

const SKILL_ROOT = join(process.cwd(), '.claude', 'skills', 'insecure-defaults');

/** 用真实 vendored 规则集（不复制正则，避免与技能漂移）。 */
const corpus = loadCorpus(process.cwd());

function cats(line, rel = 'src/app.js') {
  return scanText(line, rel, corpus, 'code').flatMap((c) => c.categories);
}

describe('toJsRegExp / 语料加载', () => {
  it('把 POSIX 字符类翻成 JS 语法', () => {
    const re = toJsRegExp('a[[:space:]]b');
    expect(re.test('a b')).toBe(true);
    expect(re.test('a\tb')).toBe(true);
  });

  it('非法正则返回 null 而不是抛错', () => {
    expect(toJsRegExp('(unclosed')).toBeNull();
  });

  it('POSIX 类嵌在字符类里也要转对（否则这条种子永久漏报）', () => {
    // 上游 default-credentials 的 DSN 种子：`[^:@[:space:]]+`
    const re = toJsRegExp('://[^:@[:space:]]+:[^@[:space:]]+@');
    expect(re.source).not.toContain('[[:');
    expect(re.test('postgres://app:s3cret@db.internal/prod')).toBe(true);
    expect(re.test('postgres://app name:s3cret@db.internal/prod')).toBe(false);
  });

  it('读到 6 类规则，且每类都有种子', () => {
    expect(corpus).toHaveLength(6);
    for (const c of corpus) expect(c.rules.length).toBeGreaterThan(0);
  });

  it('引擎自带技能是兜底：目标项目没装技能也能扫', () => {
    expect(loadCorpus(SKILL_ROOT)).toHaveLength(6);
    // 5 级解析链最后一层是引擎自带的 .claude/skills，所以不存在的项目目录仍能拿到规则集。
    expect(loadCorpus('/nonexistent-project')).toHaveLength(6);
    expect(loadCorpus('/nonexistent-project', '/nope/none')).toEqual([]);
  });
});

describe('种子大小写敏感性（误报防线）', () => {
  it('不因 /i 把 hasVerify = false 当成 fail-open 开关', () => {
    // 大小写敏感 → 种子本身就不命中（比「命中后证伪」更干净）。
    expect(cats('let hasVerify = false;')).toEqual([]);
    expect(cats('checkAcceptance(flow, steps, allowNoVerify = false)')).toEqual([]);
  });

  it('真 fail-open 开关仍然命中', () => {
    expect(cats('TLS_VERIFY = false')).toContain('fail-open-security');
    expect(cats('InsecureSkipVerify: true')).toContain('fail-open-security');
  });
});

describe('fallback-secrets：兜底密钥', () => {
  it('兜底真密钥 → 候选', () => {
    expect(cats("const SECRET_KEY = process.env.SECRET_KEY || 'sk-live-abc123'")).toContain(
      'fallback-secrets'
    );
  });

  it('端口/临时目录这类非秘密变量 → 证伪', () => {
    expect(cats("const port = process.env.PORT || '3000'")).toEqual([]);
    expect(cats("tmpDir = process.env.TMPDIR || '/tmp'")).toEqual([]);
  });

  it('客户端公开前缀 → 证伪（本来就要打包进前端）', () => {
    expect(cats("VITE_FOO = import.meta.env.VITE_FOO || 'x'")).toEqual([]);
    expect(refute('fallback-secrets', "PUBLIC_KEY = os.environ.get('PUBLIC_KEY', 'abc')")).toMatch(
      /公开变量/
    );
  });

  it('模板插值不是字面默认值', () => {
    expect(refute('fallback-secrets', "TOKEN: '${TOKEN}'")).toMatch(/插值/);
  });

  it('类型 schema 描述不是字面值', () => {
    expect(cats("token: { type: 'string', description: 'API token' }")).toEqual([]);
  });
});

describe('default-credentials：默认凭据', () => {
  it('真默认口令 → 候选', () => {
    expect(cats("password = 'hunter2pass'")).toContain('default-credentials');
    expect(cats("admin: 'admin'")).toContain('default-credentials');
    expect(cats('postgres://app:s3cret@db.internal:5432/prod')).toContain('default-credentials');
  });

  it('文档示例地址（example.com）不算真凭据', () => {
    expect(cats('postgres://app:s3cret@db.example.com/prod')).toEqual([]);
  });

  it('占位符 → 证伪', () => {
    expect(cats('password = "your-password-here"')).toEqual([]);
    expect(cats('api_key = "<YOUR_API_KEY>"')).toEqual([]);
    expect(cats('token = "changeme"')).toContain('default-credentials');
  });

  it('角色键的值不是默认凭据 → 证伪（test: testPassed 这类误报）', () => {
    expect(cats("test: 'testPassed', typecheck: 'typecheckPassed'")).toEqual([]);
    expect(cats("user: 'Features'")).toEqual([]);
  });
});

describe('weak-crypto：弱加密', () => {
  it('密码散列用 md5 → 候选', () => {
    expect(cats("const hash = md5(password)")).toContain('weak-crypto');
    expect(cats('hashlib.md5(password.encode()).hexdigest()')).toContain('weak-crypto');
  });

  it('etag/校验和/临时文件名用途 → 证伪', () => {
    expect(cats("const etag = md5(body)")).toEqual([]);
    expect(cats("tmp = dir / f'_cg_bench_{hashlib.md5(content.encode()).hexdigest()[:8]}.py'")).toEqual(
      []
    );
  });
});

describe('permissive-access：过度放行', () => {
  it('CIDR 全网放行 → 候选', () => {
    expect(cats('cidr_blocks = ["0.0.0.0/0"]', 'main.tf')).toContain('permissive-access');
    expect(cats('chmod 777 uploads', 'deploy.sh')).toContain('permissive-access');
  });

  it('监听地址 0.0.0.0 不是放行规则 → 证伪', () => {
    expect(cats("app.listen(3000, '0.0.0.0')", 'server.js')).toEqual([]);
  });

  it('标准权限位与十六进制颜色 → 证伪', () => {
    expect(cats("require('fs').chmodSync('bin/cli.js', 0o755)", 'scripts/build.js')).toEqual([]);
    expect(cats("palette: { primary: '#000000', accent: '#0000EE' }", 'theme.js')).toEqual([]);
  });
});

describe('debug-features：调试特性泄漏', () => {
  it('生产配置开 debug → 候选', () => {
    expect(cats('debug: true')).toContain('debug-features');
    expect(cats('DEBUG = True', 'config/prod.py')).toContain('debug-features');
  });

  it('日志 sink 与显式关闭 → 证伪', () => {
    expect(cats('logger.error("boom", exc_info=True)')).toEqual([]);
    expect(cats('console.log(e.stack)')).toEqual([]);
  });
});

describe('全局证伪层', () => {
  it('注释行不算', () => {
    expect(cats("// password = 'hunter2pass'")).toEqual([]);
    expect(cats("# SECRET_KEY = 'sk-live-abc'")).toEqual([]);
  });

  it('测试/夹具目录与测试文件名不算', () => {
    expect(cats("password = 'hunter2pass'", 'tests/fixtures/a.js')).toEqual([]);
    expect(cats("password = 'hunter2pass'", 'src/a.test.js')).toEqual([]);
  });

  it('文档/示例/vendor 目录不算', () => {
    expect(cats("password = 'hunter2pass'", 'docs/examples/a.md')).toEqual([]);
    expect(cats("password = 'hunter2pass'", 'node_modules/x/a.js')).toEqual([]);
  });

  it('正则字面量定义（检测器自身）不算', () => {
    expect(cats("const SELF_DEF = /0.0.0.0\\/0|cidr/", 'src/rules.js')).toEqual([]);
  });
});

describe('scanText 结构与去重', () => {
  it('同一行命中多条种子只算一条候选，类目合并', () => {
    const found = scanText("password = 'admin'  # md5(password)", 'src/a.js', corpus, 'code');
    expect(found).toHaveLength(1);
    expect(found[0].categories.length).toBeGreaterThanOrEqual(1);
    expect(found[0].line).toBe(1);
  });

  it('带行号与代码片段', () => {
    const found = scanText("const ok = 1;\nconst SECRET_KEY = 'sk-live-abc';\n", 'src/a.js', corpus, 'code');
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(2);
    expect(found[0].snippet).toContain('SECRET_KEY');
  });
});

describe('handleInsecureDefaults：输出契约', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idscan-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function write(rel, body) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }

  it('有候选 → 措辞是「候选」而不是「失败/阻断」', () => {
    write('src/app.js', "const SECRET_KEY = process.env.SECRET_KEY || 'sk-live-abc123';\n");
    const ctx = {};
    const msg = handleInsecureDefaults(null, {}, dir, ctx);
    expect(msg).toMatch(/候选扫描完成: 1 处候选/);
    expect(msg).toMatch(/种子命中不等于漏洞/);
    expect(msg).not.toMatch(/失败|阻断/);
    expect(ctx.insecureDefaultsCandidates).toHaveLength(1);
    expect(ctx.insecureDefaultsScanned).toBeGreaterThan(0);
  });

  it('0 候选 → pass 措辞（含扫描文件数）', () => {
    write('src/app.js', 'export const a = 1;\n');
    const ctx = {};
    const msg = handleInsecureDefaults(null, {}, dir, ctx);
    expect(msg).toMatch(/0 处候选/);
    expect(msg).toMatch(/扫描 \d+ 个文件/);
    expect(ctx.lastStepFailed).toBeUndefined();
  });

  it('scope=tests 只扫测试目录（文件选择层，不是证伪层）', () => {
    write('src/a.js', "password = 'hunter2pass';\n");
    write('tests/a.js', "password = 'hunter2pass';\n");
    const codeCtx = {};
    handleInsecureDefaults(null, { scope: 'code' }, dir, codeCtx);
    expect(codeCtx.insecureDefaultsCandidates.map((c) => c.file)).toEqual(['src/a.js']);

    const testCtx = {};
    handleInsecureDefaults(null, { scope: 'tests' }, dir, testCtx);
    expect(testCtx.insecureDefaultsCandidates.map((c) => c.file)).toEqual(['tests/a.js']);
  });

  it('0 文件 → 判失败并给「未找到」措辞（不能伪装成没问题）', () => {
    const ctx = {};
    const msg = handleInsecureDefaults(null, {}, dir, ctx);
    expect(msg).toMatch(/未找到可扫描的源文件/);
    expect(ctx.lastStepFailed).toBe(true);
  });

  it('规则集缺失 → 「未找到」→ 引擎判 noop', () => {
    write('src/app.js', 'export const a = 1;\n');
    const msg = handleInsecureDefaults(null, { rules_dir: '/nope/none' }, dir, {});
    expect(msg).toMatch(/未找到 insecure-defaults 规则集/);
  });

  it('配置文件也在扫描范围内（.toml/.env/yml）', () => {
    write('config.toml', 'api_key = "sk-live-abcdefghij"\n');
    const ctx = {};
    handleInsecureDefaults(null, {}, dir, ctx);
    expect(ctx.insecureDefaultsCandidates.some((c) => c.file === 'config.toml')).toBe(true);
  });

  it('formatCandidates 输出可读清单', () => {
    write('src/app.js', "const SECRET_KEY = 'sk-live-abcdef';\n");
    const ctx = {};
    handleInsecureDefaults(null, {}, dir, ctx);
    const text = formatCandidates(ctx.insecureDefaultsCandidates).join('\n');
    expect(text).toContain('src/app.js:1');
    expect(text).toMatch(/候选/);
  });
});
