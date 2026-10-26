---
name: insecure-defaults
description: "Audit a codebase for insecure default configuration: fallback secrets, seeded default credentials, fail-open security switches, weak crypto, permissive access, debug leakage. Use when reviewing config/auth/deploy wiring, or when checking whether an application actually runs insecurely out of the box."
---

# Insecure Defaults Audit

Find configuration that is **insecure when the app actually runs**, not merely
suspicious-looking literals. The distinction is the entire discipline of this skill.

## Corpus

Six categories, each with a machine-readable seed set (`references/<id>.json`,
grep-compatible `seeds`) and a judgement document (`references/<id>.md` with
**Report when** / **Skip when** and worked vulnerable/secure pairs):

| Category | Example | Seeds | Judgement |
|---|---|---|---|
| Fallback secrets | `SECRET = env.get('KEY') or 'dev'` | `fallback-secrets.json` | `fallback-secrets.md` |
| Default credentials | seeded `admin` / `admin123` | `default-credentials.json` | `default-credentials.md` |
| Fail-open switches | `getenv('REQUIRE_AUTH', 'false')` | `fail-open-security.json` | `fail-open-security.md` |
| Weak crypto | `hashlib.md5(password)` | `weak-crypto.json` | `weak-crypto.md` |
| Permissive access | `ACL='public-read'`, `0o666`, CORS `*` | `permissive-access.json` | `permissive-access.md` |
| Debug leakage | `traceback.format_exc()` in a response | `debug-features.json` | `debug-features.md` |

## How to run it here

The upstream plugin drives this through a multi-agent pipeline and a `Workflow`
tool call. Neither exists outside the Claude Code plugin runtime, so this copy
runs the same method with ordinary tools:

1. **Seed sweep.** For each category, `Grep` the seed regexes from `references/<id>.json`
   across the scope under review. Collect candidates only — say nothing yet.
2. **Recon.** Read the stack and deploy manifests (Dockerfile, compose, Helm,
   CI env, `.env.example`, IaC) to learn how the app is actually configured.
3. **Verify each candidate against its `.md` rules.** This is the phase that
   matters. Two shapes, judged differently:
   - **Configurable** — a lookup with a fallback. A finding only if the app
     *runs* with the fallback. `env.get('K', 'x')` runs; `env['K']` crashes
     instead, so it is fine.
   - **Unconditional** — no configuration anywhere, insecure as written. About
     half of all real findings. A missing env var is **not** grounds to refute one.
4. **Report** per category with file:line, why it is reachable, and the concrete
   impact. Drop everything refuted in step 3 — a literal in a test fixture or a
   value only used as a cache key is not a finding.

Do not report from seeds alone. A seed hit is a candidate; only step 3 produces a finding.

## Scope

Whatever you point at is the target, however test-like it looks: a run scoped to
`tests/` audits the tests. Exclusions (fixtures, docs, vendored code) apply only
outside the named scope.

Companion: `sharp-edges` covers dangerous *API shapes*; this skill covers
dangerous *default values*. Overlap is intentional — different failure modes.
