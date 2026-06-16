## API 一致性检查报告

**检查时间**: 2026-06-16T02:34:31.332Z
**状态**: 跳过

**原因**: 未找到 OpenAPI 规范文件。

### 🔧 如何添加 OpenAPI 规范

检测到项目包含后端代码，推荐以下方式生成规范：

| 后端框架 | 工具 | 命令 |
|---------|------|------|
| Express | swagger-jsdoc / tsoa | `npm install swagger-jsdoc` |
| NestJS | @nestjs/swagger | `npm install @nestjs/swagger` |
| Fastify | @fastify/swagger | `npm install @fastify/swagger` |
| Hono | @hono/zod-openapi | `npm install @hono/zod-openapi` |
| Elysia | @elysiajs/swagger | `npm install @elysiajs/swagger` |
| 通用 | zod-to-openapi | `npm install @asteasolutions/zod-to-openapi` |
