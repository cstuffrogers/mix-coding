---
description: Review database migration files for dangerous operations
argument-hint: "[path]"
---

# /migration — Database Migration Review

**Input**: $ARGUMENTS

---

## Your Mission

Review database migration files for dangerous SQL patterns that could cause data loss, table locks, or breaking changes.

---

## Execution Steps

### Step 1: Identify migration files

Scan common migration directories: `migrations/`, `prisma/`, `drizzle/`, `supabase/migrations/`

### Step 2: Run analysis

```bash
cd e:/auto-coding/claude-scene

node -e "
const { handleMigrationReview } = require('./src/handlers/migration.js');
const result = handleMigrationReview('migration-review', {}, process.cwd(), {});
console.log(result);
"
```

### Step 3: Review findings

- **CRITICAL**: DROP TABLE, TRUNCATE, NOT NULL without DEFAULT — must be fixed before proceeding
- **HIGH**: DROP COLUMN, type changes — requires review
- **MEDIUM**: RENAME COLUMN, ADD FOREIGN KEY — document and verify

### Step 4: Apply fixes

For fixable issues, suggest safer alternatives:
- `ADD COLUMN NOT NULL` → `ADD COLUMN` + `DEFAULT` or split into multiple steps
- `DROP TABLE` → rename to `_deprecated_<name>` first, then drop after validation period
- Type changes → use `ALTER COLUMN TYPE ... USING` with explicit cast

---

## Output

Results displayed in console. HIGH/CRITICAL findings block CI/CD gates.

**Installs**: Optionally uses `db-scalability-guardian` (npm) for enhanced analysis. Falls back to built-in pattern scanning if not installed.
