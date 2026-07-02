/**
 * PlanService handlers for planning-with-files integration
 * Manus-style persistent file-based planning with session recovery
 */

import { execSync } from 'child_process';
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
		const result = execSync(`python "${fullPath}" "${targetPath}"`, {
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
			title: titleMatch ? titleMatch[1].trim() : null
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
export function handleGatherRequirements(action, params, _targetPath) {
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
 * @param {object} params - { prompt, default }
 */
export function handleConfirmAttestation(action, params, _targetPath) {
	return {
		status: 'interactive',
		prompt: params?.prompt || '是否启用 SHA256 认证？（多 Agent 协作时推荐）',
		default: params?.default ?? false,
		instructions: 'In conversation mode, user will be prompted. In CLI, use --attest flag.'
	};
}

/**
 * Run attest-plan.sh for SHA256 attestation
 * @param {object} params - { script: path to attest-plan.sh }
 * @param {string} targetPath - Project directory
 */
export function handleAttestPlan(action, params, targetPath) {
	const scriptPath = params?.script || '.claude/scripts/attest-plan.sh';
	const fullPath = resolve(targetPath, scriptPath);
	const planFile = resolve(targetPath, 'plan.md');

	if (!existsSync(planFile)) {
		return { status: 'error', message: 'plan.md not found' };
	}

	if (!existsSync(fullPath)) {
		return { status: 'skipped', reason: 'attest-plan.sh not found' };
	}

	try {
		const result = execSync(`bash "${fullPath}"`, {
			encoding: 'utf-8',
			timeout: 10000,
			cwd: targetPath
		});

		return {
			status: 'success',
			output: result,
			message: 'Plan attested with SHA256'
		};
	} catch (error) {
		return {
			status: 'error',
			message: error.message
		};
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
// eslint-disable-next-line sonarjs/cognitive-complexity
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
		let content = readFileSync(planFile, 'utf-8');
		const lines = content.split('\n');
		let isInTargetPhase = false;
		let isFound = false;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Check if entering the target phase
			if (line.match(new RegExp(`^### Phase ${phase}:`))) {
				isInTargetPhase = true;
				continue;
			}

			// Check if leaving phase (another phase)
			if (isInTargetPhase && line.match(/^### Phase \d+:/)) {
				isInTargetPhase = false;
				continue;
			}

			// Update status line within the phase
			if (isInTargetPhase && line.includes('**Status:**')) {
				const statusRegex = /\*\*Status:\*\*\s*(pending|in_progress|complete)/;
					const statusMatch = statusRegex.exec(line);
					if (statusMatch) {
						lines[i] = line.slice(0, statusMatch.index) + '**Status:** ' + String(status) + line.slice(statusMatch.index + statusMatch[0].length);
					}
				isFound = true;
				break;
			}
		}

		if (isFound) {
			writeFileSync(planFile, lines.join('\n'));
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
		if (sessionEndRegex.test(content)) {
		// eslint-disable-next-line unicorn/no-unsafe-string-replacement
				const updated = content.replace(sessionEndRegex, `${entry}\n## Session End`);
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
		const result = execSync(`bash "${fullPath}"`, {
			encoding: 'utf-8',
			timeout: 10000,
			cwd: targetPath
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
