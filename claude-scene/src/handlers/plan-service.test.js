/**
 * Tests for PlanService handlers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  handleSessionCatchup,
  handleInitPlanningFiles,
  handleReadSpec,
  handleCreatePlan,
  handleCreateFindings,
  handleCreateProgress,
  handleDisplaySummary,
  handleUpdatePhaseStatus,
  handleLogError,
  handleAppendProgress,
} from './plan-service.js';

const TEMP_DIR = join(process.cwd(), '.test-temp-plan-service');

describe('PlanService handlers', () => {
  beforeEach(() => {
    if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true });
  });

  describe('handleInitPlanningFiles', () => {
    it('should create planning files from templates', () => {
      // Create templates
      mkdirSync(join(TEMP_DIR, '.claude/templates'), { recursive: true });
      writeFileSync(join(TEMP_DIR, '.claude/templates/plan.md'), '# Plan Template');

      const result = handleInitPlanningFiles('initPlanningFiles', {
        files: ['plan.md'],
        templates_dir: '.claude/templates'
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      expect(existsSync(join(TEMP_DIR, 'plan.md'))).toBe(true);
      expect(readFileSync(join(TEMP_DIR, 'plan.md'), 'utf-8')).toContain('Plan Template');
    });

    it('should not overwrite existing files', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), 'Existing content');

      const result = handleInitPlanningFiles('initPlanningFiles', {
        files: ['plan.md']
      }, TEMP_DIR);

      expect(result.results[0].status).toBe('exists');
      expect(readFileSync(join(TEMP_DIR, 'plan.md'), 'utf-8')).toBe('Existing content');
    });

    it('should create minimal file if template not found', () => {
      const result = handleInitPlanningFiles('initPlanningFiles', {
        files: ['findings.md']
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      expect(existsSync(join(TEMP_DIR, 'findings.md'))).toBe(true);
    });
  });

  describe('handleReadSpec', () => {
    it('should return not_found if spec.md missing', () => {
      const result = handleReadSpec('readSpec', {}, TEMP_DIR);
      expect(result.status).toBe('not_found');
    });

    it('should read spec.md content', () => {
      writeFileSync(join(TEMP_DIR, 'spec.md'), '# Feature Spec\n\n## Goal\nCreate a CLI tool');

      const result = handleReadSpec('readSpec', {}, TEMP_DIR);

      expect(result.status).toBe('success');
      expect(result.goal).toBe('Create a CLI tool');
      expect(result.title).toBe('Feature Spec');
    });
  });

  describe('handleCreatePlan', () => {
    it('should create plan.md from template', () => {
      mkdirSync(join(TEMP_DIR, '.claude/templates'), { recursive: true });
      writeFileSync(join(TEMP_DIR, '.claude/templates/plan.md'), '# Template Plan');

      const result = handleCreatePlan('createPlan', {}, TEMP_DIR);

      expect(result.status).toBe('created');
      expect(existsSync(join(TEMP_DIR, 'plan.md'))).toBe(true);
    });

    it('should return exists if plan.md already exists', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), 'Existing');

      const result = handleCreatePlan('createPlan', {}, TEMP_DIR);

      expect(result.status).toBe('exists');
    });
  });

  describe('handleDisplaySummary', () => {
    it('should return default summary', () => {
      const result = handleDisplaySummary('displaySummary', {}, TEMP_DIR);

      expect(result.status).toBe('success');
      expect(result.message).toContain('plan.md');
      expect(result.message).toContain('2-Action Rule');
    });

    it('should use custom message', () => {
      const result = handleDisplaySummary('displaySummary', {
        message: 'Custom summary'
      }, TEMP_DIR);

      expect(result.message).toBe('Custom summary');
    });
  });

  describe('handleUpdatePhaseStatus', () => {
    it('should update phase status in plan.md', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), `# Plan

### Phase 1: Setup
- [ ] Task
- **Status:** in_progress
`);

      const result = handleUpdatePhaseStatus('updatePhaseStatus', {
        phase: 1,
        status: 'complete'
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      expect(result.newStatus).toBe('complete');
      expect(readFileSync(join(TEMP_DIR, 'plan.md'), 'utf-8')).toContain('**Status:** complete');
    });

    it('should return error if phase not found', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), '# Plan without phases');

      const result = handleUpdatePhaseStatus('updatePhaseStatus', {
        phase: 1,
        status: 'complete'
      }, TEMP_DIR);

      expect(result.status).toBe('error');
    });
  });

  describe('handleLogError', () => {
    it('should append error to plan.md', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), `
## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |
`);

      const result = handleLogError('logError', {
        error: 'TypeError',
        attempt: 2,
        resolution: 'Fixed type'
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      const content = readFileSync(join(TEMP_DIR, 'plan.md'), 'utf-8');
      expect(content).toContain('TypeError');
      expect(content).toContain('Fixed type');
    });

    it('should add Errors section if not exists', () => {
      writeFileSync(join(TEMP_DIR, 'plan.md'), '# Plan without errors section');

      const result = handleLogError('logError', {
        error: 'TestError'
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      const content = readFileSync(join(TEMP_DIR, 'plan.md'), 'utf-8');
      expect(content).toContain('Errors Encountered');
    });
  });

  describe('handleAppendProgress', () => {
    it('should append entry to progress.md', () => {
      writeFileSync(join(TEMP_DIR, 'progress.md'), `
## Progress Log

### 2026-01-01 — Start
- Action: Init

## Session End
`);

      const result = handleAppendProgress('appendProgress', {
        action: 'Build',
        result: 'Success',
        files: ['src/index.js']
      }, TEMP_DIR);

      expect(result.status).toBe('success');
      const content = readFileSync(join(TEMP_DIR, 'progress.md'), 'utf-8');
      expect(content).toContain('Build');
      expect(content).toContain('src/index.js');
    });

    it('should return error if progress.md missing', () => {
      const result = handleAppendProgress('appendProgress', {
        action: 'Test'
      }, TEMP_DIR);

      expect(result.status).toBe('error');
    });
  });

  describe('handleSessionCatchup', () => {
    it('should skip if script not found', () => {
      const result = handleSessionCatchup('sessionCatchup', {}, TEMP_DIR);
      expect(result.status).toBe('skipped');
    });
  });

  describe('handleCreateFindings', () => {
    it('should create findings.md', () => {
      const result = handleCreateFindings('createFindings', {}, TEMP_DIR);
      expect(result.status).toBe('created');
      expect(existsSync(join(TEMP_DIR, 'findings.md'))).toBe(true);
    });
  });

  describe('handleCreateProgress', () => {
    it('should create progress.md with timestamp', () => {
      const result = handleCreateProgress('createProgress', {}, TEMP_DIR);

      expect(result.status).toBe('created');
      const content = readFileSync(join(TEMP_DIR, 'progress.md'), 'utf-8');
      expect(content).toContain('Started:');
      expect(content).toContain('Session Start');
    });
  });
});