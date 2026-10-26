# Vendored skills (Trail of Bits, CC BY-SA 4.0)

Four skills from [trailofbits/skills](https://github.com/trailofbits/skills) are
vendored under `.claude/skills/`. They fill the **logic / IO** detection
dimension that static analyzers cannot cover — see
[tool-versions.md](./tool-versions.md) §3.1.

| Skill | Dimension | Wired into |
|---|---|---|
| `property-based-testing` | Logic — writes/reviews property tests (Hypothesis, fast-check, proptest, jqwik, Echidna, Medusa) | `setup` 2.35 (after the executable `propertyTestScout` step) |
| `variant-analysis` | IO — after one confirmed bug, hunt the same pattern repository-wide | `review` 4.62 (after semgrep) |
| `sharp-edges` | IO — error-prone APIs, dangerous config surfaces, 12-language footgun table | `review` 4.63 |
| `insecure-defaults` | IO — fallback secrets, seeded credentials, fail-open switches, weak crypto, permissive access, debug leakage (6 grep-ready seed sets) | `review` 4.61 (deterministic scan) → 4.64 (skill) |

## Why these four

The project already had three of the four dimensions:

- **Static analysis** — `semgrep` with the offline rule pack (`review` 4.6)
- **Runtime property testing** — `propertyTestScout` (`setup` 2.3)
- **Runtime mutation testing** — `stryker` (`qa` 6.5)

## `insecure-defaults`: from prompt to deterministic detector

A skill is a prompt — non-deterministic, and it can only refute what it happens
to think of. `insecure-defaults` ships **6 machine-readable seed sets**
(`references/*.json`, grep `-E` syntax), so that half of it can be executed
deterministically. Two steps, in this order:

1. **`review` 4.61 `insecure-defaults-scan`** — `src/handlers/security/insecure-defaults.js`
   reads the seeds **from the vendored skill directory at runtime** (no copy in
   `src/`, so the two can never drift), compiles them with JS `RegExp`, scans the
   project source + config manifests (`.yml/.toml/.json/.tf/.env/Dockerfile/…`),
   applies a deterministic refutation pass, and emits **candidates** into
   `context.insecureDefaultsCandidates`. It also lands in the review report.
2. **`review` 4.64** — the skill then does what only an LLM can: read each
   candidate in context and decide with its Report when / Skip when rules.

Discipline that keeps the two steps honest:

- **Seed hit ≠ vulnerability.** Every message says 候选 and 需逐条证伪; the
  handler never emits 失败/阻断 for a candidate list (that wording would turn
  `detectHandlerFailure` into a merge block).
- **Seeds are compiled case-sensitively**, as `grep -E` does. Upstream lists
  `md5|MD5` and `(True|true|1)` — enumerating both cases is the proof that `/i`
  is wrong. Compiling with `/i` made `let hasVerify = false` match the fail-open
  seed; on this repository it was the difference between 28 candidates and 1.
- **POSIX classes inside a character class** (`[^:@[:space:]]`) must be translated
  structurally, not by string replacement — naive replacement yields
  `[^:@[\s]]`, which requires a literal `]` and silently never matches.
- **Deterministic refutation** runs before anything is reported: whole-line
  comments, docs/vendor/test paths (reversed for `scope: tests`), template
  interpolation (`${…}`, `#{…}`), rule-definition lines, object-field
  assignments (vs config keys), hex colors / escape sequences, standard file
  modes (755/644 …), plus per-category rules (non-secret env suffixes like
  `PORT`/`TMPDIR`, path-like fallbacks, placeholder credentials, role keys whose
  value is not a known default, checksum/temp-filename `md5`, `0.0.0.0` bind vs
  CIDR `0.0.0.0/0`, log sinks for stack traces).
- **Zero scanned files is a failure**, same as semgrep (`assertSources`); a
  missing rule corpus is a `noop` (`未找到`).

Known recall limit (upstream seed shape, not a bug here): `tls_verify: false` in
YAML is not matched by the fail-open seeds, which expect `TLS_VERIFY = false` or
`verify = False`. That is exactly what step 4.64 exists for.

Trail of Bits splits their own marketplace the same way
(`static-analysis`, `property-based-testing`, `mutation-testing`,
`dimensional-analysis`), which independently confirms the split. What was
missing on the LLM-review side was *method*: the vendored skills carry
catalogues and refutation rules that this repo did not have — 9 property
categories plus the two "asserts nothing" fake-test shapes, and per-category
**Report when / Skip when** rules for insecure defaults.

These are prompts, not engines. They never replace semgrep: an LLM pass can miss
and can hallucinate, semgrep is deterministic in two seconds. They sit at the
same layer as the existing `sec-bug-hunt` / `mp-review` / `review-checklist`
skills.

## License

**CC BY-SA 4.0**, © Trail of Bits. These files are **not** covered by this
repository's Elastic License 2.0. Each directory carries a `NOTICE.md` with the
upstream path, fetch date, per-file SHA-256, and whether the file is verbatim or
adapted. Only `insecure-defaults/SKILL.md` is adapted — upstream drives it
through a Claude-plugin `Workflow` tool and `${CLAUDE_PLUGIN_ROOT}`, neither of
which exists here, so the same method was rewritten against Grep/Read.

Treat the CC BY-SA boundary as load-bearing: do not present these directories as
Elastic-licensed. `skill-runner.test.js` asserts each `NOTICE.md` still states
the CC BY-SA terms.

## Updating

`github.com` is unreachable from this host, but jsDelivr proxies the same
repository content:

```
https://cdn.jsdelivr.net/gh/trailofbits/skills@main/plugins/<plugin>/skills/<plugin>/SKILL.md
```

Pin nothing at `@main` if you care about reproducibility — record the fetch date
and file hashes in `NOTICE.md` (the generator does this automatically). Skills
reference sibling `.md` files; copy every reference and keep the relative layout,
otherwise links dangle. `.claude/skills/*` has no dangling-link allowance: the
test suite fails if a reference is missing.

## Where they load from

`invokeSkill` resolves a skill name through this chain, first hit wins
(`resolveSkillCandidates` in `src/handlers/skill-runner.js`):

1. `<target project>/.claude/skills/…` — project-local override
2. `<target project>/../.claude/skills/…` — legacy compatibility
3. `<package root>/../.claude/skills/…` — this repository (npm link flow)
4. `~/.mix-coding/.claude/skills/…` — global install (`install-global.sh` §6)
5. `<package root>/.claude/skills/…` — skills shipped inside the package

Steps 1–2 mean an analysed project can override any skill. Steps 3–5 are what
make the same scenes work from any directory.

## Discovery outside this repo

- **Claude Code** reads `.claude/skills/` directly.
- **pi / percho** discover from `.agents/skills/`, which is git-ignored and
  local-only. `scripts/pi-setup.sh` mirrors the vendored four into it, so they
  appear in the skill list rather than only being reachable through
  `invokeSkill`.
