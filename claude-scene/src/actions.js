import { getActionMessage } from './data/action-messages.js';

/**
 * @typedef {object} WorkflowContext
 * @property {string} [_sceneId] - Current workflow scene ID
 * @property {string} [prompt] - User's original task description
 * @property {string[]} [completedSteps] - Steps that have finished
 * @property {string} [targetPath] - Target project path
 * @property {string} [selectedTheme] - UI theme selection
 * @property {string} [selectedOption] - User's chosen option
 * @property {string} [design_selected] - Selected design variant
 * @property {boolean} [user_confirmed_open_design] - Open Design consent
 * @property {boolean} [user_confirmed_refactor] - Refactor consent
 * @property {boolean} [user_confirmed] - General user consent
 * @property {boolean} [open_design_executed] - Open Design ran
 * @property {boolean} [lowFi_generated] - Low-fi designs generated
 * @property {boolean} [testPassed] - Verification result
 * @property {boolean} [lastStepFailed] - Previous step failed
 * @property {boolean} [gateBlocked] - Quality gate blocked
 * @property {boolean} [lintPassed] - ESLint check passed
 * @property {boolean} [typecheckPassed] - TypeScript check passed
 * @property {boolean} [analyzeCompleted] - Competitive analysis completed
 * @property {boolean} [fixApplied] - Auto-fix was applied
 * @property {object} [securityScanResult] - Security scan outcome
 * @property {boolean} [securityScanResult.highSeverityFound]
 * @property {boolean} [securityScanResult.fixesApplied]
 * @property {number} [fixFailedCount] - Count of failed auto-fix attempts
 * @property {number} [codeMetricsFindings] - Complexity violations found
 * @property {number} [antiPatternFindings] - Anti-patterns found
 * @property {string[]} [refactor_points] - Identified refactor targets
 * @property {boolean} [database_required] - Feature needs database
 * @property {boolean} [payment_required] - Feature needs payments
 * @property {boolean} [email_required] - Feature needs email
 */

