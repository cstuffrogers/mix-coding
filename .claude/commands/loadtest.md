---
description: Run load/performance tests with Artillery
argument-hint: "[smoke|load|stress]"
---

# /loadtest — Load & Performance Testing

**Input**: $ARGUMENTS

---

## Your Mission

Run load tests using Artillery. Defaults to `smoke` mode for quick PR validation.

---

## Execution Steps

### Step 1: Detect mode

From `$ARGUMENTS`, default to `smoke`. Valid modes:
- `smoke` — light test (1-5 VUs, 30s), for PR validation
- `load` — standard load (50+ VUs, 5min), for release gates
- `stress` — peak load (100+ VUs, 10min), for capacity planning

### Step 2: Start background server

```bash
cd <target-project>
npm start &
sleep 10
```

### Step 3: Run load test

```bash
cd e:/auto-coding/claude-scene

node -e "
const { handleLoadTest } = require('./src/handlers/testing.js');
const result = handleLoadTest('load-test', { mode: '$ARGUMENTS' || 'smoke' }, process.cwd(), {});
console.log(result);
"
```

### Step 4: Evaluate results

- If any scenario fails thresholds → report failure
- Capture p50/p95/p99 latency metrics
- Output Artillery report JSON

---

## Setup

Create test configs in `tests/load/` directory:

```yaml
# tests/load/smoke.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 30
      arrivalRate: 5
  ensure:
    p95: 500
    maxErrorRate: 1

scenarios:
  - name: 'Health check'
    flow:
      - get:
          url: '/api/health'
```

---

## Output

Test results shown in console. Failed tests block CI/CD gates via exit code.
