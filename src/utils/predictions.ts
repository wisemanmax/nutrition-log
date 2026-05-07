import type { NutritionDay, BodyEntry, Goals, MicronutrientReportItem } from '../types';

export function estimateTDEE(
  nutrition: NutritionDay[],
  body: BodyEntry[],
  units: 'lbs' | 'kg' = 'lbs',
): number | null {
  if (nutrition.length < 14 || body.length < 2) return null;

  const sortedBody = [...body]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(b => b.weight != null) as (BodyEntry & { weight: number })[];
  if (sortedBody.length < 2) return null;

  const firstWeight = sortedBody[0].weight;
  const lastWeight = sortedBody[sortedBody.length - 1].weight;
  const days = Math.round(
    (new Date(sortedBody[sortedBody.length - 1].date).getTime() - new Date(sortedBody[0].date).getTime()) / 86400000,
  );
  if (days < 7) return null;

  const weightChangeLbs = units === 'kg'
    ? (lastWeight - firstWeight) * 2.20462
    : lastWeight - firstWeight;

  const calsFromWeightChange = weightChangeLbs * 3500;

  const startDate = sortedBody[0].date;
  const endDate = sortedBody[sortedBody.length - 1].date;
  const relevantNutrition = nutrition.filter(n => n.date >= startDate && n.date <= endDate);
  if (!relevantNutrition.length) return null;

  const totalCals = relevantNutrition.reduce((s, n) => s + (n.cal || 0), 0);
  const avgDailyCals = totalCals / days;
  const tdee = avgDailyCals - calsFromWeightChange / days;

  return Math.round(tdee);
}

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

export function detectPlateau(
  body: BodyEntry[],
  units: 'lbs' | 'kg' = 'lbs',
  minDays = 14,
  threshold = 0.5,
): boolean {
  const weights = [...body]
    .filter(b => b.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, minDays)
    .map(b => b.weight as number);

  if (weights.length < minDays) return false;

  const max = Math.max(...weights);
  const min = Math.min(...weights);
  // Widen threshold for kg (roughly the same delta in real weight)
  const effectiveThreshold = units === 'kg' ? threshold * 0.453592 : threshold;
  return max - min <= effectiveThreshold;
}

export function generateProjection(
  currentWeight: number,
  tdee: number,
  avgDailyCals: number,
  daysAhead = 90,
  units: 'lbs' | 'kg' = 'lbs',
): Array<{ date: string; weight: number }> {
  if (!currentWeight || !tdee || !avgDailyCals) return [];
  const points: Array<{ date: string; weight: number }> = [];
  const now = new Date();

  for (let day = 0; day <= daysAhead; day += 7) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const projected = projectWeight(currentWeight, tdee, avgDailyCals, day, units);
    if (projected != null) {
      points.push({ date: date.toISOString().split('T')[0], weight: projected });
    }
  }
  return points;
}

export function getMicronutrientReport(
  nutrition: NutritionDay[],
  goals: Partial<Goals> = {},
): MicronutrientReportItem[] {
  const last7 = nutrition.slice(0, 7);
  if (!last7.length) return [];

  const avg = (key: keyof NutritionDay): number => {
    const vals = last7.filter(n => (n[key] as number) > 0).map(n => n[key] as number);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };

  const rows: Array<{ nutrient: string; key: string; avg: number; goal: number; unit: string; higherIsBad?: boolean }> = [
    { nutrient: 'Fiber',   key: 'fiber',   avg: avg('fiber'),   goal: goals.fiber   || 25,  unit: 'g' },
    { nutrient: 'Sodium',  key: 'sodium',  avg: avg('sodium'),  goal: 2300,                  unit: 'mg', higherIsBad: true },
    { nutrient: 'Protein', key: 'protein', avg: avg('protein'), goal: goals.protein || 180, unit: 'g' },
  ];

  return rows.map(r => ({
    ...r,
    pct: r.goal > 0 ? Math.round((r.avg / r.goal) * 100) : 0,
    status: (r.higherIsBad
      ? r.avg > r.goal ? 'high' : 'ok'
      : r.avg >= r.goal * 0.9 ? 'ok' : r.avg >= r.goal * 0.7 ? 'low' : 'deficient') as MicronutrientReportItem['status'],
  }));
}
