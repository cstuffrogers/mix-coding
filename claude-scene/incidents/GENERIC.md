# GENERIC — Incident Runbook

<!-- runme -->
<!-- {"runme":{"id":"unknown/GENERIC.md"}} -->

## Service: unknown/GENERIC.md
**Port**: 3000
**Endpoint**: `http://localhost:3000/GENERIC`

---

## 1. Health Check

```sh {"id":"01J0000000000","name":"health-check"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/GENERIC
```

```sh {"id":"01J0000000001","name":"health-check-verbose"}
curl -v http://localhost:3000/GENERIC 2>&1 | head -20
```

## 2. Common Issues

### 2.1 服务无响应
- 检查进程：`ps aux | grep node` (or `tasklist | findstr node`)
- 检查端口占用：`lsof -i :3000` (or `netstat -ano | findstr :3000`)
- 查看最近日志

### 2.2 5xx 错误
- 检查应用日志：`tail -f logs/app.log` or `pm2 logs`
- 检查数据库连接：确认 `DATABASE_URL` 正确
- 检查外部 API 可达性

### 2.3 性能下降
- 检查 CPU/内存使用率
- 检查慢查询日志
- 检查并发连接数

## 3. Escalation

| 严重度 | 响应时间 | 联系人 |
|--------|---------|--------|
| P0 — 全站不可用 | 15 min | On-call Engineer |
| P1 — 核心功能故障 | 30 min | Team Lead |
| P2 — 部分用户受影响 | 2 hours | Developer |
| P3 — 非关键问题 | Next business day | Backlog |

## 4. Logs

```sh {"id":"01J0000000002","name":"tail-logs"}
tail -100 logs/app.log 2>/dev/null || echo "No log file found"
```

## 5. Rollback

If this endpoint fails after deployment:

```sh {"id":"01J0000000003","name":"rollback"}
git log --oneline -5
# git revert <commit-hash>
```
