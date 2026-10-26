import { existsSync, mkdirSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, statSync } from 'fs';
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

/** 同步 sleep。Atomics.wait 是唯一不引依赖、不烧 CPU 的同步等待。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * 跨进程互斥：openSync(path, 'wx') 是原子的「不存在才创建」。
 *
 * 记忆库的读-改-写（items.json 追加、项目记忆查重）在没有锁时，两个会话
 * 同时跑同一个项目会互相覆盖 —— 实测 4 进程 × 5 次只落下 23 条。
 * 拿不到锁时**不阻塞到底**：超时后裸跑。宁可丢一次更新（下次还能重新写），
 * 也不要把「记忆写不进去」变成永久状态。返回 fn 的返回值。
 */
export function withFileLock(lockPath, fn, { timeoutMs = 3000, staleMs = 30000, retryMs = 25 } = {}) {
  const fd = acquireLock(lockPath, { timeoutMs, staleMs, retryMs });
  try {
    return fn();
  } finally {
    // 只清理自己创建的锁：超时裸跑时删别人的锁 = 制造两个写者
    if (fd !== null) {
      try { closeSync(fd); } catch { /* 已关闭 */ }
      try { unlinkSync(lockPath); } catch { /* 已被 stale 逻辑清掉 */ }
    }
  }
}

function stealIfStale(lockPath, staleMs) {
  try {
    if (Date.now() - statSync(lockPath).mtimeMs <= staleMs) return;
    unlinkSync(lockPath); // 持锁进程崩了会留下永久锁，超过 staleMs 直接抢
  } catch { /* 锁刚被对方释放，重试即成功 */ }
}

/** 拿到锁返回 fd，拿不到（超时 / 路径不可写）返回 null。 */
function acquireLock(lockPath, { timeoutMs, staleMs, retryMs }) {
  const started = Date.now();
  for (;;) {
    try {
      return openSync(lockPath, 'wx');
    } catch (error) {
      // 锁不可创建（目录只读、路径是文件等）时直接裸跑，别把记忆写丢
      if (error.code !== 'EEXIST') return null;
      stealIfStale(lockPath, staleMs);
      if (Date.now() - started >= timeoutMs) return null;
      sleepSync(retryMs);
    }
  }
}
