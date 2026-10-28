/**
 * PlanService handlers for planning-with-files integration
 * Manus-style persistent file-based planning with session recovery
 */

import { safeExecFile } from '../lib/safe-exec.js';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Run session-catchup.py to detect unsynced context from previous session
 * @param {object} params - { script: path to session-catchup.py }
 * @param {string} targetPath - Project directory
 * @returns {object} Catchup result
 */
export function handleSessionCatchup(action, params, targetPath) {
	const scriptPath = params?.script || '.claude/scripts/session-catchup.py';
	const fullPath = resolve(targetPath, scriptPath);

	if (!existsSync(fullPath)) {
		return { status: 'skipped', reason: 'session-catchup.py not found' };
	}

	try {
		// 参数数组直传，不拼 shell 字符串：targetPath 来自 --target，含 " 或 $() 时可注入
		const result = safeExecFile('python', [fullPath, targetPath], null, {
			encoding: 'utf-8',
			timeout: 30000,
			cwd: targetPath
		});

		return {
			status: 'success',
			output: result,
			hasUnsyncedContext: result.includes('unsynced') || result.includes('catchup')
		};
	} catch (error) {
		return {
			status: 'error',
			message: error.message,
			fallback: 'Manual git diff recommended'
		};
	}
}

/**
 * Initialize planning files from templates
 * @param {object} params - { files: ['plan.md', 'findings.md', 'progress.md'], templates_dir: path }
 * @param {string} targetPath - Project directory
 * @returns {object} Initialization result
 */
export function handleInitPlanningFiles(action, params, targetPath) {
	const files = params?.files || ['plan.md', 'findings.md', 'progress.md'];
	const templatesDir = params?.templates_dir || '.claude/templates';
	const results = [];

	for (const file of files) {
		const targetFile = resolve(targetPath, file);
		const templateFile = resolve(targetPath, templatesDir, file);

		if (existsSync(targetFile)) {
			results.push({ file, status: 'exists', message: `${file} already exists` });
			continue;
		}

		if (existsSync(templateFile)) {
			try {
				copyFileSync(templateFile, targetFile);
				results.push({ file, status: 'created', message: `${file} created from template` });
			} catch (error) {
				results.push({ file, status: 'error', message: error.message });
			}
		} else {
			// Create minimal file if template not found
			try {
				writeFileSync(targetFile, `# ${file.replace('.md', '')}\n\nInitialized by PlanService\n`);
				results.push({ file, status: 'created', message: `${file} created (minimal)` });
			} catch (error) {
				results.push({ file, status: 'error', message: error.message });
			}
		}
	}

	return {
		status: 'success',
		results,
		summary: `${results.filter(r => r.status === 'created').length} files created, ${results.filter(r => r.status === 'exists').length} already exist`
	};
}

/**
 * Read spec.md for project-level requirements
 * @param {object} params - { file: 'spec.md' }
 * @param {string} targetPath - Project directory
 * @returns {object} Spec content or not found
 */
