import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * 原子写：先写同目录临时文件，再 rename 覆盖目标。
 *
 * 直接 writeFileSync 到目标文件时，进程在写到一半被杀/断电会留下半截 JSON。
 * 记忆库读回时 JSON.parse 抛错 → 上层 catch 返回 []（静默），下一次写入就把
 * 整类记忆覆盖成只有一条新的 —— 等于一次意外就把几百条记忆吃掉。
 * rename 在同目录内是原子的，读方只会看到旧版本或新版本。
 */
export function writeFileAtomic(file, content) {
  const rand = randomBytes(4).toString('hex');
  const tmp = `${file}.tmp-${process.pid}-${rand}`;
  try {
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, file);
  } catch {
    // 极端情况（杀毒软件锁文件、跨设备）退回直写：至少不留下 tmp 垃圾
    try { unlinkSync(tmp); } catch { /* 临时文件可能根本不存在 */ }
    writeFileSync(file, content, 'utf-8');
  }
}
