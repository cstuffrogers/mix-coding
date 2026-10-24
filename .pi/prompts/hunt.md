---
description: Alias to review workflow (Mix-Coding System)
argument-hint: "[args]"
---
`hunt` is merged into `review` with the `security_deep` mode (enabled by default).

```bash
claude-scene start review --auto $ARGUMENTS
```

Inform the user that `hunt` has been merged into `review` — the security scan
(security headers, skill spectre, ReDoS, CORS, log sanitization, secret scanning,
sensitive file check) runs as part of review's `security_deep` mode.
