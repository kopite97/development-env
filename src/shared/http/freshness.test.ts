import { describe, expect, it, vi } from 'vitest';
import { CancelledError, Lifecycle } from './client';
import { compareRevisions, Freshness } from './freshness';

describe('session freshness observations', () => {
  it('compares revisions without floating point truncation', () => {
    expect(compareRevisions('90071992547409931234', '90071992547409931233')).toBeGreaterThan(0);
    expect(compareRevisions('10', '9')).toBeGreaterThan(0);
  });
  it('coalesces old dependencies without invalidating the successful read itself', async () => {
    vi.useFakeTimers();
    try {
      const stale = vi.fn();
      const tracker = new Freshness(new Lifecycle(), stale);
      tracker.observe('projects', { generation: 0, workspaceRevision: '2' });
      tracker.observe('tasks', { generation: 0, workspaceRevision: '2' });
      tracker.observe('categories', { generation: 0, workspaceRevision: '3' });
      tracker.observe('categories', { generation: 0, workspaceRevision: '3' });
      expect(stale).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      expect(stale).toHaveBeenCalledExactlyOnceWith(['projects', 'tasks']);
      expect(tracker.observe('categories', { generation: 0, workspaceRevision: '2' })).toBe(false);
      tracker.observe('categories', { generation: 0 });
      await vi.runAllTimersAsync();
      expect(stale).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('cancels queued work and rejects observations after a session boundary', async () => {
    vi.useFakeTimers();
    try {
      const lifecycle = new Lifecycle();
      const stale = vi.fn();
      const tracker = new Freshness(lifecycle, stale);
      tracker.observe('a', { generation: 0, workspaceRevision: '1' });
      tracker.observe('b', { generation: 0, workspaceRevision: '2' });
      lifecycle.reset();
      await vi.runAllTimersAsync();
      expect(stale).not.toHaveBeenCalled();
      expect(() => tracker.observe('c', { generation: 0 })).toThrow(CancelledError);
    } finally {
      vi.useRealTimers();
    }
  });
});
