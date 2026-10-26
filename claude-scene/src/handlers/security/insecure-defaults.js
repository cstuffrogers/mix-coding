// 不安全默认值的确定性候选扫描器。
//
// 规则集来自 vendored 的 `insecure-defaults` 技能（`.claude/skills/insecure-defaults/
// references/*.json`，上游 trailofbits/skills，CC BY-SA 4.0）——不在这里复制一份正则，
// 避免两处漂移。这里做的是技能「第 1 步 seed sweep」，也就是只产出**候选**。
//
// 关键纪律（上游 SKILL.md 明确要求）：种子命中 ≠ 漏洞。一个 `getenv('X', 'dev')`
// 可能只是超时时间，`md5(` 可能是在算 etag。所以本扫描器只报「候选，需逐条证伪」，
// 并且先做一层可判定的证伪（注释、测试夹具、占位符、客户端公开变量、日志 sink 等），
// 把明显不是问题的形态直接丢掉。真正的判定留给 `insecure-defaults` 技能的
// Report when / Skip when，以及人。
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative, sep } from 'path';
import { resolveSkillDir } from '../skill-runner.js';
import { listProjectFiles, CODE_EXTS } from '../../lib/project-sources.js';

const SKILL_NAME = 'insecure-defaults';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATES = 200;

// 审计范围要包含配置/部署清单，不只是代码。
const CONFIG_EXTS = ['.yml', '.yaml', '.json', '.toml', '.ini', '.conf', '.properties', '.tf', '.tfvars', '.cfg', '.env'];
const EXTRA_FILES = /(^|\/)(dockerfile|docker-compose[^/]*|makefile|jenkinsfile|procfile|\.env[^/]*|values[^/]*\.ya?ml)$/;

// JS 的 RegExp 不支持 POSIX 字符类，而 vendored 的种子用的是 grep -E 语法。
// 注意：POSIX 类可能**嵌在别的字符类里**（`[^:@[:space:]]+`）。直接字符串替换会
// 变成 `[^:@[\s]]`——多出一个 `]`，导致这条种子永远不命中（漏报）。所以逐字符扫。
const POSIX_CLASSES = {
  space: '\\s',
  alnum: 'A-Za-z0-9',
  alpha: 'A-Za-z',
  digit: '0-9',
  upper: 'A-Z',
  lower: 'a-z',
  xdigit: '0-9A-Fa-f',
  word: '\\w',
};

// POSIX 类的真实语法是 `[:space:]`（一个方括号）；顶层写法 `[[:space:]]` 是
// 外层的 `[…]` 包住 `[:space:]`。所以只认 `[:name:]` 这个 token，再根据
// 当前是否已在字符类内部，决定要不要补外层方括号。
function posixTokenAt(seed, i) {
  if (seed[i] !== '[' || seed[i + 1] !== ':') return null;
  const end = seed.indexOf(':]', i);
  if (end === -1) return null;
  const body = POSIX_CLASSES[seed.slice(i + 2, end)];
  return body ? { body, next: end + 2 } : null;
}

function translatePosix(seed) {
  let out = '';
  let inClass = false;
  let i = 0;
  while (i < seed.length) {
    const token = posixTokenAt(seed, i);
    if (token) {
      out += inClass ? token.body : '[' + token.body + ']';
      i = token.next;
      continue;
    }
    const ch = seed[i];
    if (ch === '[' && seed[i + 1] !== ':') inClass = true;
    else if (ch === ']' && inClass) inClass = false;
    out += ch;
    i += 1;
  }
  return out;
}

