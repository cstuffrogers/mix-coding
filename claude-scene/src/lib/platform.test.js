import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getHostPlatform, isConversationMode, getPlatformDir } from './platform.js';

/** Keys that the platform module checks. */
const PLATFORM_KEYS = ['CLAUDECODE', 'OPENCODE', 'CODEX', 'AI_AGENT', 'ZCODE_APP_VERSION', 'PI_PACKAGE_DIR'];

/** Snapshot the current env values for platform keys. */
let envSnapshot;
beforeAll(() => {
  envSnapshot = Object.fromEntries(PLATFORM_KEYS.map((k) => [k, process.env[k]]));
});

afterAll(() => {
  for (const k of PLATFORM_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k];
    else process.env[k] = envSnapshot[k];
  }
});

/** Clear every platform marker before each test. */
function clearHostEnv() {
  for (const k of PLATFORM_KEYS) delete process.env[k];
}

describe('platform detection', () => {
  it('detects pi CLI via AI_AGENT=pi', () => {
    clearHostEnv();
    process.env.AI_AGENT = 'pi';
    expect(getHostPlatform()).toBe('pi');
    expect(isConversationMode()).toBe(true);
    expect(getPlatformDir()).toBe('.pi');
  });

  it('detects percho via PI_PACKAGE_DIR', () => {
    clearHostEnv();
    process.env.PI_PACKAGE_DIR = '/opt/percho/pi-package';
    expect(getHostPlatform()).toBe('pi');
    expect(isConversationMode()).toBe(true);
    expect(getPlatformDir()).toBe('.pi');
  });

  it('maps both pi markers to the same platform', () => {
    clearHostEnv();
    process.env.AI_AGENT = 'pi';
    process.env.PI_PACKAGE_DIR = '/other/path';
    expect(getHostPlatform()).toBe('pi');
  });

  it('falls back to cli without host markers', () => {
    clearHostEnv();
    expect(getHostPlatform()).toBe('cli');
    expect(isConversationMode()).toBe(false);
    expect(getPlatformDir()).toBe('.claude');
  });

  it('returns zcode when ZCODE_APP_VERSION present', () => {
    clearHostEnv();
    process.env.ZCODE_APP_VERSION = '3.2.1';
    expect(getHostPlatform()).toBe('zcode');
    expect(getPlatformDir()).toBe('.zcode');
  });
});
