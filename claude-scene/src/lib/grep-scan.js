import { safeExec } from './safe-exec.js';

/**
 * `grep -rn` 的三态结果。
 *
 * 病根：以前所有 grep 都写成 `... 2>&1 || true`，于是「没有匹配」和
 * 「grep 根本没跑起来」（Windows 没装 grep / 目录不存在 / 正则写错）在调用方看来
 * 完全一样 —— 都是空字符串。调用方随后写 `findings.length === 0` → `xxxPassed = true`，
 * 门禁就报「✓ 通过」。**工具没跑通 ≠ 项目没问题**。
 *
 * grep 的退出码本来就区分这两件事：0 = 有匹配，1 = 没有匹配（正常），≥2 = 出错。
 * 这里把 ≥2 单独暴露成 ok:false，让调用方有机会说「这一项没查」。
 *
 * @param {string} command grep 命令（不要自己加 `|| true`）
 * @param {string} cwd 工作目录
 * @returns {{ ok: boolean, raw: string, reason?: string }}
 */
export function grepScan(command, cwd) {
  try {
    const raw = safeExec(command, cwd, { stdio: 'pipe', timeout: 30000 }).toString();
    return { ok: true, raw }; // 退出码 0 = 有匹配
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : undefined;
    if (status === 1) {
      // grep 的「没有匹配」是正常结论，不是失败
      return { ok: true, raw: '' };
    }
    const stdout = error?.stdout ? error.stdout.toString() : '';
    const stderr = error?.stderr ? error.stderr.toString() : '';
    // 有些环境（含 Windows 的 cmd）用 127/9009 表示命令不存在，其余按错误处理
    const reason = (stderr || stdout || error?.message || '').trim().split('\n')[0]?.slice(0, 160) || 'grep 不可用';
    return { ok: false, raw: stdout, reason };
  }
}