// 上游的种子是 `grep -E` 语法，**大小写敏感**——种子自己列了 `md5|MD5`、
// `(True|true|1)` 就是证据。若用 /i 编译，`hasVerify = false` 会命中
// `VERIFY...=false` 这条 fail-open 种子，误报量级上升一个数量级。所以保持敏感。
export function toJsRegExp(seed) {
  const pattern = translatePosix(seed);
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function readRuleFile(dir, name) {
  try {
    const parsed = JSON.parse(readFileSync(join(dir, name), 'utf-8'));
    const rules = (parsed.seeds || []).map((s) => toJsRegExp(s)).filter(Boolean);
    return { id: parsed.id || name.replace(/\.json$/, ''), title: parsed.title || '', rules };
  } catch {
    return null;
  }
}

/** 读 references/*.json，返回 [{id, title, rules:[RegExp]}]；缺失时返回 []。 */
export function loadCorpus(targetPath, skillDirOverride = null) {
  const skillDir = skillDirOverride || resolveSkillDir(SKILL_NAME, targetPath);
  if (!skillDir) return [];
  const refDir = join(skillDir, 'references');
  if (!existsSync(refDir)) return [];
  let files;
  try {
    files = readdirSync(refDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  return files.map((f) => readRuleFile(refDir, f)).filter((c) => c && c.rules.length > 0);
}

// ── 证伪层：可判定、可单测、写死理由，不做模糊判断 ──────────────────

const COMMENT_PREFIXES = ['//', '#', '*', '/*', '<!--', ';', '--', '%'];
const TEST_SEGMENTS = new Set(['test', 'tests', '__tests__', 'spec', 'specs', 'fixture', 'fixtures', 'mock', 'mocks', '__mocks__', 'e2e', 'testing', 'sample', 'samples', 'testdata']);
const DOC_SEGMENTS = new Set(['doc', 'docs', 'example', 'examples', 'sample', 'samples', 'vendor', 'third_party', 'node_modules', 'benchmark', 'benchmarks']);

// 客户端公开变量：前缀注定了值会进浏览器包，本来就不是秘密。
const PUBLIC_VAR = /(VITE_|REACT_APP_|NEXT_PUBLIC_|NUXT_PUBLIC_|PUBLIC_)/;
// 回落值不是秘密的形态
const NON_SECRET_VALUES = new Set(['true', 'false', 'none', 'null', 'undefined', 'nil', 'utf-8', 'utf8', 'json', 'text/plain', 'application/json', 'utc', 'gmt', 'production', 'development', 'staging', 'test', 'info', 'debug', 'warn', 'error', 'off', 'on', 'yes', 'no', 'localhost', '0.0.0.0']);
// 变量名后缀说明它不是秘密
const NON_SECRET_SUFFIX = new Set(['PORT', 'HOST', 'HOSTNAME', 'URL', 'URI', 'ENDPOINT', 'REGION', 'ZONE', 'TIMEOUT', 'LIMIT', 'LEVEL', 'PATH', 'DIR', 'FOLDER', 'NAME', 'LANG', 'LOCALE', 'MODE', 'ENV', 'TTL', 'SIZE', 'COUNT', 'INTERVAL', 'CHANNEL', 'TOPIC', 'BUCKET', 'PREFIX', 'SUFFIX', 'VERSION', 'WORKERS', 'RETRIES', 'TMPDIR', 'TMP', 'TEMP', 'HOME', 'SHELL', 'USER', 'PWD', 'CI', 'TZ']);
// 路径/URL 形态的回落值不是秘密
const PATH_LIKE = /^(\.{0,2}\/|~\/|\/|\.\\|[a-z]+:\/\/)/i;
// 占位符：写的是「你该填这里」，不是可用的默认凭据。
const PLACEHOLDER_PARTS = ['your-', 'your_', 'placeholder', 'dummy', 'fake_', '_fake', 'example.com', 'example.org', '${', 'xxxx', 'XXXX'];
// 「<YOUR_KEY>」形态的占位符；用 indexOf 扫描，避免正则回溯。
function hasAnglePlaceholder(line) {
  const open = line.indexOf('<');
  if (open === -1) return false;
  const close = line.indexOf('>', open);
  return close - open >= 3;
}
// 反过来：这些是**真**默认凭据，必须留下。
const REAL_DEFAULT_PARTS = ['changeme', 'change_me', 'admin123', 'password123', '123456', 'letmein', 'test123'];
const LOCAL_HOSTS = ['localhost', '127.0.0.1', 'host.docker.internal'];
const LOG_SINK = /(logger|logging|log\.|console\.|sentry|captureException|logrus|pino|winston)/i;
const CHECKSUM_PARTS = ['etag', 'checksum', 'md5sum', 'shasum', 'sha1sum', 'cache_key', 'cache-key', 'cachekey', 'contenthash', 'content_hash', 'fingerprint', 'gravatar', 'integrity', 'dedup', 'cachebuster', 'asset_key', 'asset-key', 'tmp', 'temp', 'bench', 'filename', 'slug'];

function hasAny(haystack, parts) {
  const lower = haystack.toLowerCase();
  return parts.some((p) => lower.includes(p.toLowerCase()));
}

// ── 全局证伪：与分类无关的形态识别 ──────────────────────────────

// `${VAR}` / `#{…}` / `{{…}}` / `%{…}` —— 模板插值，不是字面默认值。
const INTERPOLATION = ['${', '#{', '{{', '%{'];
// 箭头函数返回正则 / `.test(/…/)` —— 是检测器自己，不是被审配置。
const RULE_DEFINITION = /=>\s*\/|\.test\(.*\/[^/]*\//;
// 对象字段赋值（`obj.flag = true`）：不是配置项声明（`DEBUG = True` / `"debug": true`）。
// process.env / os.environ 例外，它们本身就是配置读口。
function isFieldAssign(line) {
  const at = line.search(/[:=]/);
  if (at === -1) return false;
  return line.slice(0, at).includes('.');
}
const ENV_ACCESS = /(process\.env|os\.environ|ENV\[)/;
// 转义序列/十六进制颜色：`'\u0000'`、`#0000EE`、`0x1f` 里的 `000` 不是文件权限。
const HEX_OR_ESCAPE = /(\\[ux][0-9a-fA-F]{2}|#[0-9A-Fa-f]{3,8}\b|0x[0-9A-Fa-f]+)/;
// 标准权限位不是发现（只在 777/776/766/707/666/000 这些才是）。
const DANGEROUS_MODES = new Set(['777', '776', '766', '707', '666', '000']);
const MODE_LITERAL = /\b(?:0o|0O|0)?([0-7]{3})\b/;
// 类型 schema：`token: { type: 'string' }` —— 描述字段，不是字面默认值。
// 只对「值型」分类生效：IaC 里的 `cidr_blocks = ["0.0.0.0/0"]` 是列表但确实是发现。
const SCHEMA_VALUE = /[:=]\s*\{\s*[\w'"]+\s*:/;
// 正则字面量定义（`const X = /pat/`）：是检测器自己，不是被审配置。
const REGEX_LITERAL_DEF = /^\s*(?:const|let|var)\s+\w+\s*=\s*\//;

function refuteGlobal(line) {
  if (isCommentLine(line)) return '注释行';
  if (INTERPOLATION.some((p) => line.includes(p))) return '模板插值占位，不是字面默认值';
  if (RULE_DEFINITION.test(line) || REGEX_LITERAL_DEF.test(line)) return '检测规则定义，不是被审配置';
  if (isFieldAssign(line) && !ENV_ACCESS.test(line)) return '对象字段赋值，不是配置项声明';
  if (HEX_OR_ESCAPE.test(line)) return '十六进制/转义序列，不是权限位或密钥';
  return null;
}

function refuteStandardMode(line) {
  const m = line.match(MODE_LITERAL);
  if (!m) return null;
  if (DANGEROUS_MODES.has(m[1])) return null;
  return `标准文件权限（${m[1]}），不是过度放行`;
}

function isCommentLine(line) {
  const trimmed = line.trimStart();
  return COMMENT_PREFIXES.some((p) => trimmed.startsWith(p));
}

function pathSegments(rel) {
  if (!rel) return [];
  return rel.toLowerCase().split('/');
}

function looksLikeTestFile(rel) {
  const name = rel.toLowerCase().split('/').pop() || '';
  return name.includes('.test.') || name.includes('.spec.') || name.includes('_test.');
}

function isRefutedByPath(rel, scope) {
  const segs = pathSegments(rel);
  if (segs.some((s) => DOC_SEGMENTS.has(s))) return '文档/示例/第三方目录';
  if (scope === 'tests') return null;
  if (segs.some((s) => TEST_SEGMENTS.has(s))) return '测试/夹具目录';
  if (looksLikeTestFile(rel)) return '测试文件';
  return null;
}

// 只认已知的「带默认值的读取」形态；用 indexOf 切片取值，避免回溯型正则。
// 注意：带 /i 旗标时 `[A-Za-z]` 会被判为重复字符类，所以用 \w。
const ACCESSOR_CALL = /(?:getenv|environ\.get|env\.get|env\.Get|os\.Getenv|GetString|LookupEnv|getOrDefault|get_env|config\.get)\(\s*['"](\w[\w.]*)['"]/i;

// `process.env.TMPDIR || '/tmp'` 这类形态左侧就是变量名，要拿来判变量名是否像秘密。
// 一行一个，别写成数组字面量单行：这行本身会命中 fallback-secrets 的种子（自命中）。
const ENV_LEFT_PREFIXES = [
  'process.env.',
  'os.environ.get(',
  'os.environ[',
  'environ.get(',
  'env.get(',
  'getenv(',
];

// 逐个前缀找，避免单个正则里的重叠分支引发回溯。
function envLeftName(line) {
  for (const prefix of ENV_LEFT_PREFIXES) {
    const at = line.indexOf(prefix);
    if (at === -1) continue;
    const rest = line.slice(at + prefix.length).replace(/^[\s'"]+/, '').replace(/^\[/, '');
    const m = rest.match(/^([A-Za-z_]\w*)/);
    if (m) return m[1];
  }
  return '';
}

function fallbackLiteral(line) {
  const call = line.match(ACCESSOR_CALL);
  if (call) {
    const rest = line.slice(call.index + call[0].length);
    const comma = rest.indexOf(',');
    if (comma === -1) return null;
    const tail = rest.slice(comma + 1);
    const end = tail.indexOf(')');
    const raw = (end === -1 ? tail : tail.slice(0, end)).trim();
    return { name: call[1], value: raw.replace(/^['"]|['"]$/g, '').trim() };
  }
  const orExpr = line.match(/\|\|\s*['"]([^'"]*)['"]/);
  if (orExpr) return { name: envLeftName(line), value: orExpr[1] };
  return null;
}

function isNonSecretValue(value) {
  const bare = value.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  if (bare === '') return true;
  if (/^\d+$/.test(bare)) return true;
  return NON_SECRET_VALUES.has(bare);
}

function refuteFallback(line) {
  if (SCHEMA_VALUE.test(line)) return '类型/结构描述，不是字面默认值';
  if (PUBLIC_VAR.test(line)) return '客户端公开变量，不进服务端密钥';
  const lit = fallbackLiteral(line);
  if (!lit) return null;
  if (lit.value.trim() === '') return '回落值为空，等于没配默认值';
  if (isNonSecretValue(lit.value)) return `回落值不是秘密形态（${lit.value}）`;
  if (PATH_LIKE.test(lit.value.trim())) return `回落值是路径/URL（${lit.value}）`;
  const lastToken = lit.name.split('_').pop().toUpperCase();
  if (lit.name && NON_SECRET_SUFFIX.has(lastToken)) return `变量名不像秘密（${lit.name}）`;
  return null;
}

// (admin|user|login…) 这类**角色/账号**种子：值必须正好是已知默认凭据或占位符，
// 否则 `test: 'testPassed'`、`feat: 'Features'` 都会被当成默认凭据。
const KNOWN_DEFAULT_VALUES = new Set(['admin', 'administrator', 'root', 'sa', 'guest', 'test', 'demo', 'password', 'changeme', '123', '1234', '123456', 'user']);
const ROLE_KEY = /(?:^|[^\w])(admin|root|guest|test|username|user|login|uid|account)\s*[:=]\s*['"]([^'"]+)['"]/;

function refuteCredentials(line) {
  if (SCHEMA_VALUE.test(line)) return '类型/结构描述，不是字面默认值';
  if (hasAny(line, PLACEHOLDER_PARTS) || hasAnglePlaceholder(line)) return '占位符形态（应填未填）';
  if (hasAny(line, LOCAL_HOSTS) && !hasAny(line, REAL_DEFAULT_PARTS)) return '本地开发地址';
  const role = line.match(ROLE_KEY);
  if (role && !KNOWN_DEFAULT_VALUES.has(role[2].toLowerCase())) {
    return `角色键的值不是已知默认凭据（${role[2]}）`;
  }
  return null;
}

function refuteFailOpen(line) {
  // DISABLE_AUTH=false / SKIP_CSRF=0 是安全极性，不是 fail-open。
  const m = line.match(/([A-Z_]{3,32})\s*[:=]\s*['"]?(false|0|no|off)(?![a-z0-9])/i);
  if (m && /(DISABLE|SKIP|NO)_/.test(m[1])) return '极性相反的开关（DISABLE_/SKIP_ 取 false 即安全）';
  return null;
}

function refuteWeakCrypto(line) {
  if (hasAny(line, CHECKSUM_PARTS)) return '校验和/缓存键/临时文件名用途，不是密码学保护';
  return null;
}

function refutePermissive(line, rel) {
  const mode = refuteStandardMode(line);
  if (mode) return mode;
  const isCidr = /(\/0\b|0\.0\.0\.0\/0|::\/0)/.test(line);
  if (isCidr) return null;
  if (!line.includes('0.0.0.0')) return null;
  const iacContext = /(cidr|security_group|source_ranges|ingress|firewall)/i.test(line);
  const isIac = /\.(tf|tfvars|ya?ml)$/.test(rel);
  return isIac && iacContext ? null : '监听地址 0.0.0.0，不是放行规则';
}

function refuteDebug(line) {
  if (LOG_SINK.test(line)) return '服务端日志落盘是正确做法，不是泄露';
  const debugSwitch = /(display_errors|show_exceptions|PROPAGATE_EXCEPTIONS)/.test(line);
  if (debugSwitch && /(false|'Off'|"Off")/i.test(line)) return '显式关闭调试输出';
  return null;
}

const REFUTERS = {
  'fallback-secrets': refuteFallback,
  'default-credentials': refuteCredentials,
  'fail-open-security': refuteFailOpen,
  'weak-crypto': refuteWeakCrypto,
  'permissive-access': refutePermissive,
  'debug-features': refuteDebug,
};

/** 返回证伪理由；不证伪返回 null。导出供单测。 */
export function refute(categoryId, line, rel = '', scope = 'code') {
  const global = refuteGlobal(line);
  if (global) return global;
  const byPath = isRefutedByPath(rel, scope);
  if (byPath) return byPath;
  const fn = REFUTERS[categoryId];
  if (!fn) return null;
  return fn(line, rel);
}

function matchingCategories(line, rel, corpus, scope) {
  const ids = [];
  for (const cat of corpus) {
    if (cat.rules.every((re) => !re.test(line))) continue;
    if (refute(cat.id, line, rel, scope)) continue;
    ids.push(cat.id);
  }
  return ids;
}

export function scanText(text, rel, corpus, scope = 'code') {
  const hits = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length > 500) continue;
    const categories = matchingCategories(line, rel, corpus, scope);
    if (categories.length > 0) {
      hits.push({ file: rel, line: i + 1, categories, snippet: line.trim().slice(0, 160) });
    }
  }
  return hits;
}

function relOf(targetPath, file) {
  return relative(targetPath, file).split(sep).join('/');
}

function filesForScope(targetPath, scope) {
  const exts = [...CODE_EXTS, ...CONFIG_EXTS];
  const files = listProjectFiles(targetPath, {
    exts,
    namePattern: EXTRA_FILES,
    includeDotFiles: scope === 'tests' || scope === 'all',
  });
  if (scope !== 'tests') return files;
  return files.filter((f) => {
    const rel = relOf(targetPath, f);
    return pathSegments(rel).some((s) => TEST_SEGMENTS.has(s)) || looksLikeTestFile(rel);
  });
}

function readTextSafely(file) {
  try {
    if (!existsSync(file)) return null;
    const buf = readFileSync(file);
    if (buf.length > MAX_FILE_BYTES) return null;
    const text = buf.toString('utf-8');
    return text.includes('\u0000') ? null : text;
  } catch {
    return null;
  }
}

function scanFiles(targetPath, files, corpus, scope) {
  const candidates = [];
  const perCategory = {};
  for (const file of files) {
    const text = readTextSafely(file);
    if (text === null) continue;
    for (const hit of scanText(text, relOf(targetPath, file), corpus, scope)) {
      for (const id of hit.categories) perCategory[id] = (perCategory[id] || 0) + 1;
      if (candidates.length < MAX_CANDIDATES) candidates.push(hit);
    }
  }
  return { candidates, perCategory };
}

export function handleInsecureDefaults(_action, params, targetPath, context) {
  const scope = params?.scope || 'code';
  const corpus = loadCorpus(targetPath, params?.rules_dir);
  if (corpus.length === 0) {
    return '未找到 insecure-defaults 规则集（references/*.json），跳过候选扫描';
  }

  const files = filesForScope(targetPath, scope);
  if (files.length === 0) {
    // 0 文件不是「没问题」，是「没扫」，必须按失败处理（与 semgrep 一致）。
    if (context) context.lastStepFailed = true;
    console.log('  ❌ insecure-defaults: 扫描范围为 0 个文件（结果不可信，按失败处理）');
    return '未找到可扫描的源文件（结果不可信）';
  }

  const { candidates, perCategory } = scanFiles(targetPath, files, corpus, scope);

  if (context) {
    context.insecureDefaultsCandidates = candidates;
    context.insecureDefaultsCounts = perCategory;
    context.insecureDefaultsScanned = files.length;
  }

  if (candidates.length === 0) {
    return `Insecure-defaults 候选扫描完成: 0 处候选（扫描 ${files.length} 个文件）`;
  }
  const kinds = Object.keys(perCategory).length;
  return `Insecure-defaults 候选扫描完成: ${candidates.length} 处候选（${kinds} 类，扫描 ${files.length} 个文件；种子命中不等于漏洞，需逐条证伪）`;
}

export function formatCandidates(candidates, max = 20) {
  if (candidates.length === 0) return ['  （无候选）'];
  const head = `  ${candidates.length} 处候选（种子命中不等于漏洞，需逐条证伪）：`;
  return [head, ...candidates.slice(0, max).map((c) => `  ${c.file}:${c.line} [${c.categories.join(',')}] ${c.snippet}`)];
}
