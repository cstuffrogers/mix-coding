import { join } from 'path';
import chalk from 'chalk';
import { safeExec } from '../lib/safe-exec.js';

export function handleStateAudit(_action, _params, targetPath, context) {
  console.log(chalk.blue('\n🏗️ 正在分析状态管理架构...'));

  try {
    const raw = safeExec(
      `npx clearible analyze ${join(targetPath, 'src')} --no-cache 2>&1 || true`,
      targetPath,
      { stdio: 'pipe', maxBuffer: 1024 * 1024 }
    ).toString();

    // Parse clearible output for key metrics
    const contextCount = (raw.match(/Context\.Provider|createContext|useContext/g) || []).length;
    const reduxCount = (raw.match(/createSlice|configureStore|useSelector|useDispatch/g) || []).length;
    const zustandCount = (raw.match(/zustand/g) || []).length;
    const couplingMatch = raw.match(/coupl(?:ing|ed)[:\s]*(\d+)/i);
    const circularMatch = raw.match(/circular[:\s]*(\d+)/i);

    const findings = [];
    if (contextCount > 5) findings.push(`Context API 使用: ${contextCount} 处（建议检查是否过度使用）`);
    if (contextCount <= 5) console.log(chalk.dim(`  Context API: ${contextCount} 处`));

    if (reduxCount > 0) console.log(chalk.dim(`  Redux: ${reduxCount} 处`));
    if (zustandCount > 0) console.log(chalk.dim(`  Zustand: ${zustandCount} 处`));

    if (couplingMatch && parseInt(couplingMatch[1]) > 5) {
      findings.push(`组件耦合度: ${couplingMatch[1]}（偏高）`);
      console.log(chalk.yellow(`  ⚠ 组件耦合度: ${couplingMatch[1]}`));
    }

    if (circularMatch && parseInt(circularMatch[1]) > 0) {
      findings.push(`循环依赖: ${circularMatch[1]} 处`);
      console.log(chalk.yellow(`  ⚠ 循环依赖: ${circularMatch[1]}`));
    } else {
      console.log(chalk.dim('  未检测到循环依赖'));
    }

    // State library diversity check — mixing multiple libs
    const libCount = [contextCount > 0, reduxCount > 0, zustandCount > 0].filter(Boolean).length;
    if (libCount > 2) {
      findings.push(`混合使用 ${libCount} 种状态管理方案`);
      console.log(chalk.yellow(`  ⚠ 混合使用 ${libCount} 种状态管理方案（建议统一）`));
    }

    if (!findings.length) {
      console.log(chalk.green('  ✅ 状态管理架构良好'));
    }

    if (context) {
      context.stateAuditPassed = findings.length === 0;
      context.stateAuditFindings = findings;
    }
    return `状态管理审计完成: ${findings.length ? findings.join('; ') : '无问题'}`;
  } catch {
    console.log(chalk.dim('  ℹ clearible 不可用，跳过状态管理审计'));
    if (context) context.stateAuditPassed = false;
    return '状态管理审计完成（clearible 不可用）';
  }
}
