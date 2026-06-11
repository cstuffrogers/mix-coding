import { existsSync, mkdirSync } from 'fs';

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
