# Attribution - `insecure-defaults`

Insecure defaults - fallback secrets, seeded credentials, fail-open switches, weak crypto, permissive access, debug leakage.

## Source

- Upstream: https://github.com/trailofbits/skills
- Plugin path: `plugins/insecure-defaults`
- Fetched: 2026-07-25 from `@main`
- Mirror used: https://cdn.jsdelivr.net/gh/trailofbits/skills@main/plugins/insecure-defaults/ - github.com is unreachable from this host,
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
| `README.md` | `999d8d5fcb7153ee` |
| `SKILL.md` | `ad6792a40a0355a1` |
| `commands/audit.md` | `75883127cbe66d51` |
| `references/debug-features.json` | `5f1ea6080d50bc46` |
| `references/debug-features.md` | `c83c54a3f8a36939` |
| `references/default-credentials.json` | `46169168a34a1843` |
| `references/default-credentials.md` | `259a036867182b04` |
| `references/fail-open-security.json` | `c44057e9251b46eb` |
| `references/fail-open-security.md` | `0e837dd32f600c77` |
| `references/fallback-secrets.json` | `717eb7850b4d0fec` |
| `references/fallback-secrets.md` | `eea72165e891ff40` |
| `references/permissive-access.json` | `8ee01d7845a964c2` |
| `references/permissive-access.md` | `6e4bd7798b7d1e40` |
| `references/weak-crypto.json` | `792b59a3488fabe5` |
| `references/weak-crypto.md` | `df424cfe3ba37fc6` |
| `tests/README.md` | `f2f2c3e9334048c5` |
