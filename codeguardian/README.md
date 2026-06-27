# CodeGuardian

AI Code Optimization Guardian — Prevent over-optimization and negative optimization in AI-assisted code refactoring.

## Core Principles

- **Single optimization** per file — no automatic loops
- **Hard physical boundaries** — max lines delta, max dependencies, max complexity
- **Auto-verification** — tests, benchmarks, quality metrics
- **Fail-to-rollback** — any check failure restores original code
- **Human gating** — approve/reject required after auto checks pass
- **No auto-merge** — human must explicitly approve

## Installation

```bash
pip install -e .
```

## Usage

### CLI

```bash
cg init .                    # Initialize config
cg optimize orig.py opt.py   # Validate optimization
cg status <request_id>       # Check status
cg approve <request_id>      # Human approval
cg reject <request_id>       # Reject and restore
cg history                   # View history
cg config                    # View configuration
```

### MCP Server

```bash
python -m codeguardian.mcp.server
```

## Configuration

See `.codeguardian.yaml` or environment variables (`CG_*` prefix).
