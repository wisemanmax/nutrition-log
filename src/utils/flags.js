// Feature flags — can be overridden by a remote config row in Supabase later
const DEFAULT_FLAGS = {
  barcodeScanning: true,
  aiCoach: false,        // Q3
  photoRecognition: false, // Q3
  appleHealth: false,    // Q3
  premiumTier: false,    // Q3
  recipeUrlImport: false, // Q2 — needs Edge Function
  voiceLog: false,       // Q2 experimental
  ouraIntegration: false, // Q3
  restaurantDb: false,   // Q4
  mealPlanning: false,   // Q4
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
