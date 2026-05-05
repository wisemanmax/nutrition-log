// Feature flags — can be overridden by a remote config row in Supabase later
const DEFAULT_FLAGS = {
  barcodeScanning: true,
  aiCoach: false,           // Q3 — requires Claude API key
  photoRecognition: false,  // Q3 — requires Claude Vision
  appleHealth: false,       // Q3 — Capacitor HealthKit
  premiumTier: true,        // Q3 — UI gate enabled
  recipeUrlImport: true,    // Q2 — client-side Schema.org parser
  voiceLog: true,           // Q2 — Web Speech API
  ouraIntegration: false,   // Q3 — OAuth
  restaurantDb: false,      // Q4 — Nutritionix API
  mealPlanning: true,       // Q4 — client-side planner
};

let _flags = { ...DEFAULT_FLAGS };

export const Flags = {
  // Get all flags (merged with any runtime overrides)
  all: () => ({ ..._flags }),

  // Check a single flag
  get: (name) => _flags[name] ?? false,

  // Override at runtime (e.g. from a remote config fetch)
  override: (overrides) => {
    _flags = { ..._flags, ...overrides };
  },

  // Load remote flags from a URL (fire-and-forget, best-effort)
  loadRemote: async (url) => {
    if (!url) return;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const remote = await res.json();
      Flags.override(remote);
    } catch { /* network failure is fine — use defaults */ }
  },
};
