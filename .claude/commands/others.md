---
description: 查看所有可用工具（场景工作流 + 辅助工具），弹出分类选择菜单
---

# /others — 工具箱

显示所有可用工具的分类菜单，选择一个直接执行。

## 分类菜单

显示以下菜单让用户选择：

```
🛠 可用工具

【自动化场景工作流】
1.  /feature      — 新功能开发（需求→实现→测试→PR）
2.  /bugfix       — Bug修复（定位→修复→回归→关单）
3.  /refactor     — 代码重构（度量→反模式→变换→验证）
4.  /review       — 代码审查（5层+CE+安全审计）
5.  /optimize     — 性能优化（基线→反模式→before/after）
6.  /simplify     — 代码简化（嵌套/长函数/重复逻辑）
7.  /hunt         — 安全扫描（漏洞+依赖+自动修复）
8.  /design       — AI设计（多风格生成+资产导出）
9.  /analyze      — 竞品分析（OpenDigger数据）
10. /loop         — 自动迭代（审查→修复→验证循环）
11. /new-project  — 新项目创建（全流程脚手架）
12. /ui-polish    — 前端美化（DaisyUI/Animal Island）
13. /release      — 发布部署（门禁→构建→Tag→发布）
14. /audit        — 项目健康检查（安全+质量+依赖+性能）
15. /prototype    — 快速原型（需求访谈→MVP→验证）
16. /deps         — 依赖更新（过期扫描→逐项更新→提交）
17. /rollback     — 紧急回滚（版本选择→回滚→健康检查）
18. /onboard      — 环境搭建（语言检测→依赖→.env→启动）

【语言工具】（通过场景自动调用，也可手动触发）
19. Go          — go-build / go-test / go-review
20. Rust        — rust-build / rust-test / rust-review
21. Flutter     — flutter-build / flutter-test / flutter-review
22. Kotlin      — kotlin-build / kotlin-test / kotlin-review
23. C++         — cpp-build / cpp-test / cpp-review
24. Python      — python-review / fastapi-review
25. Gradle      — gradle-build

【辅助工具】（按需手动触发）
26. auto-update     — 拉取最新代码
27. build-fix       — 自动修复构建错误
28. test-coverage   — 测试覆盖率检查
29. quality-gate    — 质量门禁汇总
30. verify          — 验证改动是否生效
31. cost-report     — Token/API成本报告

请输入编号执行：
```

## 实现逻辑

1. 显示上述菜单
2. 用户输入编号 1-31
3. 映射到对应 command 或 skill 并执行：
   - 1-18: 执行对应的场景命令（如选择1 → `/feature`）
   - 19-25: 弹出子菜单让用户选择具体操作（build/test/review）
   - 26-31: 直接执行对应的 skill

## 编号映射

| 编号 | 命令/Skill | 类型 |
|------|-----------|------|
| 1 | /feature | 场景 |
| 2 | /bugfix | 场景 |
| 3 | /refactor | 场景 |
| 4 | /review | 场景 |
| 5 | /optimize | 场景 |
| 6 | /simplify | 场景 |
| 7 | /hunt | 场景 |
| 8 | /design | 场景 |
| 9 | /analyze | 场景 |
| 10 | /loop | 场景 |
| 11 | /new-project | 场景 |
| 12 | /ui-polish | 场景 |
| 13 | /release | 场景 |
| 14 | /audit | 场景 |
| 15 | /prototype | 场景 |
| 16 | /deps | 场景 |
| 17 | /rollback | 场景 |
| 18 | /onboard | 场景 |
| 19 | go-{build,test,review} | Skill子菜单 |
| 20 | rust-{build,test,review} | Skill子菜单 |
| 21 | flutter-{build,test,review} | Skill子菜单 |
| 22 | kotlin-{build,test,review} | Skill子菜单 |
| 23 | cpp-{build,test,review} | Skill子菜单 |
| 24 | {python,fastapi}-review | Skill子菜单 |
| 25 | gradle-build | Skill |
| 26 | auto-update | Skill |
| 27 | build-fix | Skill |
| 28 | test-coverage | Skill |
| 29 | quality-gate | Skill |
| 30 | verify | Skill |
| 31 | cost-report | Skill |
