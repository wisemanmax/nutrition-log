import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudSync } from '../utils/sync';

// Mock storage to avoid localStorage dependency
vi.mock('../utils/storage', () => ({
  LS: {
    get: vi.fn((k: string) => {
      const store: Record<string, unknown> = {
        'ft-session-email': 'test@example.com',
        'ft-session-token': 'mock-token-123',
        'ft-device-id': 'test-device',
        'nl-sync-queue': null,
      };
      return store[k] ?? null;
    }),
    set: vi.fn(),
  },
}));

describe('CloudSync._pushOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when offline (fetch throws)', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as unknown as typeof fetch;
    const result = await CloudSync._pushOnce({ nutrition: [], body: [] });
    expect(result).toBe(false);
  });

  it('returns true on successful push', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as unknown as typeof fetch;
    const result = await CloudSync._pushOnce({ nutrition: [], body: [], goals: { cal: 2400, protein: 180, carbs: 250, fat: 70, fiber: 25, water: 8 } });
    expect(result).toBe(true);
  });

  it('returns false on 4xx response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 401 })) as unknown as typeof fetch;
    const result = await CloudSync._pushOnce({ nutrition: [] });
    expect(result).toBe(false);
  });
});

describe('CloudSync.debouncedPush', () => {
  it('does not throw when called', () => {
    expect(() => CloudSync.debouncedPush({ nutrition: [] })).not.toThrow();
  });
});
