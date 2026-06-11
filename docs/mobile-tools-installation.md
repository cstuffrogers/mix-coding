# 移动端工作流 — 工具安装状态

> 日期: 2026-06-11 | 机器: Windows 10 Pro

## 已安装 ✅

| 工具 | 版本 | 用途 | 工作流 |
|------|------|------|--------|
| **Bearer CLI** | 1.13.9 | PII/GDPR 隐私合规扫描 | mobile-audit |
| **Detox CLI** | 20.51.3 | React Native E2E 测试 | mobile-e2e, mobile-review |
| **react-native-community/cli** | 20.1.3 | `npx react-native doctor` 环境检查 | mobile-onboard |
| **react-native-bundle-visualizer** | 4.0.0 | JS Bundle 树图分析 | mobile-optimize |
| **DependencyCheck** | 11.1.1 | CVE 依赖漏洞扫描 | mobile-audit |
| **Java JDK** | 21.0.10 | DependencyCheck 运行时 | mobile-audit |

## 安装中 ⏳

| 工具 | 方式 | 用途 | 工作流 |
|------|------|------|--------|
| **mobsfscan** | `pip install` | 源码级 SAST（硬编码密钥/不安全存储/弱加密） | mobile-audit, mobile-review |

## 需要手动启动

| 工具 | 原因 | 操作 |
|------|------|------|
| **MobSF** (Docker) | Docker Desktop 未运行 | 启动 Docker Desktop → `docker pull opensecurity/mobile-security-framework-mobsf:latest` |
| **Maestro** | Windows 不支持原生安装 | WSL 中: `curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| **Toxiproxy** | Go 网络受限 | `go install github.com/Shopify/toxiproxy/v2/cmd/toxiproxy@latest` |

## macOS 专属（Windows 上不可用）

| 工具 | 用途 | 说明 |
|------|------|------|
| **fastlane** | iOS/Android 自动构建签名发布 | Ruby gem，macOS 必需 |
| **CocoaPods** | iOS 依赖管理 | macOS 必需 |
| **Shorebird CLI** | Flutter/RN OTA 热更新 | 需要 Flutter/Dart SDK |

## 已创建的 MCP Server 定义

| MCP Server | 后端工具 | 接入方式 |
|-----------|---------|---------|
| `MobSFMCP` | MobSF REST API | `curl -F "file=@app.apk" $MOBSF_URL/api/v1/upload` |
| `MaestroMCP` | Maestro CLI | `maestro test <flow.yaml>` |
| `DetoxMCP` | Detox CLI | `detox test --configuration ios` |
| `BearerMCP` | Bearer CLI | `bearer scan .` |
| `ToxiproxyMCP` | Toxiproxy | `toxiproxy-cli create <name> -l <listen> -u <upstream>` |

## 一键安装

```bash
# 所有平台通用
bash tools/install-mobile-tools.sh
```

## MCP 配置（.mcp.json）

Windows 用户当前可用：

```json
{
  "mcpServers": {
    "bearer": {
      "command": "bearer",
      "args": ["scan", "."]
    },
    "detox": {
      "command": "detox",
      "args": ["test"]
    },
    "mobsfscan": {
      "command": "mobsfscan",
      "args": ["--json"]
    }
  }
}
```

macOS 用户额外可用：

```json
{
  "mcpServers": {
    "maestro": { "command": "maestro", "args": ["test"] },
    "fastlane": { "command": "fastlane", "args": ["ios", "beta"] }
  }
}
```
