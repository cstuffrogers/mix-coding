---
name: sec-bug-hunt
description: Security-focused code review skill that scans for XSS, SQL injection, CSRF, hardcoded secrets, and insecure dependencies using static analysis patterns and npm audit.
---

# Security Bug Hunt

A security-focused review skill for finding common vulnerabilities in frontend and backend code.

## Trigger Conditions

- User mentions: "安全审查", "漏洞扫描", "security review", "security scan", "XSS", "SQL injection"
- User invokes `/hunt` or requests a security-focused code review
- Before merging code that handles user input, authentication, or file operations

## Capabilities

### XSS Detection

Scan for dangerous DOM manipulation and rendering patterns:

- `innerHTML` assignments with unsanitized input
- `dangerouslySetInnerHTML` in React without sanitization
- `v-html` in Vue with untrusted data
- Template literals in HTML contexts
- Missing `Content-Security-Policy` headers

Checklist:
- [ ] No raw HTML insertion from user input
- [ ] All dynamic URLs are validated or use a whitelist
- [ ] `target="_blank"` links have `rel="noopener noreferrer"`

### SQL Injection Detection

Identify unsafe database query patterns:

- String concatenation in SQL queries
- Unparameterized `query()`, `execute()`, `raw()` calls
- Template literals inside SQL strings
- Dynamic table/column names without allowlisting

Checklist:
- [ ] All queries use parameterized statements / prepared statements
- [ ] No user input concatenated into SQL strings
- [ ] ORM query builders are used correctly (no raw interpolation)

### CSRF Detection

Verify state-changing requests are protected:

- Form submissions missing CSRF tokens
- AJAX `POST`/`PUT`/`DELETE` without custom headers or tokens
- Missing `SameSite` cookie attributes
- No `X-CSRF-Token` or `X-Requested-With` headers

Checklist:
- [ ] State-changing endpoints validate CSRF tokens
- [ ] Session cookies use `SameSite=Lax` or `SameSite=Strict`
- [ ] CORS configuration is not overly permissive on sensitive endpoints

### Secret Leak Detection

Find hardcoded sensitive data:

- API keys, passwords, tokens in source code
- `.env` files committed to version control
- Comments containing credentials
- High-entropy strings assigned to common secret variable names
- Private keys in `*.pem`, `*.key` files

Checklist:
- [ ] `.env` and `*.local` files are in `.gitignore`
- [ ] No secrets in code, tests, or documentation examples
- [ ] CI/CD variables use secret management, not hardcoded strings

### Dependency Vulnerabilities

Run and interpret:

```bash
npm audit --audit-level=moderate
```

Checklist:
- [ ] No critical or high severity vulnerabilities in dependencies
- [ ] Outdated authentication / crypto libraries are flagged
- [ ] `package-lock.json` / `yarn.lock` is committed for reproducible installs

## Tools & Commands

| Tool | Command | Purpose |
|---|---|---|
| npm audit | `npm audit` | Dependency vulnerability scan |
| ESLint security | `npx eslint --plugin security` | Static security rules |
| grep patterns | Manual search | Hardcoded secrets, dangerous functions |
| git grep | `git grep -n "innerHTML"` | Quick codebase scans |

## Output Format

Produce a report with these sections:

```markdown
# Security Review Report — <scope>

| Severity | Count | Auto-fixable |
|---|---|---|
| Critical | N | N |
| High | N | N |
| Warning | N | N |
| Info | N | N |

## Critical
- **File:line** — Issue description — Suggested fix

## High
- **File:line** — Issue description — Suggested fix

## Warnings
- **File:line** — Issue description — Suggested fix

## Info
- General recommendations (CSP headers, security headers, etc.)

## Remediation Order
1. Fix all Critical items before merge
2. Fix High items in the same PR or immediate follow-up
3. Schedule Warning items in the next sprint
```

## Success Criteria

- **NO_CRITICAL_SECRETS**: No hardcoded secrets in source
- **NO_CRITICAL_XSS**: No unescaped user input in HTML
- **NO_CRITICAL_SQLI**: All SQL uses parameterized queries
- **AUDIT_CLEAN**: No unaddressed `npm audit` critical/high findings
- **CSRF_CHECKED**: State-changing endpoints are protected
