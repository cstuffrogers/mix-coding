# API Contract Consistency Check

## Purpose
Ensure frontend design (from Open Design) and backend API implementations are consistent.
Prevent mismatches where UI expects fields/endpoints that don't exist in the backend.

## When to Use
- After Open Design generates HTML/CSS design artifacts
- Before implementing frontend code from design mockups
- During code review to verify API alignment

## How It Works
1. **Extract frontend expectations** from Open Design output (form fields, data displays, button actions)
2. **Discover backend reality** by scanning routes/controllers/types
3. **Cross-validate** and report mismatches

## Trigger Conditions
Execute when `open_design_executed` context variable is `true`.

## Check Items

### 1. Field Existence Check
| Priority | Condition |
|----------|-----------|
| CRITICAL | UI form field has no corresponding backend model field |
| HIGH | Backend field exists but UI doesn't display it |
| MEDIUM | Field types mismatch (e.g. UI expects `number`, backend returns `string`) |

### 2. Endpoint Existence Check
| Priority | Condition |
|----------|-----------|
| CRITICAL | UI button action calls API endpoint that doesn't exist |
| HIGH | UI uses GET where backend expects POST |
| MEDIUM | Missing error handling states in UI |

### 3. Data Shape Check
| Priority | Condition |
|----------|-----------|
| CRITICAL | UI expects nested object, backend returns flat array |
| HIGH | UI list items don't match backend response structure |
| MEDIUM | Pagination params inconsistent |

### 4. State Management Check
| Priority | Condition |
|----------|-----------|
| HIGH | UI loading/empty/error states not handled |
| MEDIUM | Success/failure feedback missing |

## Output Format
```markdown
## API Contract Consistency Report

### CRITICAL (must fix before merge)
| # | UI Element | Expected | Backend Actual | Fix |
|---|-----------|----------|----------------|-----|
| 1 | Login form `email` field | POST /api/auth | No such endpoint | Create /api/auth route |

### HIGH (should fix)
...

### MEDIUM (nice to have)
...

### Summary
- Total checks: N
- Passed: N
- CRITICAL: N
- HIGH: N
- MEDIUM: N
- Consistency Score: X/100
```

## Integration Points
- `new-project.json` Step 5.0 (after Open Design, before review)
- `feature.json` Step 4.1 (after design-editor)
- `design.yaml` design-verify step
- `new-project.yaml` Phase 5.1
- `feature.yaml` design-editor depends_on chain
