---
description: Alias to setup workflow (Mix-Coding System)
argument-hint: "[args]"
---
`e2e` is merged into `setup`. Run:

```bash
claude-scene start setup --auto $ARGUMENTS
```

`setup` defaults to `e2e` (MSW + Supertest + Schemathesis). Inform the user that
`e2e` has been merged into `setup`.
