# /release — 发布部署

## 触发方式
```
> /release
```

## 执行流程
1. 拉取最新代码
2. 发布前质量门禁（lint + typecheck + test + coverage + security）
3. 测试覆盖率门禁（>=85%）
4. 从Conventional Commits生成CHANGELOG
5. 选择版本升级类型（major/minor/patch）
6. 自动更新版本号
7. 生产构建
8. 冒烟测试验证构建产物
9. 创建Git版本标签
10. 执行部署
11. 部署后健康检查
12. 创建GitHub Release
13. 成本报告
14. 通知完成

## 说明
端到端发布部署流程，所有检查通过后才允许发布。任一质量门禁失败都会阻断。
