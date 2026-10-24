---
description: Alias to setup workflow (Mix-Coding System)
argument-hint: "[args]"
---
`monitor` is merged into `setup`. Run:

```bash
claude-scene start setup --auto $ARGUMENTS
```

`setup` asks for the facility kind; to get monitoring (Upptime + GitHub Actions)
select `monitor` instead of the default `e2e`. Inform the user that `monitor` has
been merged into `setup`.
