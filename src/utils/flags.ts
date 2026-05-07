import type { FeatureFlags } from '../types';

const DEFAULT_FLAGS: FeatureFlags = {
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

let _flags: FeatureFlags = { ...DEFAULT_FLAGS };

export const Flags = {
  all: (): FeatureFlags => ({ ..._flags }),

  get: (name: keyof FeatureFlags): boolean => _flags[name] ?? false,

  override: (overrides: Partial<FeatureFlags>): void => {
    _flags = { ..._flags, ...overrides };
  },

  loadRemote: async (url: string): Promise<void> => {
    if (!url) return;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const remote = await res.json() as Partial<FeatureFlags>;
      Flags.override(remote);
    } catch { /* network failure — use defaults */ }
  },
};