// Handler imports (also re-exported for ui-polish.js and other consumers)
import { handleMemoryRecall, handleMemoryRemember, handleConsolidate, handleListMemories, handleAutoRemember } from './handlers/memory.js';
import { handleCodeScan, handlePerformanceProfile, handleCodeMetrics, handleDetectAntiPatterns, handleGenerateReport } from './handlers/code-metrics.js';
import { handleSecurityScan, handleGitLeaks, handleSecBugHunt, handleAnalyzeSecurityVulnerabilities, handleLogSanitization, handleCorsCheck, handleEnvVarLeak, handleSensitiveFileCheck, handleDeprecatedDeps } from './handlers/security-scanning.js';
import { handleKnipCheck, handleBuildLeakCheck, handleDeadLinkCheck, handleSecurityHeaders, handleRecheckCli, handleSkillspectorScan, handleActionlint, handleZizmor, handleJscpd, handleSizeLimit, handleStryker, handleSpectral, handleMarkdownlint } from './handlers/external-tool-checks.js';
import { handleLighthouseGate } from './handlers/lighthouse.js';
import { handleOpenRedirectScan } from './handlers/open-redirect.js';
import { handleI18nAudit } from './handlers/i18n.js';
import { handleTestCoverage, handleTestUnit, handleRunSuite, handleRunAffected, handleRunCI, handleGenerateTest, handleLoadTest } from './handlers/testing.js';
import { handleCreateBranch, handleCommitPush, handleCreatePR, handleAutoUpdate, handleBumpVersion, handleCreateTag, handleDeploy, handleCreateRelease, handleListReleases, handleRollback, handleCreateIssue } from './handlers/git.js';
import { handleGenerateDesign, handleAnalyzeConsistency, handleExportAssets, handlePersist, handleDesignInput, handleHuashuBrandProtocol, handleHuashuExpertReview, handleHuashuPrototype, handleHuashuReleaseAnimation, handleHuashuReleaseDeck, handleHuashuInfographic, handleAwmBrandList, handleAwmBrandImport, handleOdBrandList, handleOdBrandPick, handleOdBrandImport, handleOdTemplateList, handleOdTemplatePreview, handleOdSkillLoad, handleOdFrameList, handleOdFrameApply, handleOdPromptTemplateList, handleOdPromptTemplateLoad, handleOdDeckList, handleOdDeckLoad } from './handlers/design.js';
import { handleIssueQuery, handleLocate, handleAnalyzeDependencies, handleFix, handleVerifyFix, handleRegression, handleCloseTicket } from './handlers/issues.js';
import { handleBuild, handleApplyTemplate, handleImplementLogic, handleCleanup, handleAutoFix, handleGenerateRefactorPlan, handleApplyTransformations, handleAnalyzeInterface, handleDetectLanguage, handleLanguageBuild, handleLanguageTest } from './handlers/quality.js';
import { handleCheckOutdated, handleUpdateDeps, handleCheckBreakingChanges } from './handlers/deps.js';
import { handleRunReview, handleReviewFull, handleVerifyVisual, handleAiFriendlyReview, handleGenerateReviewReport } from './handlers/review.js';
import { handleApiDocs, handleChangelog, handleDevDocs } from './handlers/docs.js';
import { handleMigrationReview } from './handlers/migration.js';
import { handleSetupMonitor } from './handlers/monitor.js';
import { handleSetupCI } from './handlers/cicd.js';
import { handleSetupBackup } from './handlers/backup.js';
import { handleIncidentRunbook } from './handlers/incident.js';
import { handleSetupE2E } from './handlers/e2e.js';
import { handleSetupDocker } from './handlers/docker.js';
import { handleGenerateChangeLog } from './handlers/changelog.js';
import { handleSetupSBOM } from './handlers/sbom.js';
import { handleSetupLogging } from './handlers/logging.js';
import { handleAnalyzeUI, handleCheckConsistency, handleAddAnimations, handleVisualRegression, handleCheckAPIConsistency, handleApplyDaisyUI, handleApplyComponents, handleWebDesignVerify, handleApplyHuashuStyle, handleReconcileDesignTokens, handleImpeccableCritique, handleIconUpgrade, handleMicroInteractions } from './handlers/ui-tools.js';
import {
  handleSelect, handleConfirm, handleChoose, handleReport, handleAskUser, handleCheckGate,
  handleInstallDeps, handleDocsUpdate, handleCheckEnvFile,
  handleGenerateEnv, handleStartDevServer, handleVerify,
  handleSend, handleNotify, handleCeAction, handleAnalyze,
} from './handlers/flow-control.js';
import { handleCheckPrerequisites } from './handlers/prerequisites.js';
import { handleVerifyHandlers } from './handlers/handler-verify.js';

// Mobile handlers
import {
  handleDetectProject, handleCheckTools, handleMobileAutoInstall, handleBuildApp,
  handleScanSource, handleScanDependencies, handleMasvsCheck, handlePerfBaseline,
  handleStoreCompliance, handleMobileGenerateReport, handleMobileAutoFix,
  handleMeasureBaseline, handleAnalyzeBundle, handleAnalyzeAssets, handleAnalyzeNetwork,
  handleDetectMobileAntipatterns, handleGenerateOptimizePlan, handleExecuteOptimize,
  handleRemeasure, handleRunUITest, handleRunAgent, handleAggregateReport,
  handleMobsfUpload, handleMobsfScan, handleBearerScan,
} from './handlers/mobile.js';
import {
  handleReleaseChecks, handleMobileBumpVersion, handleMobileGenerateChangelog,
  handleGrayReleaseConfig, handleIosRelease, handleAndroidRelease,
} from './handlers/mobile-release.js';
import { handleSetupE2EConfig, handleVerifySetup, handleGenerateCIConfig } from './handlers/mobile-testing.js';
import {
  handleCheckRnDoctor, handleCheckAndroidSDK,
  handleSetupEnv, handleSetupEmulator, handleVerifyBuild,
} from './handlers/mobile-onboard.js';
import { handleAislopScan } from './handlers/aislop.js';
import { handleDepcruiseArchitecture } from './handlers/dependency-cruiser.js';
import { handleInvokeSkill } from './handlers/skill-runner.js';
import {
  handleLobsterTrapInstall, handleLobsterTrapConfig, handleHoneytoolSetup,
  handleDiffTest, handleWhitelistValidate, handleEgressBenchmark, handleLlmProxyReport,
} from './handlers/llm-proxy-audit.js';

