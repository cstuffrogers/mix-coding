import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { homedir } from 'os';

// claude-scene/src/lib/ → up 3 = auto-coding/
export const PROJECT_ROOT = join(__dirname, '..', '..', '..');
export const SCENES_DIR = join(PROJECT_ROOT, '.claude', 'scenes');
export const MEMORY_DIR = join(PROJECT_ROOT, '.claude', 'memory');

// 4 memory backends
export const CLAUDE_MEM_DIR = join(homedir(), '.claude', 'memory');
export const AGENTMEMORY_DIR = join(homedir(), '.agentmemory');
export const NEXO_DIR = join(homedir(), '.nexo');
export const CODEGRAPH_DB = join(PROJECT_ROOT, '.codegraph', 'codegraph.db');
