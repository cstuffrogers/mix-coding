---
description: Analyze this project and generate a timestamped report
---

# /report — Project Analysis Report

Generate a comprehensive analysis of this project. Write the report to a timestamped markdown file.

## Process

### 1. Scan the Project

Read and analyze:
- `package.json` — dependencies, versions, scripts
- `CLAUDE.md` — project instructions and stack declaration
- `.specify/memory/constitution.md` — project principles (if exists)
- `specs/` — feature specifications and plans (if any exist)
- `app/` or `src/` directory — routes, pages, components
- `drizzle/` or database schemas — data model
- Test files — coverage and patterns
- `.env.example` or `.env.local` — environment variables (never read actual .env)

### 2. Generate Report

Create a report with these sections:

#### Executive Summary
2-3 sentences: what this project is, its current state (early/active/mature), and overall health assessment.

#### Tech Stack

| Package | Version | Purpose | Status |
|---------|---------|---------|--------|
| next | 16.x | Framework | Current |
| drizzle-orm | 0.x | Database ORM | Current |
| ... | ... | ... | ... |

Status: `Current` / `Outdated` / `Deprecated` / `Unknown`

Check actual installed versions from `package.json`, not assumptions.

#### Critical Routes

| Route | Purpose | Auth Required | Method |
|-------|---------|---------------|--------|
| / | Landing page | No | GET |
| /dashboard | User dashboard | Yes | GET |
| /api/auth/* | Auth endpoints | No | POST |
| ... | ... | ... | ... |

Scan the `app/` directory structure to find all routes. Note which ones require authentication.

#### SWOT Analysis

**Strengths** — What the project does well:
- Good patterns, clean architecture, test coverage, type safety, etc.
- Be specific — cite files and patterns.

**Weaknesses** — Internal issues to address:
- Missing tests, tech debt, unclear naming, missing error handling, no input validation
- Rate each: Critical / High / Medium / Low

**Opportunities** — Improvements that would add value:
- Performance optimizations, new features, better DX, accessibility improvements
- Estimate effort: Quick win / Medium / Large

**Threats** — External risks:
- Outdated dependencies with known vulnerabilities
- Scaling bottlenecks
- Security gaps
- Breaking changes in upcoming dependency versions

### 3. Write the Report

Generate a timestamp in MMDDyy-HHmmss format (e.g., 030626-141500 for March 6, 2026 at 2:15 PM).

Write the report to: `reports/report-{timestamp}.md`

Create the `reports/` directory if it doesn't exist.

### 4. Present Results

Tell the user:
- Where the report was written
- Top 3 most critical findings
- Suggest: `jvn --report-fix @latest` to address the findings
