// Barrel file — re-exports from split handler modules for backward compatibility
export {
  handleCodeScan, handlePerformanceProfile, handleCodeMetrics,
  handleDetectAntiPatterns, handleGenerateReport
} from './code-metrics.js';
export {
  handleSecurityScan, handleGitLeaks, handleSecBugHunt,
  handleAnalyzeSecurityVulnerabilities,
  handleLogSanitization, handleCorsCheck, handleEnvVarLeak,
  handlePostinstallCheck, handleSocketScan,
  handleSensitiveFileCheck, handleTechDebtScan,
  handleLockFileConsistency, handleGitignoreCheck, handleDeprecatedDeps
} from './security-scanning.js';
export {
  handleKnipCheck, handleBuildLeakCheck, handleDeadLinkCheck,
  handleSecurityHeaders, handleRecheckCli
} from './external-tool-checks.js';
export { handleLighthouseGate } from './lighthouse.js';
export { handleOpenRedirectScan } from './open-redirect.js';
export { handleStateAudit } from './state-audit.js';
export { handleI18nAudit } from './i18n.js';
