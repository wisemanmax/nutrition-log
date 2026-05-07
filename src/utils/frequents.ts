import type { FoodItem, NutritionDay } from '../types';

export interface FrequentFood extends FoodItem {
  timesLogged: number;
}

/**
 * Compute the top N most-frequently logged foods from the last 30 days of nutrition data.
 * Used in the "Frequents" tab of the food search sheet.
 */
export function computeFrequents(nutrition: NutritionDay[], topN = 10): FrequentFood[] {
  const counts = new Map<string, { food: FoodItem; count: number }>();

  // Only scan the 30 most recent days
  const recent = [...nutrition].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  for (const day of recent) {
    for (const section of day.meals) {
      for (const item of section.items || []) {
        if (!item.id) continue;
        const existing = counts.get(item.id);
        if (existing) {
          existing.count++;
        } else {
          counts.set(item.id, { food: item, count: 1 });
        }
      }
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
    .map(({ food, count }) => ({ ...food, timesLogged: count }));
}
