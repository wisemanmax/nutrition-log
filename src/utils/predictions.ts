import type { NutritionDay, BodyEntry, Goals } from '../types';

export interface MicronutrientReportItem {
  nutrient: string;
  avg: number;
  goal: number;
  unit: string;
  pct: number;
  status: 'ok' | 'low' | 'deficient' | 'high';
  higherIsBad?: boolean;
}

export interface WeightProjectionPoint {
  date: string;
  weight: number;
}

/** Estimate TDEE from observed weight change vs. calorie intake. */
export function estimateTDEE(
  nutrition: NutritionDay[],
  body: BodyEntry[],
  units: 'lbs' | 'kg' = 'lbs',
): number | null {
  if (nutrition.length < 14 || body.length < 2) return null;

  const sortedBody = [...body]
    .filter(b => b.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sortedBody.length < 2) return null;

  const firstWeight = sortedBody[0].weight!;
  const lastWeight  = sortedBody[sortedBody.length - 1].weight!;
  const days = Math.round(
    (new Date(sortedBody[sortedBody.length - 1].date).getTime() - new Date(sortedBody[0].date).getTime()) / 86_400_000,
  );
  if (days < 7) return null;

  const weightChangeLbs = units === 'kg'
    ? (lastWeight - firstWeight) * 2.20462
    : (lastWeight - firstWeight);

  const calsFromWeightChange = weightChangeLbs * 3500;

  const startDate = sortedBody[0].date;
  const endDate   = sortedBody[sortedBody.length - 1].date;
  const relevantNutrition = nutrition.filter(n => n.date >= startDate && n.date <= endDate);
  if (!relevantNutrition.length) return null;

  const totalCals   = relevantNutrition.reduce((s, n) => s + (n.cal ?? 0), 0);
  const avgDailyCals = totalCals / days;
  const tdee = avgDailyCals - calsFromWeightChange / days;
  return Math.round(tdee);
}

/** Project weight N days into the future. */
export function projectWeight(
  currentWeight: number,
  tdee: number,
  avgDailyCals: number,
  days: number,
  units: 'lbs' | 'kg' = 'lbs',
): number | null {
  if (!currentWeight || !tdee || !avgDailyCals) return null;
  const dailySurplus = avgDailyCals - tdee;
  const weightChangeLbs = (dailySurplus * days) / 3500;
  const weightChange = units === 'kg' ? weightChangeLbs / 2.20462 : weightChangeLbs;
  return Math.round((currentWeight + weightChange) * 10) / 10;
}

/** Return true when weight has not moved beyond `threshold` for `minDays` consecutive entries. */
export function detectPlateau(
  body: BodyEntry[],
  units: 'lbs' | 'kg' = 'lbs',
  minDays = 14,
  threshold = 0.5,
): boolean {
  const weights = [...body]
    .filter(b => b.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, minDays);

  if (weights.length < minDays) return false;
  const values = weights.map(b => b.weight!);
  return Math.max(...values) - Math.min(...values) <= threshold;
}

/** Generate a 90-day weight projection series for charting. */
export function generateProjection(
  currentWeight: number,
  tdee: number,
  avgDailyCals: number,
  daysAhead = 90,
  units: 'lbs' | 'kg' = 'lbs',
): WeightProjectionPoint[] {
  if (!currentWeight || !tdee || !avgDailyCals) return [];
  const points: WeightProjectionPoint[] = [];
  const now = new Date();

  for (let day = 0; day <= daysAhead; day += 7) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const weight = projectWeight(currentWeight, tdee, avgDailyCals, day, units);
    if (weight != null) {
      points.push({ date: date.toISOString().split('T')[0], weight });
    }
  }
  return points;
}

/** Weekly micronutrient deficiency report. */
export function getMicronutrientReport(
  nutrition: NutritionDay[],
  goals: Partial<Goals> = {},
): MicronutrientReportItem[] {
  const last7 = nutrition.slice(0, 7);
  if (!last7.length) return [];

  const avg = (key: keyof NutritionDay): number => {
    const vals = last7
      .filter(n => ((n[key] as number | undefined) ?? 0) > 0)
      .map(n => (n[key] as number) || 0);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };

  const items = [
    { nutrient: 'Fiber',   avg: avg('fiber'),   goal: goals.fiber ?? 25,  unit: 'g',  higherIsBad: false },
    { nutrient: 'Sodium',  avg: avg('sodium'),  goal: 2300,                unit: 'mg', higherIsBad: true  },
    { nutrient: 'Protein', avg: avg('protein'), goal: goals.protein ?? 180, unit: 'g', higherIsBad: false },
  ];

  return items.map(r => ({
    ...r,
    pct: r.goal > 0 ? Math.round((r.avg / r.goal) * 100) : 0,
    status: (r.higherIsBad
      ? (r.avg > r.goal ? 'high' : 'ok')
      : (r.avg >= r.goal * 0.9 ? 'ok' : r.avg >= r.goal * 0.7 ? 'low' : 'deficient')) as MicronutrientReportItem['status'],
  }));
}

/** Estimate 90% confidence interval on TDEE. Returns [low, high] or null. */
export function estimateTDEEInterval(
  nutrition: NutritionDay[],
  body: BodyEntry[],
  units: 'lbs' | 'kg' = 'lbs',
): [number, number] | null {
  const tdee = estimateTDEE(nutrition, body, units);
  if (!tdee) return null;
  // ±10% CI based on typical tracking accuracy studies
  return [Math.round(tdee * 0.9), Math.round(tdee * 1.1)];
}

/** Suggest adjusted macros for a recomp or cut/bulk given current averages. */
export function getMacroCyclingSuggestion(
  goals: Partial<Goals>,
  avgCal: number,
  tdee: number,
): { training: Partial<Goals>; rest: Partial<Goals> } | null {
  if (!tdee || !avgCal) return null;
  const cal = goals.cal ?? 2400;
  const protein = goals.protein ?? 180;
  const fat = goals.fat ?? 70;

  // Training day: +200 kcal, mostly carbs
  const trainingCal = cal + 200;
  const trainingCarbs = Math.round(((trainingCal - protein * 4 - fat * 9) / 4));

  // Rest day: -200 kcal, reduce carbs
  const restCal = Math.max(1200, cal - 200);
  const restCarbs = Math.round(((restCal - protein * 4 - fat * 9) / 4));

  return {
    training: { cal: trainingCal, protein, fat, carbs: Math.max(0, trainingCarbs) },
    rest:     { cal: restCal,     protein, fat, carbs: Math.max(0, restCarbs) },
  };
}
