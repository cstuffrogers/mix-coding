# 安全测试用例文件夹

## 📋 文件说明
- `sql-injection.js` - 包含SQL注入漏洞 (置信度低于0.85，会报告但不会阻断)
- `xss-vulnerability.js` - 包含XSS跨站脚本攻击漏洞 (置信度>=0.9，会触发阻断)
- `command-injection.js` - 包含命令注入漏洞 (置信度>=0.95，会触发阻断)
- `safe-code.js` - 无漏洞的安全代码 (会顺利通过扫描)

## 🎯 使用方法
1. 将整个 `test-security-files/` 目录提交到代码库
2. 等待 review.json 工作流自动触发
3. 查看 anthropic-cybersecurity-skills 的扫描结果

## 🔍 预期行为
- XSS和命令注入文件将触发 **BLOCK-MERGE**（高置信度扫描）
- SQL注入文件会报告漏洞但**不会阻断**（低置信度<0.85）
- safe-code.js文件将顺利通过扫描

## ✅ 验证标准
- 如在日志中看到 "发现XSS漏洞" 但Merge被阻断 → **设置成功**
- 如看到安全代码通过扫描 → **设置成功**
- 扫描结果应包含漏洞类型、置信度、代码位置
        