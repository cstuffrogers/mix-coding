# 通用编码规范

## 命名
- 变量/函数：camelCase
- 类/接口/类型：PascalCase
- 常量：UPPER_SNAKE_CASE
- 文件：kebab-case

## 文件组织
- 一个文件一个主要导出
- 相关功能放同一目录
- 测试文件与源文件同目录，后缀 .test.ts/.spec.ts

## 注释
- 公共 API 必须有 JSDoc
- 复杂逻辑必须有行内注释
- 不注释显而易见的代码
