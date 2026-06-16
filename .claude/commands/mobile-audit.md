---
description: Mobile full-dimension audit: MobSF security scan + OWASP MASVS mapping + privacy compliance + dependency CVE + performance baseline + store compliance. 24-step all-in-one mobile health check.
argument-hint: "[项目路径]"
---

# /mobile-audit — 移动端全维度审计

24 步混合工作流：**Pre-flight 审查清单（对话模式）→ 上下文收集 → 安全扫描 → MASVS 对照 → 隐私合规 → 性能基线 → 商店合规**

## Usage

```text
/mobile-audit                      # 审计当前目录移动端项目
/mobile-audit E:\my-rn-app          # 审计指定路径项目
```

## 执行流程

### Phase 0: Pre-flight 准备（对话模式）

1. **Skill("review-checklist")** (`step 0.3`) — 加载 23 项审查清单，聚焦移动端安全/存储/加密/网络项
2. **recall** (`step 0.5`) — 注入历史移动端审计记录和已知漏洞

### Phase 1: 上下文收集（对话模式）

3. **GitHub MCP** (`step 1`) — 列出安全相关 issues
4. **Context7 MCP** (`step 2`) — 获取 OWASP MASVS 最新标准文档

### Phase 2: 安全扫描

- **mobsfScan** (`step 3`) — APK/IPA 静态分析 + 源码级 SAST
- **mobsfscanSAST** (`step 4`) — 硬编码密钥/不安全存储/弱加密/SSL Pinning
- **masvsMap** (`step 5`) — OWASP MASVS L1/L2 安全等级对照

### Phase 3: 隐私 + 依赖

- **privacyScan** (`step 6`) — Bearer CLI PII 泄露 / GDPR 合规
- **dependencyCheck** (`step 7`) — 第三方库 CVE 扫描

### Phase 4: 性能基线

- **mobilePerf** (`step 8`) — 包体积/启动时间/FPS/内存/网络/电池 首次测量
- **performanceBaseline** (`step 9`) — 建立性能基线

### Phase 5: 商店合规

- **storeCompliance** (`step 10`) — Apple/Google/微信 隐私标签/权限/截图

### Phase 6: 沉淀

- **ce-compound** (`step 11`) — 移动端安全审计知识沉淀
- **remember** → **consolidate** → **notify**

### 工具链覆盖

| 阶段 | 工具 | 类型 |
|------|------|------|
| 审查清单 | review-checklist Skill（23 项） | Skill |
| 上下文 | GitHub MCP + Context7 MCP | MCP |
| 安全扫描 | MobSF + mobsfscan + OWASP MASVS | CLI |
| 隐私 | Bearer CLI | CLI |
| 依赖 | DependencyCheck | CLI |
| 性能 | mobilePerf（包体积/启动/FPS/内存） | CLI |

### CLI 模式回退

在 CLI 模式（非对话）下，`Skill("review-checklist")` 和 MCP 步骤自动跳过。安全扫描、隐私合规和性能测量步骤正常执行。
