import { describe, it, expect } from 'vitest';

// ─── Tool Registry Tests ─────────────────────────────────

describe('Tool Registry', () => {
  it('should have getToolDefs function', async () => {
    const { getToolDefs } = await import('../agent/tools.js');
    expect(typeof getToolDefs).toBe('function');
  });

  it('should return an array of tool definitions', async () => {
    const { getToolDefs } = await import('../agent/tools.js');
    const defs = getToolDefs();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('each tool should have name, description, and parameters', async () => {
    const { getToolDefs } = await import('../agent/tools.js');
    const defs = getToolDefs();
    for (const def of defs) {
      expect(def.type).toBe('function');
      expect(def.function.name).toBeTruthy();
      expect(def.function.description).toBeTruthy();
      expect(def.function.parameters).toBeTruthy();
    }
  });
});

describe('File Validation', () => {
  it('should validate supported file types', async () => {
    const { validateFileType } = await import('../services/file-analysis.js');

    // Valid types
    expect(validateFileType('application/pdf', 1024).valid).toBe(true);
    expect(validateFileType('image/png', 1024).valid).toBe(true);
    expect(validateFileType('text/plain', 1024).valid).toBe(true);

    // Invalid types
    expect(validateFileType('application/exe', 1024).valid).toBe(false);

    // Size limits
    expect(validateFileType('image/png', 33 * 1024 * 1024).valid).toBe(false); // 33MB > 32MB limit
    expect(validateFileType('application/pdf', 101 * 1024 * 1024).valid).toBe(false); // 101MB > 100MB limit
  });
});

describe('Notification Service', () => {
  it('should buffer deferred notifications', async () => {
    const { notify, getAndFlushDigest, getPendingDigestCount } = await import('../services/notifications.js');

    notify({
      userId: 'test-user',
      type: 'info',
      title: 'Test',
      body: 'Test notification',
    }, 'defer');

    expect(getPendingDigestCount('test-user')).toBe(1);

    const digest = getAndFlushDigest('test-user');
    expect(digest.length).toBe(1);
    expect(digest[0].title).toBe('Test');

    // Should be empty after flush
    expect(getPendingDigestCount('test-user')).toBe(0);
  });
});

describe('Agent Run Logging', () => {
  it('should export logging functions', async () => {
    const { logAgentAction, searchAgentRuns } = await import('../services/agent-log.js');
    expect(typeof logAgentAction).toBe('function');
    expect(typeof searchAgentRuns).toBe('function');
  });
});

describe('Workspace Service', () => {
  it('should export CRUD functions', async () => {
    const ws = await import('../services/workspace.js');
    expect(typeof ws.readWorkspaceFile).toBe('function');
    expect(typeof ws.writeWorkspaceFile).toBe('function');
    expect(typeof ws.listWorkspaceFiles).toBe('function');
    expect(typeof ws.deleteWorkspaceFile).toBe('function');
  });
});
