import { LS } from './storage';
import { AuthToken } from './auth';

export const SYNC_URL = LS.get("ft-api-url") || "https://api.ironlog.space";
export const APP_VERSION = "nutritionlog-1.0";

export let syncTimer = null;
export let syncInFlight = false;

// --- Cloud Sync ---
export const CloudSync = {
  push: async (state) => {
    if (syncInFlight) return;
    const email = LS.get("ft-session-email");
    const token = LS.get("ft-session-token");
    if (!email || !token) return;
    syncInFlight = true;
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
      await fetch(`${SYNC_URL}/api/sync/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: payload,
      });
    } catch (e) {} finally { syncInFlight = false; }
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
      });
      return await res.json();
    } catch (e) { return null; }
  },
};
