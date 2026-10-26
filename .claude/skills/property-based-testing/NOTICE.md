# Attribution - `property-based-testing`

Property-based testing - writes, reviews and debugs property tests (Hypothesis / fast-check / proptest / jqwik / Echidna / Medusa).

## Source

- Upstream: https://github.com/trailofbits/skills
- Plugin path: `plugins/property-based-testing`
- Fetched: 2026-07-25 from `@main`
- Mirror used: https://cdn.jsdelivr.net/gh/trailofbits/skills@main/plugins/property-based-testing/ - github.com is unreachable from this host,
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
| `SKILL.md` | `9448cacb65c6237a` |
| `references/generating.md` | `c0e72dfc89babe3c` |
| `references/interpreting-failures.md` | `dbae7db8773712ba` |
| `references/libraries.md` | `f7218acf8e668130` |
| `references/refactoring.md` | `6eb5c206f5757047` |
| `references/reviewing.md` | `110b08118a1e7b1a` |