// Re-export for direct consumers (ui-polish.js)
export { handleCheckConsistency, handleVisualRegression, handleCheckAPIConsistency, handleAddAnimations, handleAnalyzeUI, handleIconUpgrade, handleMicroInteractions };

// ── Action registry ──

export const ACTION_REGISTRY = {
  select: handleSelect,
  confirm: handleConfirm,
  choose: handleChoose,
  report: handleReport,
  askUser: handleAskUser,
  checkGate: handleCheckGate,
  testCoverage: handleTestCoverage,
  'test-coverage': handleTestCoverage,
  checkCoverage: handleTestCoverage,
  verify: handleVerify,
  testUnit: handleTestUnit,
  'test-unit': handleTestUnit,
  installDeps: handleInstallDeps,
  docsUpdate: handleDocsUpdate,
  'docs-update': handleDocsUpdate,
  apiDocs: handleApiDocs,
  'api-docs': handleApiDocs,
  changelog: handleChangelog,
  devDocs: handleDevDocs,
  'dev-docs': handleDevDocs,
  checkPrerequisites: handleCheckPrerequisites,
  checkEnvFile: handleCheckEnvFile,
  generateEnv: handleGenerateEnv,
  startDevServer: handleStartDevServer,
  reviewFull: handleReviewFull,
  'review-full': handleReviewFull,
  send: handleSend,
  notify: handleNotify,
  notifyComplete: handleNotify,
  'notify-complete': handleNotify,
  memoryRecall: handleMemoryRecall,
  'memory-recall': handleMemoryRecall,
  recall: handleMemoryRecall,
  memoryRemember: handleMemoryRemember,
  'memory-remember': handleMemoryRemember,
  remember: handleMemoryRemember,
  runReview: handleRunReview,
  runSuite: handleRunSuite,
  run_suite: handleRunSuite,
  runAffected: handleRunAffected,
  run_affected: handleRunAffected,
  generateDesign: handleGenerateDesign,
  analyzeConsistency: handleAnalyzeConsistency,
  persist: handlePersist,
  input: handleDesignInput,
  exportAssets: handleExportAssets,
  verifyVisual: handleVerifyVisual,
  analyze: handleAnalyze,
  consolidate: handleConsolidate,
  listMemories: handleListMemories,
  autoRemember: handleAutoRemember,
  analyzeUI: handleAnalyzeUI,
  checkConsistency: handleCheckConsistency,
  addAnimations: handleAddAnimations,
  iconUpgrade: handleIconUpgrade,
  microInteractions: handleMicroInteractions,
  visualRegression: handleVisualRegression,
  build: handleBuild,
  productionBuild: handleBuild,
  checkAPIConsistency: handleCheckAPIConsistency,
  'check-api-consistency': handleCheckAPIConsistency,
  createBranch: handleCreateBranch,
  autoUpdate: handleAutoUpdate,
  commitPush: handleCommitPush,
  bumpVersion: handleBumpVersion,
  createTag: handleCreateTag,
  applyTemplate: handleApplyTemplate,
  implementLogic: handleImplementLogic,
  autoFix: handleAutoFix,
  checkOutdated: handleCheckOutdated,
  updateDeps: handleUpdateDeps,
  checkBreakingChanges: handleCheckBreakingChanges,
  runCI: handleRunCI,
  codeScan: handleCodeScan,
  securityScan: handleSecurityScan,
  performanceProfile: handlePerformanceProfile,
  codeMetrics: handleCodeMetrics,
  detectAntiPatterns: handleDetectAntiPatterns,
  generateReport: handleGenerateReport,
  knipCheck: handleKnipCheck,
  'knip-check': handleKnipCheck,
  skillspectorScan: handleSkillspectorScan,
  'skillspector-scan': handleSkillspectorScan,
  aislopScan: handleAislopScan,
  'aislop-scan': handleAislopScan,
  aislopFix: handleAislopScan,
  'aislop-fix': handleAislopScan,
  depcruiseArchitecture: handleDepcruiseArchitecture,
  'depcruise-architecture': handleDepcruiseArchitecture,
  gitLeaks: handleGitLeaks,
  generateChangelog: handleChangelog,
  generateTest: handleGenerateTest,
  generateRefactorPlan: handleGenerateRefactorPlan,
  analyzeInterface: handleAnalyzeInterface,
  issueQuery: handleIssueQuery,
  locate: handleLocate,
  analyzeDependencies: handleAnalyzeDependencies,
  fix: handleFix,
  verifyFix: handleVerifyFix,
  regression: handleRegression,
  closeTicket: handleCloseTicket,
  createPR: handleCreatePR,
  applyTransformations: handleApplyTransformations,
  cleanup: handleCleanup,

  loadTest: handleLoadTest,
  'load-test': handleLoadTest,
  loadtest: handleLoadTest,

  // Migration review
  migrationReview: handleMigrationReview,
  'migration-review': handleMigrationReview,
  migrate: handleMigrationReview,

  // Monitoring (Upptime)
  setupMonitor: handleSetupMonitor,
  'setup-monitor': handleSetupMonitor,
  monitoring: handleSetupMonitor,
  monitorSetup: handleSetupMonitor,

  // CI/CD (Act + Task)
  setupCI: handleSetupCI,
  'setup-ci': handleSetupCI,
  cicd: handleSetupCI,

  // Backup (Restic)
  setupBackup: handleSetupBackup,
  'setup-backup': handleSetupBackup,
  backup: handleSetupBackup,

  // Incident (Runme)
  incidentRunbook: handleIncidentRunbook,
  'incident-runbook': handleIncidentRunbook,
  incident: handleIncidentRunbook,

  // E2E (MSW + Supertest + Schemathesis)
  setupE2E: handleSetupE2E,
  'setup-e2e': handleSetupE2E,
  e2e: handleSetupE2E,

  // Docker
  setupDocker: handleSetupDocker,
  'setup-docker': handleSetupDocker,
  docker: handleSetupDocker,

  // Changelog
  genChangelog: handleGenerateChangeLog,
  'gen-changelog': handleGenerateChangeLog,
  'generate-changelog': handleGenerateChangeLog,
  'change-log': handleGenerateChangeLog,

  // SBOM
  sbom: handleSetupSBOM,
  'generate-sbom': handleSetupSBOM,
  'license-check': handleSetupSBOM,

  // Logging
  setupLogging: handleSetupLogging,
  'setup-logging': handleSetupLogging,
  log: handleSetupLogging,
  logging: handleSetupLogging,

  // Release / Rollback / Deploy
  deploy: handleDeploy,
  createRelease: handleCreateRelease,
  listReleases: handleListReleases,
  rollback: handleRollback,
  createIssue: handleCreateIssue,

  // Language detection / build / test
  detectLanguage: handleDetectLanguage,
  languageBuild: handleLanguageBuild,
  languageTest: handleLanguageTest,

  // Security deep scan
  secBugHunt: handleSecBugHunt,
  'sec-bug-hunt': handleSecBugHunt,
  analyzeSecurityVulnerabilities: handleAnalyzeSecurityVulnerabilities,
  buildLeakCheck: handleBuildLeakCheck,
  'build-leak-check': handleBuildLeakCheck,
  deadLinkCheck: handleDeadLinkCheck,
  'dead-link-check': handleDeadLinkCheck,
  lighthouseGate: handleLighthouseGate,
  'lighthouse-gate': handleLighthouseGate,
  openRedirectScan: handleOpenRedirectScan,
  'open-redirect-scan': handleOpenRedirectScan,
  i18nAudit: handleI18nAudit,
  'i18n-audit': handleI18nAudit,
  securityHeaders: handleSecurityHeaders,
  'security-headers': handleSecurityHeaders,
  recheckCli: handleRecheckCli,
  'recheck-cli': handleRecheckCli,
  logSanitization: handleLogSanitization,
  'log-sanitization': handleLogSanitization,
  corsCheck: handleCorsCheck,
  'cors-check': handleCorsCheck,
  envVarLeak: handleEnvVarLeak,
  'env-var-leak': handleEnvVarLeak,
  sensitiveFileCheck: handleSensitiveFileCheck,
  'sensitive-file-check': handleSensitiveFileCheck,
  deprecatedDeps: handleDeprecatedDeps,
  'deprecated-deps': handleDeprecatedDeps,

  // Meta verification
  verifyHandlers: handleVerifyHandlers,
  'verify-handlers': handleVerifyHandlers,

	// GitHub Actions lint & security (actionlint + zizmor)
	actionlint: handleActionlint,
	'actionlint-check': handleActionlint,
	zizmor: handleZizmor,
	'zizmor-audit': handleZizmor,
	// Code duplication + bundle size
	jscpd: handleJscpd,
	'jscpd-check': handleJscpd,
	size_limit: handleSizeLimit,
	'size-limit-check': handleSizeLimit,
	// Mutation testing + API lint + Markdown lint
	stryker: handleStryker,
	'stryker-check': handleStryker,
	spectral: handleSpectral,
	'spectral-lint': handleSpectral,
	markdownlint: handleMarkdownlint,
	'markdownlint-check': handleMarkdownlint,

  aiFriendlyReview: handleAiFriendlyReview,
  'ai-friendly-review': handleAiFriendlyReview,
  generateReviewReport: handleGenerateReviewReport,
  'generate-review-report': handleGenerateReviewReport,
  applyDaisyUI: handleApplyDaisyUI,
  applyComponents: handleApplyComponents,
  webDesignVerify: handleWebDesignVerify,
  reconcileDesignTokens: handleReconcileDesignTokens,
  'impeccable-critique': handleImpeccableCritique,
  // Huashu integrations
  huashuBrandProtocol: handleHuashuBrandProtocol,
  'huashu-brand-protocol': handleHuashuBrandProtocol,
  huashuExpertReview: handleHuashuExpertReview,
  'huashu-expert-review': handleHuashuExpertReview,
  applyHuashuStyle: handleApplyHuashuStyle,
  'apply-huashu-style': handleApplyHuashuStyle,
  huashuPrototype: handleHuashuPrototype,
  'huashu-prototype': handleHuashuPrototype,
  huashuReleaseAnimation: handleHuashuReleaseAnimation,
  'huashu-release-animation': handleHuashuReleaseAnimation,
  huashuReleaseDeck: handleHuashuReleaseDeck,
  'huashu-release-deck': handleHuashuReleaseDeck,
  huashuInfographic: handleHuashuInfographic,
  'huashu-infographic': handleHuashuInfographic,
  'web-design-verify': handleWebDesignVerify,

  // Awesome Design MD
  awmBrandList: handleAwmBrandList,
  'awm-brand-list': handleAwmBrandList,
  awmBrandImport: handleAwmBrandImport,
  'awm-brand-import': handleAwmBrandImport,

  // Open Design brand
  odBrandList: handleOdBrandList,
  'od-brand-list': handleOdBrandList,
  odBrandPick: handleOdBrandPick,
  'od-brand-pick': handleOdBrandPick,
  odBrandImport: handleOdBrandImport,
  'od-brand-import': handleOdBrandImport,

  // Open Design templates
  odTemplateList: handleOdTemplateList,
  'od-template-list': handleOdTemplateList,
  odTemplatePreview: handleOdTemplatePreview,
  'od-template-preview': handleOdTemplatePreview,

  // Open Design skill loader
  odSkillLoad: handleOdSkillLoad,
  'od-skill-load': handleOdSkillLoad,

  // Open Design device frames
  odFrameList: handleOdFrameList,
  'od-frame-list': handleOdFrameList,
  odFrameApply: handleOdFrameApply,
  'od-frame-apply': handleOdFrameApply,

  // Open Design prompt templates
  odPromptTemplateList: handleOdPromptTemplateList,
  'od-prompt-list': handleOdPromptTemplateList,
  odPromptTemplateLoad: handleOdPromptTemplateLoad,
  'od-prompt-load': handleOdPromptTemplateLoad,

  // Open Design deck templates
  odDeckList: handleOdDeckList,
  'od-deck-list': handleOdDeckList,
  odDeckLoad: handleOdDeckLoad,
  'od-deck-load': handleOdDeckLoad,

  // MCP actions — available in conversation mode (CLAUDECODE=1), skipped in CLI mode
  listIssues: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'GitHub MCP: Issues 查询就绪（对话模式 MCP 工具执行）'
    : 'GitHub MCP: Issues 查询已跳过（需对话模式 + GitHub MCP）',
  listPullRequests: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'GitHub MCP: Pull Requests 查询就绪（对话模式 MCP 工具执行）'
    : 'GitHub MCP: Pull Requests 查询已跳过（需对话模式 + GitHub MCP）',
  search: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'Tavily MCP: 在线搜索就绪（对话模式 MCP 工具执行）'
    : 'Tavily MCP: 在线搜索已跳过（需对话模式 + Tavily MCP）',
  getDocumentation: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'Context7 MCP: 文档获取就绪（对话模式 MCP 工具执行）'
    : 'Context7 MCP: 文档获取已跳过（需对话模式 + Context7 MCP）',
  getSchema: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'Supabase MCP: Schema 获取就绪（对话模式 MCP 工具执行）'
    : 'Supabase MCP: Schema 获取已跳过（需对话模式 + Supabase MCP）',
  getPaymentFlow: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'Stripe MCP: 支付流程获取就绪（对话模式 MCP 工具执行）'
    : 'Stripe MCP: 支付流程获取已跳过（需对话模式 + Stripe MCP）',
  getEmailTemplate: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'Resend MCP: 邮件模板获取就绪（对话模式 MCP 工具执行）'
    : 'Resend MCP: 邮件模板获取已跳过（需对话模式 + Resend MCP）',
  searchRepositories: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'GitHub MCP: 仓库搜索就绪（对话模式 MCP 工具执行）'
    : 'GitHub MCP: 仓库搜索已跳过（需对话模式 + GitHub MCP）',

  // Matt Pocock skills — available in conversation mode (CLAUDECODE=1), skipped in CLI mode
  mpTriage: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-triage: TypeScript 问题分诊就绪（对话模式 Skill 调用）'
    : 'mp-triage: TypeScript 问题分诊已跳过（需对话模式 + Matt Pocock skill）',
  'mp-triage': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-triage: TypeScript 问题分诊就绪（对话模式 Skill 调用）'
    : 'mp-triage: TypeScript 问题分诊已跳过（需对话模式 + Matt Pocock skill）',
  mpDiagnose: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-diagnose: TypeScript 诊断就绪（对话模式 Skill 调用）'
    : 'mp-diagnose: TypeScript 诊断已跳过（需对话模式 + Matt Pocock skill）',
  'mp-diagnose': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-diagnose: TypeScript 诊断就绪（对话模式 Skill 调用）'
    : 'mp-diagnose: TypeScript 诊断已跳过（需对话模式 + Matt Pocock skill）',
  mpGrillMe: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-grill-me: 代码审查就绪（对话模式 Skill 调用）'
    : 'mp-grill-me: 代码审查已跳过（需对话模式 + Matt Pocock skill）',
  'mp-grill-me': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-grill-me: 代码审查就绪（对话模式 Skill 调用）'
    : 'mp-grill-me: 代码审查已跳过（需对话模式 + Matt Pocock skill）',
  mpTdd: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-tdd: TDD 工作流就绪（对话模式 Skill 调用）'
    : 'mp-tdd: TDD 工作流已跳过（需对话模式 + Matt Pocock skill）',
  'mp-tdd': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-tdd: TDD 工作流就绪（对话模式 Skill 调用）'
    : 'mp-tdd: TDD 工作流已跳过（需对话模式 + Matt Pocock skill）',
  mpHandoff: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-handoff: 交接就绪（对话模式 Skill 调用）'
    : 'mp-handoff: 交接已跳过（需对话模式 + Matt Pocock skill）',
  'mp-handoff': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-handoff: 交接就绪（对话模式 Skill 调用）'
    : 'mp-handoff: 交接已跳过（需对话模式 + Matt Pocock skill）',
  mpToPrd: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-to-prd: PRD 生成就绪（对话模式 Skill 调用）'
    : 'mp-to-prd: PRD 生成已跳过（需对话模式 + Matt Pocock skill）',
  'mp-to-prd': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-to-prd: PRD 生成就绪（对话模式 Skill 调用）'
    : 'mp-to-prd: PRD 生成已跳过（需对话模式 + Matt Pocock skill）',
  mpToIssues: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-to-issues: Issues 生成就绪（对话模式 Skill 调用）'
    : 'mp-to-issues: Issues 生成已跳过（需对话模式 + Matt Pocock skill）',
  'mp-to-issues': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-to-issues: Issues 生成就绪（对话模式 Skill 调用）'
    : 'mp-to-issues: Issues 生成已跳过（需对话模式 + Matt Pocock skill）',
  mpGitGuardrails: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-git-guardrails: Git 规范检查就绪（对话模式 Skill 调用）'
    : 'mp-git-guardrails: Git 规范检查已跳过（需对话模式 + Matt Pocock skill）',
  'mp-git-guardrails': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-git-guardrails: Git 规范检查就绪（对话模式 Skill 调用）'
    : 'mp-git-guardrails: Git 规范检查已跳过（需对话模式 + Matt Pocock skill）',
  mpPrototype: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-prototype: 原型生成就绪（对话模式 Skill 调用）'
    : 'mp-prototype: 原型生成已跳过（需对话模式 + Matt Pocock skill）',
  'mp-prototype': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-prototype: 原型生成就绪（对话模式 Skill 调用）'
    : 'mp-prototype: 原型生成已跳过（需对话模式 + Matt Pocock skill）',
  mpImproveCodebaseArchitecture: (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-improve-codebase-architecture: 架构改进就绪（对话模式 Skill 调用）'
    : 'mp-improve-codebase-architecture: 架构改进已跳过（需对话模式 + Matt Pocock skill）',
  'mp-improve-codebase-architecture': (_a, _p) => process.env.CLAUDECODE === '1'
    ? 'mp-improve-codebase-architecture: 架构改进就绪（对话模式 Skill 调用）'
    : 'mp-improve-codebase-architecture: 架构改进已跳过（需对话模式 + Matt Pocock skill）',

  // ── Mobile: Core (MobileService) ──
  detectProject: handleDetectProject,
  checkTools: handleCheckTools,
  autoInstall: handleMobileAutoInstall,
  buildApp: handleBuildApp,
  scanSource: handleScanSource,
  scanDependencies: handleScanDependencies,
  masvsCheck: handleMasvsCheck,
  perfBaseline: handlePerfBaseline,
  storeCompliance: handleStoreCompliance,
  mobileGenerateReport: handleMobileGenerateReport,
  mobileAutoFix: handleMobileAutoFix,
  measureBaseline: handleMeasureBaseline,
  analyzeBundle: handleAnalyzeBundle,
  analyzeAssets: handleAnalyzeAssets,
  analyzeNetwork: handleAnalyzeNetwork,
  detectMobileAntipatterns: handleDetectMobileAntipatterns,
  generateOptimizePlan: handleGenerateOptimizePlan,
  executeOptimize: handleExecuteOptimize,
  remeasure: handleRemeasure,
  runUITest: handleRunUITest,
  aggregateReport: handleAggregateReport,

  // ── Mobile: Agent Runner ──
  runAgent: handleRunAgent,

  // ── Mobile: Release ──
  releaseChecks: handleReleaseChecks,
  mobileBumpVersion: handleMobileBumpVersion,
  mobileGenerateChangelog: handleMobileGenerateChangelog,
  grayReleaseConfig: handleGrayReleaseConfig,
  iosRelease: handleIosRelease,
  androidRelease: handleAndroidRelease,

  // ── Mobile: Testing (E2E) ──
  setupE2EConfig: handleSetupE2EConfig,
  verifySetup: handleVerifySetup,
  generateCIConfig: handleGenerateCIConfig,

  // ── Mobile: Onboard ──
  checkRnDoctor: handleCheckRnDoctor,
  checkAndroidSDK: handleCheckAndroidSDK,
  setupEnv: handleSetupEnv,
  setupEmulator: handleSetupEmulator,
  verifyBuild: handleVerifyBuild,

  // ── Mobile: MCP placeholders ──
  upload: handleMobsfUpload,
  mobsfUpload: handleMobsfUpload,
  scan: handleMobsfScan,
  mobsfScan: handleMobsfScan,
  bearerScan: handleBearerScan,

  // ── CE Plugin ──
  'ce-compound': handleCeAction,
  'ce-plan': handleCeAction,
  'ce-review': handleCeAction,
  'ce-debug': handleCeAction,
  'ce-brainstorm': handleCeAction,
  'ce-work': handleCeAction,

  // ── Skill ──
  invokeSkill: handleInvokeSkill,

  // ── LLM Proxy Audit ──
  lobsterTrapInstall: handleLobsterTrapInstall,
  'lobster-trap-install': handleLobsterTrapInstall,
  lobsterTrapConfig: handleLobsterTrapConfig,
  'lobster-trap-config': handleLobsterTrapConfig,
  honeytoolSetup: handleHoneytoolSetup,
  'honeytool-setup': handleHoneytoolSetup,
  diffTest: handleDiffTest,
  'diff-test': handleDiffTest,
  whitelistValidate: handleWhitelistValidate,
  'whitelist-validate': handleWhitelistValidate,
  egressBenchmark: handleEgressBenchmark,
  'egress-benchmark': handleEgressBenchmark,
  llmProxyReport: handleLlmProxyReport,
  'llm-proxy-report': handleLlmProxyReport,
};

// ── Dispatch ──

export async function executeAction(sceneId, action, params, context, targetPath) {
  try {
    if (action.startsWith('ce-')) {
      return handleCeAction(action, params, targetPath, context);
    }

    const handler = ACTION_REGISTRY[action];
    if (handler) {
      const result = handler(action, params, targetPath, context);
      return result instanceof Promise ? await result : result;
    }

    return getActionMessage(action);
  } catch (error) {
    if (context) context.lastStepFailed = true;
    console.error(`\n⚠️ 执行 ${action} 时出错: ${error.message}`);
    return `动作 ${action} 执行完成（部分操作可能失败）`;
  }
}
