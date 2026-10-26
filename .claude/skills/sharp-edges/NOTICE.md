# Attribution - `sharp-edges`

Sharp edges - error-prone APIs, dangerous configurations and footgun designs (authored by Scott Arciszewski).

## Source

- Upstream: https://github.com/trailofbits/skills
- Plugin path: `plugins/sharp-edges`
- Fetched: 2026-07-25 from `@main`
- Mirror used: https://cdn.jsdelivr.net/gh/trailofbits/skills@main/plugins/sharp-edges/ - github.com is unreachable from this host,
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
| `SKILL.md` | `3b69a709c2f8f0cf` |
| `references/auth-patterns.md` | `1fbf526ca1db7204` |
| `references/case-studies.md` | `2e81a320728b4597` |
| `references/config-patterns.md` | `1d99f2716f7bef18` |
| `references/crypto-apis.md` | `8baddc83a1f964d6` |
| `references/lang-c.md` | `d077d711c73749c9` |
| `references/lang-csharp.md` | `8fa9e93d36c0e139` |
| `references/lang-go.md` | `839c0e7b4e3fa2f3` |
| `references/lang-java.md` | `3b93b6049f7e0e35` |
| `references/lang-javascript.md` | `cf72f55d31318666` |
| `references/lang-kotlin.md` | `c891148c10a4941c` |
| `references/lang-php.md` | `7960d9773874cf06` |
| `references/lang-python.md` | `36543becc25b4e3f` |
| `references/lang-ruby.md` | `d9ba749caaccb8a3` |
| `references/lang-rust.md` | `3d14993ea70b2b2d` |
| `references/lang-swift.md` | `a64ab8692db0f3e4` |
| `references/language-specific.md` | `4522b4a37cfd7d3a` |
