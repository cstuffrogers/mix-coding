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

// Trivy scanner - placeholder until implemented
export async function handleTrivyScan(_action, _params, _targetPath, _context) {
  return '[TRIVY] Trivy container scanner not yet implemented. Skipping for now.';
}
