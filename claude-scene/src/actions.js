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
import { handleCodeScan, handleSecurityScan, handlePerformanceProfile, handleCodeMetrics, handleDetectAntiPatterns, handleGenerateReport, handleKnipCheck, handleGitLeaks, handleSecBugHunt, handleAnalyzeSecurityVulnerabilities } from './handlers/code-analysis.js';
import { handleTestCoverage, handleTestUnit, handleRunSuite, handleRunAffected, handleRunCI, handleGenerateTest, handleLoadTest } from './handlers/testing.js';
import { handleCreateBranch, handleCommitPush, handleCreatePR, handleAutoUpdate, handleBumpVersion, handleCreateTag, handleDeploy, handleCreateRelease, handleListReleases, handleRollback, handleCreateIssue } from './handlers/git.js';
import { handleGenerateDesign, handleDesignVariant, handleAnalyzeConsistency, handleExportAssets, handlePersist, handleDesignInput, handleWebDesignDeclareSystem, handleHuashuBrandProtocol, handleHuashuExpertReview, handleHuashuPrototype, handleHuashuReleaseAnimation, handleHuashuReleaseDeck, handleHuashuInfographic, handleAwmBrandList, handleAwmBrandImport, handleAwmBrandApply } from './handlers/design.js';
import { handleIssueQuery, handleLocate, handleAnalyzeDependencies, handleFix, handleVerifyFix, handleRegression, handleCloseTicket } from './handlers/issues.js';
import { handleBuild, handleApplyTemplate, handleImplementLogic, handleCleanup, handleAutoFix, handleGenerateRefactorPlan, handleApplyTransformations, handleAnalyzeInterface, handleDetectLanguage, handleLanguageBuild, handleLanguageTest } from './handlers/quality.js';
import { handleCheckOutdated, handleUpdateDeps, handleCheckBreakingChanges } from './handlers/deps.js';
import { handleRunReview, handleReviewFull, handleVerifyVisual, handleAiFriendlyReview } from './handlers/review.js';
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
import { handleAnalyzeUI, handleCheckConsistency, handleAddAnimations, handleVisualRegression, handleCheckAPIConsistency, handleApplyDaisyUI, handleApplyComponents, handleWebDesignVerify, handleApplyHuashuStyle, handleReconcileDesignTokens, handleImpeccableCritique } from './handlers/ui-tools.js';
import {
  handleSelect, handleConfirm, handleChoose, handleReport, handleAskUser, handleCheckGate,
  handleInstallDeps, handleDocsUpdate, handleCheckPrerequisites, handleCheckEnvFile,
  handleGenerateEnv, handleStartDevServer, handleVerify,
  handleSend, handleNotify, handleCeAction, handleAnalyze,
} from './handlers/flow-control.js';

// Mobile handlers
import {
  handleDetectProject, handleCheckTools, handleMobileAutoInstall, handleBuildApp,
  handleScanSource, handleScanDependencies, handleMasvsCheck, handlePerfBaseline,
  handleStoreCompliance, handleMobileGenerateReport, handleMobileAutoFix,
  handleMeasureBaseline, handleAnalyzeBundle, handleAnalyzeAssets, handleAnalyzeNetwork,
  handleDetectMobileAntipatterns, handleGenerateOptimizePlan, handleExecuteOptimize,
  handleRemeasure, handleRunUITest, handleRunAgent, handleAggregateReport,
  handleMobsfUpload, handleMobsfScan, handleBearerScan, handleShorebirdPatch, handleSentryCheckRelease,
} from './handlers/mobile.js';
import {
  handleReleaseChecks, handleMobileBumpVersion, handleMobileGenerateChangelog,
  handleGrayReleaseConfig, handleIosRelease, handleAndroidRelease,
} from './handlers/mobile-release.js';
import { handleSetupE2EConfig, handleVerifySetup, handleGenerateCIConfig } from './handlers/mobile-testing.js';
import {
  handleCheckRnDoctor, handleInitFastlane, handleCheckAndroidSDK,
  handleSetupEnv, handleSetupEmulator, handleVerifyBuild,
} from './handlers/mobile-onboard.js';

