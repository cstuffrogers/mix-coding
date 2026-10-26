import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join, extname } from 'path';
import { randomBytes } from 'crypto';
import zlib from 'zlib';
import { claudeMemDir } from './claude-mem.js';
import { nexoDir } from './nexo.js';
import { agentmemoryDir } from './agentmemory.js';
import { normalizeProjectPath } from './project-scope.js';

// 保留策略一律「归档不删除」，于是 .archive 会无限长大：NEXO 30 天前的事件、
// agentmemory 超量行、项目记忆的重复件，全都搬进 archive/ 就地放着。
// 这里把它们压成 .gz —— **数据一条不丢**，但硬盘占用回到可控范围。
// 删除用户记忆是不可逆的，压缩是可逆的（gunzip 即可），所以这是唯一安全的收敛手段。

const COMPRESSIBLE = new Set(['.json', '.jsonl', '.md', '.log', '.txt']);

// gzipSync 是一次性读进内存的。归档里正常都是几 KB 的小文件，但一次误归档
// 进来个 500MB 的日志就会把内存打爆 —— 超大文件直接跳过，并在结果里报数。
const MAX_COMPRESS_BYTES = 64 * 1024 * 1024;

function writeBufferAtomic(file, buffer) {
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(4).toString('hex')}`;
  try {
    writeFileSync(tmp, buffer);
    renameSync(tmp, file);
  } catch {
    try { unlinkSync(tmp); } catch { /* 临时文件可能没建起来 */ }
    writeFileSync(file, buffer);
  }
}

/** 四个后端各自的归档根目录（不存在的直接跳过，不算错）。 */
export function archiveRoots(targetPath) {
  const project = normalizeProjectPath(targetPath);
  const roots = [
    join(claudeMemDir(), 'archive'),
    join(nexoDir(), 'archive'),
    join(agentmemoryDir(), 'archive'),
  ];
  if (project) roots.push(join(project, '.claude', 'memory', '.archive'));
  return roots.filter(dir => existsSync(dir));
}

function walkFiles(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) walkFiles(full, out);
    else out.push({ file: full, size: stat.size, mtime: stat.mtimeMs });
  }
  return out;
}

/**
 * 把 N 天以前的归档文件压成 .gz，压缩成功且非空才删原文件。
 * 返回 { compressed, skipped, noGain, failed, tooLarge, bytesBefore, bytesAfter }，
 * 失败数 > 0 时调用方必须打印出来 —— 静默失败的压缩等于「以为省了空间其实没省」。
 *
 * 单文件压缩。成功返回压缩后字节数，跳过/失败返回 null 并标原因 ——
 * 让调用方能把「失败」和「本来就不该压」分开统计。
 */
function compressOne(entry) {
  const { file, size } = entry;
  if (!COMPRESSIBLE.has(extname(file).toLowerCase())) return { state: 'ignore' };
  if (size > MAX_COMPRESS_BYTES) return { state: 'too-large' };
  if (existsSync(`${file}.gz`)) return { state: 'skipped' };
  try {
    const gz = zlib.gzipSync(readFileSync(file));
    if (!gz || gz.length === 0) return { state: 'failed' };
    // 小文件压完反而变大（gzip 头就要 18 字节）：那就留着原文 ——
    // 压缩是为了省空间，不是为了把可读文件变成更大且不可读。
    if (gz.length >= size) return { state: 'no-gain' };
    writeBufferAtomic(`${file}.gz`, gz);
    // 落盘后回读校验：压缩件必须非空，否则宁可留着原文件。
    if (statSync(`${file}.gz`).size === 0) return { state: 'failed' };
    unlinkSync(file);
    return { state: 'compressed', size: gz.length };
  } catch {
    return { state: 'failed' };
  }
}

/**
 * 把 N 天以前的归档文件压成 .gz，压缩成功且非空才删原文件。
 * 返回 { compressed, skipped, failed, bytesBefore, bytesAfter }，失败数 > 0 时
 * 调用方必须打印出来 —— 静默失败的压缩等于「以为省了空间其实没省」。
 */
export function compactArchives(targetPath, options = {}) {
  const olderThanDays = Number(options.olderThanDays ?? 30);
  const days = Number.isFinite(olderThanDays) && olderThanDays >= 0 ? olderThanDays : 30;
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  const result = { compressed: 0, skipped: 0, noGain: 0, failed: 0, tooLarge: 0, bytesBefore: 0, bytesAfter: 0, roots: 0 };
  const roots = archiveRoots(targetPath);
  result.roots = roots.length;

  for (const root of roots) {
    const files = walkFiles(root);
    result.bytesBefore += files.reduce((sum, f) => sum + f.size, 0);
    for (const entry of files) {
      if (entry.mtime > cutoff) continue;
      const outcome = compressOne(entry);
      switch (outcome.state) {
        case 'compressed':
          result.compressed++;
          result.bytesAfter += outcome.size;
          break;
        case 'skipped':
          result.skipped++;
          result.bytesAfter += entry.size;
          break;
        case 'no-gain':
          // 压了不变小：留下原文件（体积没变），不计入压缩数。
          result.noGain++;
          result.bytesAfter += entry.size;
          break;
        case 'too-large':
          result.tooLarge++;
          result.bytesAfter += entry.size;
          break;
        case 'failed':
          result.failed++;
          // 压缩失败的文件原样留着（空间没省），按原体积计入 after。
          result.bytesAfter += entry.size;
          break;
        default:
          // 'ignore'：不是可压缩的归档类型，原样留着，体积不变
          result.bytesAfter += entry.size;
          break;
      }
    }
  }
  return result;
}
