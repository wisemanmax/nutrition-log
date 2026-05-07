import { LS } from './storage';
import type { AppState } from '../types';

export const SYNC_URL: string = (LS.get<string>('ft-api-url')) || 'https://api.ironlog.space';
export const APP_VERSION = 'nutritionlog-1.0';

export let syncInFlight = false;

// ─── Offline queue ────────────────────────────────────────────────────────────

interface QueueEntry { ts: number; state: Partial<AppState> }
const QUEUE_KEY = 'nl-sync-queue';

const OfflineQueue = {
  _pending: null as QueueEntry[] | null,

  load(): QueueEntry[] {
    if (!this._pending) this._pending = LS.get<QueueEntry[]>(QUEUE_KEY) || [];
    return this._pending!;
  },

  enqueue(state: Partial<AppState>): void {
    this._pending = [{ ts: Date.now(), state }];
    LS.set(QUEUE_KEY, this._pending);
  },

  clear(): void {
    this._pending = [];
    LS.set(QUEUE_KEY, []);
  },

  hasPending(): boolean {
    return this.load().length > 0;
  },

  async drain(): Promise<boolean> {
    const items = this.load();
    if (!items.length) return true;
    const latest = items[items.length - 1];
    const ok = await CloudSync._pushOnce(latest.state);
    if (ok) this.clear();
    return ok;
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (OfflineQueue.hasPending()) OfflineQueue.drain();
  });
}

// ─── Cloud Sync ───────────────────────────────────────────────────────────────

export const CloudSync = {
  _pushOnce: async (state: Partial<AppState>): Promise<boolean> => {
    const email = LS.get<string>('ft-session-email');
    const token = LS.get<string>('ft-session-token');
    if (!email || !token) return false;
    try {
      const payload = JSON.stringify({
        email,
        deviceId: LS.get('ft-device-id') || 'unknown',
        appVersion: APP_VERSION,
        app: 'nutritionlog',
        workouts: [],
        nutrition: state.nutrition || [],
        body: state.body || [],
        photos: [],
        checkins: [],
        milestones: [],
        settings: {
          goals: state.goals,
          units: state.units,
          schedule: null,
          exercises: null,
          phases: [],
          injuries: [],
          privacy: {},
          supplements: [],
          accountability: [],
          gamification: null,
        },
      });
      const res = await fetch(`${SYNC_URL}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch { return false; }
  },

  push: async (state: Partial<AppState>): Promise<void> => {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
      if (!navigator.onLine) {
        OfflineQueue.enqueue(state);
        return;
      }
      const ok = await CloudSync._pushOnce(state);
      if (!ok) {
        OfflineQueue.enqueue(state);
      } else {
        OfflineQueue.clear();
      }
    } finally {
      syncInFlight = false;
    }
  },

  debouncedPush: (() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (state: Partial<AppState>): void => {
      if (t) clearTimeout(t);
      t = setTimeout(() => CloudSync.push(state), 5000);
    };
  })(),

  pull: async (email: string, deviceId: string, pin: string): Promise<unknown> => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = LS.get<string>('ft-session-token');
      if (token) headers['X-Session-Token'] = token;
      const res = await fetch(`${SYNC_URL}/api/sync/pull`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: email.toLowerCase(), deviceId, pin, app: 'nutritionlog' }),
        signal: AbortSignal.timeout(8000),
      });
      return await res.json();
    } catch { return null; }
  },
};