export function handleReadSpec(action, params, targetPath) {
	const specFile = params?.file || 'spec.md';
	const fullPath = resolve(targetPath, specFile);

	if (!existsSync(fullPath)) {
		return { status: 'not_found', message: `${specFile} not found` };
	}

	try {
		const content = readFileSync(fullPath, 'utf-8');
		const goalMatch = /^## Goal[^\n]*\n([^\n]+)/im.exec(content);
		const titleMatch = /^# ([^\n]+)/m.exec(content);

		return {
			status: 'success',
			file: specFile,
			content: content.slice(0, 2000),
			goal: goalMatch ? goalMatch[1].trim() : null,
			title: titleMatch ? titleMatch[1].trim() : null,
			message: `已读取 ${specFile}（${content.length} 字符）`
		};
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Gather requirements interactively (placeholder for CLI mode)
 * @param {object} params - { prompt: question to ask }
 * @returns {object} Prompt for user input
 */
export function handleGatherRequirements(action, params, _targetPath, context) {
	// 用户在命令行已经用 -p/--prompt 把目标说了，就不是「没人回答」，
	// 之前一律返回 interactive → 汇总里记 skip，答过也像没答。
	const goal = context?.prompt;
	if (goal && String(goal).trim()) {
		return `需求已收到（-p/--prompt）：${String(goal).trim().slice(0, 80)}`;
	}
	return {
		status: 'interactive',
		prompt: params?.prompt || '请描述任务目标（一句话）和预期阶段（3-7个）：',
		instructions: 'In conversation mode, this will trigger a user prompt. In CLI mode, provide via --prompt flag.'
	};
}

/**
 * Create plan.md with structured content
 * @param {object} params - { template, sections }
 * @param {string} targetPath - Project directory
 * @returns {object} Creation result
 */
export function handleCreatePlan(action, params, targetPath) {
	const planFile = resolve(targetPath, 'plan.md');

	// If plan.md exists, read and update; otherwise create from template
	if (existsSync(planFile)) {
		return { status: 'exists', message: 'plan.md already exists. Use updatePlan to modify.' };
	}

	const templatePath = resolve(targetPath, params?.template || '.claude/templates/plan.md');
	const content = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : `# Plan: Task Plan

## Goal
[One sentence describing the end state]

## Current Phase
Phase 1

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand user intent
- [ ] Identify constraints
- **Status:** in_progress

### Phase 2: Planning
- [ ] Define approach
- **Status:** pending

### Phase 3: Implementation
- [ ] Execute plan
- **Status:** pending

### Phase 4: Testing
- [ ] Verify results
- **Status:** pending

### Phase 5: Delivery
- [ ] Complete handoff
- **Status:** pending

## Key Questions
1. [Question to answer]

## Decisions Made
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
`;

	try {
		writeFileSync(planFile, content);
		return { status: 'created', file: 'plan.md', message: 'plan.md created successfully' };
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Create findings.md
 * @param {object} params - { template }
 * @param {string} targetPath - Project directory
 */
export function handleCreateFindings(action, params, targetPath) {
	const findingsFile = resolve(targetPath, 'findings.md');

	if (existsSync(findingsFile)) {
		return { status: 'exists', message: 'findings.md already exists' };
	}

	const templatePath = resolve(targetPath, params?.template || '.claude/templates/findings.md');
	const content = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : `# Findings: [Task Name]

## Research Summary
[Summary of research findings]

## Key Discoveries

### Discovery 1
- **Found:**
- **Source:**
- **Relevance:**
- **Timestamp:**

## Technical Findings
| Item | Value | Source |
|------|-------|--------|
|      |       |        |

## Open Questions
1. [Question] — Status: unresolved
`;

	try {
		writeFileSync(findingsFile, content);
		return { status: 'created', file: 'findings.md' };
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Create progress.md
 * @param {object} params - { template }
 * @param {string} targetPath - Project directory
 */
export function handleCreateProgress(action, params, targetPath) {
	const progressFile = resolve(targetPath, 'progress.md');

	if (existsSync(progressFile)) {
		return { status: 'exists', message: 'progress.md already exists' };
	}

	const templatePath = resolve(targetPath, params?.template || '.claude/templates/progress.md');
	const timestamp = new Date().toISOString();
	const content = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : `# Progress: [Task Name]

## Session Info
- **Started:** ${timestamp}
- **Plan File:** plan.md

## Progress Log

### ${timestamp} — Session Start
- Initialized planning files
- Phase 1 status: in_progress

## Test Results
| Test | Status | Notes |
|------|--------|-------|
|      |        |       |

## Phase Completion Log
| Phase | Completed At | Key Deliverables |
|-------|--------------|------------------|
|       |              |                  |
`;

	try {
		writeFileSync(progressFile, content);
		return { status: 'created', file: 'progress.md' };
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Confirm attestation (interactive prompt)
 *
 * 以前这里永远返回 { status: 'interactive' }：不进 context、不设条件，
 * 于是 plan 8（attestPlan，condition: attestation_enabled）永远不跑，
 * 这个答案在代码库里零消费点 —— 问了等于没问。
 * 现在 --attest true|false 直接落到 context.attestation_enabled；
 * 没表态就把问题抛回去（runStep 见到 _awaitingAnswer 会 exit 2）。
 * @param {object} params - { prompt, default }
 * @param {string} _targetPath - Project directory
 * @param {object} context - Scene context
 */
export function handleConfirmAttestation(action, params, _targetPath, context) {
	const { enabled, how } = resolveAttestationDecision(params, context);
	if (enabled === undefined) {
		return {
			status: 'interactive',
			prompt: params?.prompt || '是否启用 SHA256 认证？（多 Agent 协作时推荐）',
			default: params?.default ?? false,
			instructions: 'In conversation mode, user will be prompted. In CLI, use --attest true|false.'
		};
	}
	if (context) context.attestation_enabled = enabled;
	// 显式布状态：消息里带「跳过」二字，靠正则猜会被当成 noop（走着 ora 的 ⚠ 通道），
	// 而这一步真的做了决定。
	return {
		status: 'pass',
		message: `SHA256 认证${enabled ? '已启用' : '不启用'}${how}：plan 8 ${enabled ? '将执行' : '将跳过'} attest-plan.sh`,
	};
}

/**
 * 谁决定要不要认证：
 *   1) --attest true|false（用户当场表态）
 *   2) 场景里写明的 default（声明过的默认值，可以自动用，但必须在输出里说清）
 *   3) 都没有 → undefined，不猜（调用方把问题抛给人）
 */
function resolveAttestationDecision(params, context) {
	const answered = context?.attestation_enabled;
	if (answered === true || answered === false) return { enabled: answered, how: '（--attest）' };
	const declared = params?.default;
	if (declared === true || declared === false) {
		return { enabled: declared, how: '（场景声明的默认值，--attest true 可开启）' };
	}
	return { enabled: undefined, how: '' };
}

/**
 * Run attest-plan.sh for SHA256 attestation
 * @param {object} params - { script: path to attest-plan.sh }
 * @param {string} targetPath - Project directory
 */
export function handleAttestPlan(action, params, targetPath, context) {
	const scriptPath = params?.script || '.claude/scripts/attest-plan.sh';
	const fullPath = resolve(targetPath, scriptPath);

	if (!existsSync(fullPath)) {
		// 'skipped' 不在 status 白名单里，以前会落到默认分支记 ✓ pass —— 脚本不存在也算认证完成。
		return { status: 'skip', message: `attest-plan.sh 不存在（${scriptPath}），本次未认证` };
	}

	try {
		const result = safeExecFile('bash', [fullPath], targetPath, {
			encoding: 'utf-8',
			timeout: 10000,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const output = String(result ?? '').trim();
		if (context) context.plan_attestation = output;
		return {
			status: 'pass',
			message: `plan 文件已打 SHA256 认证：${output || '(脚本无输出)'}`,
		};
	} catch (error) {
		// 没有 task_plan.md / .planning 时脚本会非零退出 —— 这是「没得认证」，不是通过。
		const detail = String(error.stderr || error.message || '').trim().split('\n').slice(-3).join(' ');
		return { status: 'warn', message: `SHA256 认证未完成：${detail || 'attest-plan.sh 执行失败'}` };
	}
}

/**
 * Display summary message
 * @param {object} params - { message }
 */
export function handleDisplaySummary(action, params, _targetPath) {
	const defaultMessage = `📋 规划文件已创建：
- plan.md (阶段规划)
- findings.md (研究发现)
- progress.md (会话日志)

📌 核心规则：
- 2-Action Rule: 每 2 次视图/搜索操作后保存发现
- 3-Strike Protocol: 失败 3 次后上报用户
- 决策前重读 plan.md 保持目标清晰`;

	return {
		status: 'success',
		message: params?.message || defaultMessage
	};
}

/**
 * Update plan.md phase status
 * @param {object} params - { phase: number, status: 'pending'|'in_progress'|'complete' }
 * @param {string} targetPath - Project directory
 */
// Walk plan.md lines, locate the target phase's **Status:** line, rewrite it in place.
// Returns the new lines array (null if the phase/status line was not found).
function rewritePhaseStatusLine(lines, phase, status) {
	let isInTargetPhase = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Entering the target phase header.
		if (line.match(new RegExp(`^### Phase ${phase}:`))) {
			isInTargetPhase = true;
			continue;
		}
		// Leaving the phase (a different phase header).
		if (isInTargetPhase && line.match(/^### Phase \d+:/)) {
			isInTargetPhase = false;
			continue;
		}
		// Rewrite the status line within the phase.
		if (isInTargetPhase && line.includes('**Status:**')) {
			const statusRegex = /\*\*Status:\*\*\s*(pending|in_progress|complete)/;
			const statusMatch = statusRegex.exec(line);
			if (statusMatch) {
				lines[i] = line.slice(0, statusMatch.index) + '**Status:** ' + String(status) + line.slice(statusMatch.index + statusMatch[0].length);
			}
			return lines;
		}
	}
	return null;
}

export function handleUpdatePhaseStatus(action, params, targetPath) {
	const planFile = resolve(targetPath, 'plan.md');

	if (!existsSync(planFile)) {
		return { status: 'error', message: 'plan.md not found' };
	}

	const { phase, status } = params;
	if (!phase || !status) {
		return { status: 'error', message: 'phase and status required' };
	}

	try {
		const lines = readFileSync(planFile, 'utf-8').split('\n');

		const updatedLines = rewritePhaseStatusLine(lines, phase, status);
		if (updatedLines) {
			writeFileSync(planFile, updatedLines.join('\n'));
			return { status: 'success', phase, newStatus: status };
		}

		return { status: 'error', message: `Phase ${phase} status line not found in plan.md` };
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Log error to plan.md
 * @param {object} params - { error: string, attempt: number, resolution: string }
 * @param {string} targetPath - Project directory
 */
export function handleLogError(action, params, targetPath) {
	const planFile = resolve(targetPath, 'plan.md');

	if (!existsSync(planFile)) {
		return { status: 'error', message: 'plan.md not found' };
	}

	const { error, attempt = 1, resolution = '' } = params;

	try {
		let content = readFileSync(planFile, 'utf-8');
		const errorEntry = `| ${error || 'Unknown error'} | ${attempt} | ${resolution || 'Pending'} |\n`;

		// Find Errors Encountered section and add entry
		const errorsRegex = /(## Errors Encountered\s*\n\|[^\n]+\|\n\|[^\n]+\|\n)/;

		if (errorsRegex.test(content)) {
			const match = errorsRegex.exec(content);
			if (match) {
				content = content.slice(0, match.index + match[0].length) + errorEntry + content.slice(match.index + match[0].length);
			}
		} else {
			// Add section if not exists
			content += `\n## Errors Encountered\n| Error | Attempt | Resolution |\n|-------|---------|------------|\n${errorEntry}`;
		}

		writeFileSync(planFile, content);
		return { status: 'success', message: 'Error logged to plan.md' };
	} catch (err) {
		return { status: 'error', message: err.message };
	}
}

/**
 * Append to progress.md
 * @param {object} params - { action: string, result: string, files?: string[] }
 * @param {string} targetPath - Project directory
 */
export function handleAppendProgress(action, params, targetPath) {
	const progressFile = resolve(targetPath, 'progress.md');

	if (!existsSync(progressFile)) {
		return { status: 'error', message: 'progress.md not found' };
	}

	const timestamp = new Date().toISOString();
	const { action: actionName, result, files } = params;

	const entry = `
### ${timestamp} — ${actionName || 'Action'}
- **Action:** ${actionName || 'Unknown'}
- **Result:** ${result || 'N/A'}
${files?.length ? `- **Files Changed:** ${files.join(', ')}` : ''}
- **Next:** Continue with plan
`;

	try {
		const content = readFileSync(progressFile, 'utf-8');
		// Append before Session End if exists, otherwise at end
		const sessionEndRegex = /## Session End/;
		const match = sessionEndRegex.exec(content);
		if (match) {
			const updated = content.slice(0, match.index) + entry + '\n## Session End' + content.slice(match.index + match[0].length);
			writeFileSync(progressFile, updated);
		} else {
			writeFileSync(progressFile, content + entry);
		}

		return { status: 'success', message: 'Progress updated' };
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}

/**
 * Run check-complete.sh to verify all phases complete
 * @param {object} params - { script: path }
 * @param {string} targetPath - Project directory
 */
export function handleCheckComplete(action, params, targetPath) {
	const scriptPath = params?.script || '.claude/scripts/check-complete.sh';
	const fullPath = resolve(targetPath, scriptPath);

	if (!existsSync(fullPath)) {
		return { status: 'skipped', reason: 'check-complete.sh not found' };
	}

	try {
		const result = safeExecFile('bash', [fullPath], targetPath, {
			encoding: 'utf-8',
			timeout: 10000
		});

		return {
			status: 'success',
			output: result,
			allComplete: !result.includes('in_progress') && !result.includes('pending')
		};
	} catch (error) {
		return { status: 'error', message: error.message };
	}
}
