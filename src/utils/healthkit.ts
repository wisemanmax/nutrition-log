// Apple HealthKit bridge — requires @capacitor-community/health plugin in production.
// In the PWA context, all methods return false/empty. The Capacitor native shell
// enables the real implementation via plugin injection.

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

export const HealthKit = {
  async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    // Real: (window as any).Capacitor?.isPluginAvailable('CapacitorHealthKit') ?? false
    return false;
  },

  async requestPermissions(): Promise<boolean> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.requestAuthorization({ read: [...], write: [...] })
    return false;
  },

  async writeNutrition(data: NutritionPayload): Promise<void> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.saveNutritionData({ ...data })
  },

  async writeWater(cups: number, _date: string): Promise<void> {
    // Real: HealthKit writes water in mL (1 cup = 236.6 mL)
    void cups;
  },

  async writeWeight(kg: number, _date: string): Promise<void> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.saveWeightData({ value: kg, unit: 'kg', date })
    void kg;
  },

  async readSteps(from: string, to: string): Promise<ActivitySample[]> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.queryStepCount({ startDate: from, endDate: to })
    void from; void to;
    return [];
  },

  async readActiveEnergy(from: string, to: string): Promise<ActivitySample[]> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.queryActiveEnergyBurned(...)
    void from; void to;
    return [];
  },

  async readHeartRate(from: string, to: string): Promise<ActivitySample[]> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.queryHeartRate(...)
    void from; void to;
    return [];
  },

  async readSleep(from: string, to: string): Promise<{ date: string; minutes: number }[]> {
    // Real: Capacitor.Plugins.CapacitorHealthKit.querySleepAnalysis(...)
    void from; void to;
    return [];
  },
};