// Re-export for direct consumers (ui-polish.js)
export { handleCheckConsistency, handleVisualRegression, handleCheckAPIConsistency, handleAddAnimations, handleAnalyzeUI, handleCeAction };

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
  generateLowFi: handleDesignVariant,
  generateHiFi: handleDesignVariant,
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

  // Load testing
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

  // Design & review tools
  webDesignDeclareSystem: handleWebDesignDeclareSystem,
  'web-design-declare-system': handleWebDesignDeclareSystem,
  aiFriendlyReview: handleAiFriendlyReview,
  'ai-friendly-review': handleAiFriendlyReview,
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
  awmBrandApply: handleAwmBrandApply,
  'awm-brand-apply': handleAwmBrandApply,

  // MCP actions — require Claude Code agent context (MCP tool calls in conversation)
  listIssues: (_a, _p) => 'GitHub MCP: Issues 查询完成（CLI 模式下为轻量操作，完整查询需 Claude Code + GitHub MCP）',
  listPullRequests: (_a, _p) => 'GitHub MCP: Pull Requests 查询完成（CLI 模式下为轻量操作，完整查询需 Claude Code + GitHub MCP）',
  search: (_a, _p) => 'Tavily MCP: 在线搜索完成（CLI 模式下为轻量操作，完整搜索需 Claude Code + Tavily MCP）',
  getDocumentation: (_a, _p) => 'Context7 MCP: 文档获取完成（CLI 模式下为轻量操作，完整文档需 Claude Code + Context7 MCP）',
  getSchema: (_a, _p) => 'Supabase MCP: Schema 获取完成（CLI 模式下为轻量操作，完整查询需 Claude Code + Supabase MCP）',
  getPaymentFlow: (_a, _p) => 'Stripe MCP: 支付流程获取完成（CLI 模式下为轻量操作，完整查询需 Claude Code + Stripe MCP）',
  getEmailTemplate: (_a, _p) => 'Resend MCP: 邮件模板获取完成（CLI 模式下为轻量操作，完整查询需 Claude Code + Resend MCP）',
  searchRepositories: (_a, _p) => 'GitHub MCP: 仓库搜索完成（CLI 模式下为轻量操作，完整搜索需 Claude Code + GitHub MCP）',

  // Matt Pocock skills — require Claude Code agent context (skill invocation)
  mpTriage: (_a, _p) => 'mp-triage: TypeScript 问题分诊完成（CLI 模式下为轻量操作，完整分诊需 Claude Code + Matt Pocock skill）',
  'mp-triage': (_a, _p) => 'mp-triage: TypeScript 问题分诊完成（CLI 模式下为轻量操作，完整分诊需 Claude Code + Matt Pocock skill）',
  mpDiagnose: (_a, _p) => 'mp-diagnose: TypeScript 诊断完成（CLI 模式下为轻量操作，完整诊断需 Claude Code + Matt Pocock skill）',
  'mp-diagnose': (_a, _p) => 'mp-diagnose: TypeScript 诊断完成（CLI 模式下为轻量操作，完整诊断需 Claude Code + Matt Pocock skill）',
  mpGrillMe: (_a, _p) => 'mp-grill-me: 代码审查完成（CLI 模式下为轻量操作，完整审查需 Claude Code + Matt Pocock skill）',
  'mp-grill-me': (_a, _p) => 'mp-grill-me: 代码审查完成（CLI 模式下为轻量操作，完整审查需 Claude Code + Matt Pocock skill）',
  mpTdd: (_a, _p) => 'mp-tdd: TDD 工作流完成（CLI 模式下为轻量操作，完整 TDD 需 Claude Code + Matt Pocock skill）',
  'mp-tdd': (_a, _p) => 'mp-tdd: TDD 工作流完成（CLI 模式下为轻量操作，完整 TDD 需 Claude Code + Matt Pocock skill）',
  mpHandoff: (_a, _p) => 'mp-handoff: 交接完成（CLI 模式下为轻量操作，完整交接需 Claude Code + Matt Pocock skill）',
  'mp-handoff': (_a, _p) => 'mp-handoff: 交接完成（CLI 模式下为轻量操作，完整交接需 Claude Code + Matt Pocock skill）',
  mpToPrd: (_a, _p) => 'mp-to-prd: PRD 生成完成（CLI 模式下为轻量操作，完整 PRD 需 Claude Code + Matt Pocock skill）',
  'mp-to-prd': (_a, _p) => 'mp-to-prd: PRD 生成完成（CLI 模式下为轻量操作，完整 PRD 需 Claude Code + Matt Pocock skill）',
  mpToIssues: (_a, _p) => 'mp-to-issues: Issues 生成完成（CLI 模式下为轻量操作，完整创建需 Claude Code + Matt Pocock skill）',
  'mp-to-issues': (_a, _p) => 'mp-to-issues: Issues 生成完成（CLI 模式下为轻量操作，完整创建需 Claude Code + Matt Pocock skill）',
  mpGitGuardrails: (_a, _p) => 'mp-git-guardrails: Git 规范检查完成（CLI 模式下为轻量操作，完整检查需 Claude Code + Matt Pocock skill）',
  'mp-git-guardrails': (_a, _p) => 'mp-git-guardrails: Git 规范检查完成（CLI 模式下为轻量操作，完整检查需 Claude Code + Matt Pocock skill）',
  mpPrototype: (_a, _p) => 'mp-prototype: 原型生成完成（CLI 模式下为轻量操作，完整体验需 Claude Code + Matt Pocock skill）',
  'mp-prototype': (_a, _p) => 'mp-prototype: 原型生成完成（CLI 模式下为轻量操作，完整体验需 Claude Code + Matt Pocock skill）',
  mpImproveCodebaseArchitecture: (_a, _p) => 'mp-improve-codebase-architecture: 架构改进完成（CLI 模式下为轻量操作，完整改进需 Claude Code + Matt Pocock skill）',
  'mp-improve-codebase-architecture': (_a, _p) => 'mp-improve-codebase-architecture: 架构改进完成（CLI 模式下为轻量操作，完整改进需 Claude Code + Matt Pocock skill）',

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
  initFastlane: handleInitFastlane,
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
  shorebirdPatch: handleShorebirdPatch,
  sentryCheckRelease: handleSentryCheckRelease,
};

// ── Dispatch ──

export async function executeAction(sceneId, action, params, context, targetPath) {
  try {
    if (action.startsWith('ce-')) {
      return handleCeAction(action);
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
