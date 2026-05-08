// Google Fit / Health Connect bridge — requires @capacitor-community/health-connect plugin.
// All methods are stubs until the Capacitor native shell is wired up for Android.

export interface NutritionPayload {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
}

export interface ActivitySample {
  date: string; // YYYY-MM-DD
  value: number;
}

export const GoogleFit = {
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    // Real: (window as any).Capacitor?.isPluginAvailable('HealthConnect') ?? false
    return false;
  },

  async requestPermissions(): Promise<boolean> {
    // Real: HealthConnect.requestHealthPermissions({ read: [...], write: [...] })
    return false;
  },

  async writeNutrition(data: NutritionPayload): Promise<void> {
    // Real: HealthConnect.insertRecords([{ type: 'Nutrition', ... }])
    void data;
  },

  async writeWeight(kg: number, _date: string): Promise<void> {
    // Real: HealthConnect.insertRecords([{ type: 'Weight', weight: { value: kg, unit: 'kilograms' }, ... }])
    void kg;
  },

  async writeWater(liters: number, _date: string): Promise<void> {
    // Real: HealthConnect.insertRecords([{ type: 'Hydration', volume: { value: liters, unit: 'liters' }, ... }])
    void liters;
  },

  async readSteps(from: string, to: string): Promise<ActivitySample[]> {
    // Real: HealthConnect.readRecords('Steps', { timeRangeFilter: { startTime: from, endTime: to } })
    void from; void to;
    return [];
  },

  async readActiveEnergy(from: string, to: string): Promise<ActivitySample[]> {
    // Real: HealthConnect.readRecords('ActiveCaloriesBurned', ...)
    void from; void to;
    return [];
  },

  async readSleep(from: string, to: string): Promise<{ date: string; minutes: number }[]> {
    // Real: HealthConnect.readRecords('SleepSession', ...)
    void from; void to;
    return [];
  },
};
