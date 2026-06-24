# 项目健康审计报告

> 生成时间: 2026-06-24 | 项目: auto-coding | 分支: HEAD

---

## 质量门禁汇总

| 状态 | 数量 |
|------|------|
| ✅ PASS | 10 |
| ⚠️ WARN | 5 |
| 🔴 FAIL | 5 |

---

## Phase 1: 安全扫描

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 硬编码密钥/Token | ✅ PASS | 源码中无硬编码密钥 |
| XSS 漏洞 | ✅ PASS | `innerHTML`/`dangerouslySetInnerHTML` 仅在覆盖率文件和扫描器代码中 |
| eval/exec 动态执行 | ✅ PASS | 无实际 `eval()` 调用，均为函数名关键词误报 |
| 敏感文件暴露 | ✅ PASS | `.gitignore` 正确排除 `.env`/`*.pem`/`*.key`/`credentials.json` |
| CORS 配置 | ✅ PASS | 无 `Access-Control-Allow-Origin: *` 或 `cors()` 无配置 |
| 前端环境变量泄露 | ✅ PASS | `process.env` 使用均为服务端内部检查 |
| Git 历史密钥泄露 | ✅ PASS | 无敏感文件提交历史 |
| npm audit | ⚠️ SKIP | 镜像源 (kunlun7.cn9039) 不支持 `/npm/v1/security/*` API |
| ESLint 安全规则 | ⚠️ 1 处 | `no-eval` 在 `.claude/skills/impeccable/` 捆绑第三方代码中 |

## Phase 2: 代码质量

| 检查项 | 结果 | 详情 |
|--------|------|------|
| ESLint 总体 | 🔴 13,810 问题 | 13,757 errors + 53 warnings，绝大多数在 `.claude/skills/` 捆绑代码中 |
| TypeScript | ✅ PASS | `claude-scene/` tsc --noEmit 通过 |
| aislop AI 代码气味 | 🔴 868 项 | 360 console.log、144 叙事注释、64 未使用变量、58 函数过长、25 文件过大、20 虚假导入、20 吞异常 |
| 测试覆盖 | 🔴 不足 | 仅 16 个测试文件，1 个测试目录 (`tests/integration`) |
| TODO/FIXME 标记 | ✅ PASS | 仅 12 处 |
| knip 死代码检测 | ⚠️ SKIP | JSON 输出解析失败 |

## Phase 3: 依赖审计

| 检查项 | 结果 | 详情 |
|--------|------|------|
| 直接依赖数 | ✅ PASS | 18 个直接依赖 |
| 废弃依赖 | ✅ PASS | 无 deprecated 包 |
| 过期依赖 | ⚠️ 2 个 | `tailwindcss` 3.4.19→4.3.1 (大版本)、`vitest` 4.1.8→4.1.9 (补丁) |
| 虚假导入 | 🔴 20 个 | import 未在 package.json 中声明 |
| 安全漏洞审计 | ⚠️ SKIP | npm audit API 不可用 |

## Phase 4: 性能与资源

| 检查项 | 结果 | 详情 |
|--------|------|------|
| CPU 使用率 | ✅ PASS | 5% |
| 可用内存 | ✅ PASS | 5.1 GB / 6.4 GB |
| 磁盘剩余 | ✅ PASS | C: 66 GB, E: 432 GB |
| Claude Code context 膨胀 | 🔴 严重 | CLAUDE.md 341 行 + rules 167KB + commands 244KB + skills 2.5MB 每会话加载 |

## Phase 5: 仓库膨胀 (Repo Bloat)

| 问题 | 严重度 | 详情 |
|------|--------|------|
| 第三方应用捆绑 | 🔴 | `剪映_6.01 Pro_Portable/` ~30K 行第三方应用代码 |
| 子项目捆绑 | 🔴 | `open-design/apps/` daemon/web/landing-page |
| MCP 服务器捆绑 | 🔴 | `.mcp/` 完整 MCP 服务器代码 |
| 审计缓存堆积 | ⚠️ | 8 个 `express-sec-audit-*.txt` + `.express-sec-audit-cache.json` (6,442 行) |
| 报告文件 | ⚠️ | `jscpd-report.json` (12,392 行) |
| Git 未追踪文件 | ⚠️ | 60 个未追踪文件 |

---

## 优先修复建议

### 🔴 紧急 (影响执行性能)
1. ~~精简 CLAUDE.md: 从 341 行减至 ~80 行~~ ✅ **已完成** — 341→65 行
2. ~~减少 rules 加载: 按项目特征按需加载 rules~~ ✅ **已完成** — 全部移至 conditional/
3. ~~合并冗余 rules: ponytail + karpathy + codeguardian~~ ✅ **已完成** — 合并为 core-rules.md

### 🔴 仓库清理
4. **移除第三方应用**: `剪映_6.01 Pro_Portable/` 加入 .gitignore
5. **open-design 独立管理**: 作为独立仓库或 git submodule
6. **.mcp/ 独立管理**: MCP 服务器不应捆绑
7. **清除审计缓存**: `express-sec-audit-*.txt` 和 `.express-sec-audit-cache.json`

### ⚠️ 建议
8. **修复 20 个虚假导入**: import 未在 package.json 中声明
9. **增加测试覆盖**: 16 个测试文件不足
10. **评估 tailwindcss 4.x 升级**: Breaking Changes
11. **配置 knip**: 正确配置 `.knip.json` 以检测死代码
