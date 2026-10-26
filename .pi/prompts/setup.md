---
description: 搭建质量观测设施（E2E 测试 / 网站监控 / 属性测试），走 setup 场景引擎
argument-hint: "[e2e|monitor|property]"
---

Run the Mix-Coding System `setup` workflow by executing:

```bash
claude-scene start setup --kind ${1:-e2e} --auto -t "$PWD"
```

三种 `--kind`：

| kind | 装什么 |
|---|---|
| `e2e`（默认） | MSW + Supertest + Schemathesis |
| `monitor` | Upptime + GitHub Actions |
| `property` | fast-check（JS）/ hypothesis（Python）属性测试 |

`--kind` 写错时引擎会列出可用值并回落默认分支，不会静默改变计划。

Report the command output and the acceptance triple (changes / verify command / verify result).
