import { LS } from './storage';
import { AuthToken } from './auth';

export const SYNC_URL = LS.get("ft-api-url") || "https://api.ironlog.space";
export const APP_VERSION = "nutritionlog-1.0";

export let syncTimer = null;
export let syncInFlight = false;

// ─── Offline queue ────────────────────────────────────────────────────────────
// Queues sync operations when offline. Replays them when connectivity restores.
const QUEUE_KEY = 'nl-sync-queue';

const OfflineQueue = {
  _pending: null,

  load() {
    if (!this._pending) this._pending = LS.get(QUEUE_KEY) || [];
    return this._pending;
  },

  // Enqueue a state snapshot (we only keep the latest — older ones are stale)
  enqueue(state) {
    this._pending = [{ ts: Date.now(), state }];
    LS.set(QUEUE_KEY, this._pending);
  },

  clear() {
    this._pending = [];
    LS.set(QUEUE_KEY, []);
  },

  hasPending() {
    return this.load().length > 0;
  },

  // Attempt to drain the queue. Returns true if successful.
  async drain() {
    const items = this.load();
    if (!items.length) return true;
    const latest = items[items.length - 1];
    const ok = await CloudSync._pushOnce(latest.state);
    if (ok) this.clear();
    return ok;
  },
};

// Listen for online events to replay queued syncs
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (OfflineQueue.hasPending()) {
      OfflineQueue.drain();
    }
  });
}

// ─── Cloud Sync ───────────────────────────────────────────────────────────────
export const CloudSync = {
  _pushOnce: async (state) => {
    const email = LS.get("ft-session-email");
    const token = LS.get("ft-session-token");
    if (!email || !token) return false;
    try {
      const payload = JSON.stringify({
        email,
        deviceId: LS.get("ft-device-id") || "unknown",
        appVersion: APP_VERSION,
        app: "nutritionlog",
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
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  push: async (state) => {
    if (syncInFlight) return;
    syncInFlight = true;
    try {
      if (!navigator.onLine) {
        OfflineQueue.enqueue(state);
        return;
      }
      const ok = await CloudSync._pushOnce(state);
      if (!ok) {
        // Network failure even though online — queue for retry
        OfflineQueue.enqueue(state);
      } else {
        OfflineQueue.clear();
      }
    } finally {
      syncInFlight = false;
    }
  },

  debouncedPush: (() => {
    let t = null;
    return (state) => { clearTimeout(t); t = setTimeout(() => CloudSync.push(state), 5000); };
  })(),

  pull: async (email, deviceId, pin) => {
    try {
      const headers = { "Content-Type": "application/json" };
      const token = LS.get("ft-session-token");
      if (token) headers["X-Session-Token"] = token;
      const res = await fetch(`${SYNC_URL}/api/sync/pull`, {
        method: "POST", headers,
        body: JSON.stringify({ email: email.toLowerCase(), deviceId, pin, app: "nutritionlog" }),
        signal: AbortSignal.timeout(8000),
      });
      return await res.json();
    } catch (e) { return null; }
  },
};
