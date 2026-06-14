// Barrel — re-exports from split security modules for backward compatibility
export {
  handleSecurityScan,
  handleAnalyzeSecurityVulnerabilities,
  handleDeprecatedDeps,
} from './security/npm-scan.js';
export {
  handleGitLeaks,
  handleSensitiveFileCheck,
} from './security/secret-scan.js';
export {
  handleSecBugHunt,
  handleLogSanitization,
} from './security/threat-scan.js';
export {
  handleCorsCheck,
  handleEnvVarLeak,
} from './security/config-check.js';
