# Attribution - `variant-analysis`

Variant analysis - find the same bug pattern across a codebase after one instance is confirmed.

## Source

- Upstream: https://github.com/trailofbits/skills
- Plugin path: `plugins/variant-analysis`
- Fetched: 2026-07-25 from `@main`
- Mirror used: https://cdn.jsdelivr.net/gh/trailofbits/skills@main/plugins/variant-analysis/ - github.com is unreachable from this host,
  jsDelivr serves the same repository content

## License

Upstream content is licensed **CC BY-SA 4.0** (Creative Commons
Attribution-ShareAlike 4.0 International), (c) Trail of Bits.
License text: https://creativecommons.org/licenses/by-sa/4.0/legalcode

**The files in this directory are NOT covered by this repository's Elastic
License 2.0.** They remain under CC BY-SA 4.0. Verbatim copies require
attribution only; where this repository adapted a file, the adaptation is
likewise released under CC BY-SA 4.0 as ShareAlike requires.

## What is verbatim vs adapted

| File | State |
|---|---|
| `SKILL.md` (`insecure-defaults` only) | **Adapted** - upstream ships a Claude-plugin command (`commands/audit.md` + `workflows/audit.js`) driven by a `Workflow` tool and `${CLAUDE_PLUGIN_ROOT}`; neither exists in this engine, so the same method was rewritten to run with Grep/Read. |
| everything else | **Verbatim** - byte-for-byte from upstream. |

## Files

| Path | sha256[:16] |
|---|---|
| `SKILL.md` | `7b6b78e499bcb88d` |
| `references/reporting.md` | `07a1d8f25537ec3d` |
| `references/root-cause.md` | `b4556f22adadc894` |
| `references/searching.md` | `22834e63e7412220` |
| `references/triage.md` | `f1f0277096ae4164` |
