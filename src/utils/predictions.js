// Predictive analytics — all client-side math, no AI cost

// Estimate TDEE from weight change vs calorie intake over a period
export function estimateTDEE(nutrition, body, units = 'lbs') {
  if (nutrition.length < 14 || body.length < 2) return null;

  // Sort by date
  const sortedBody = [...body].sort((a, b) => a.date.localeCompare(b.date)).filter(b => b.weight != null);
  if (sortedBody.length < 2) return null;

  const firstWeight = sortedBody[0].weight;
  const lastWeight = sortedBody[sortedBody.length - 1].weight;
  const days = Math.round((new Date(sortedBody[sortedBody.length - 1].date) - new Date(sortedBody[0].date)) / 86400000);
  if (days < 7) return null;

  const weightChangeLbs = units === 'kg'
    ? (lastWeight - firstWeight) * 2.20462
    : (lastWeight - firstWeight);

  const calsFromWeightChange = weightChangeLbs * 3500; // ~3500 kcal per lb

  // Average daily calories over same period
  const startDate = sortedBody[0].date;
  const endDate = sortedBody[sortedBody.length - 1].date;
  const relevantNutrition = nutrition.filter(n => n.date >= startDate && n.date <= endDate);
  if (!relevantNutrition.length) return null;

  const totalCals = relevantNutrition.reduce((s, n) => s + (n.cal || 0), 0);
  const avgDailyCals = totalCals / days;
  const tdee = avgDailyCals - (calsFromWeightChange / days);

  return Math.round(tdee);
}

// Project weight N days from now given current intake and estimated TDEE
export function projectWeight(currentWeight, tdee, avgDailyCals, days, units = 'lbs') {
  if (!currentWeight || !tdee || !avgDailyCals) return null;
  // Surplus = eating more than TDEE → weight gain (positive)
  // Deficit = eating less than TDEE → weight loss (negative)
  const dailySurplus = avgDailyCals - tdee; // positive = surplus, negative = deficit
  const weightChangeLbs = (dailySurplus * days) / 3500;
  const weightChange = units === 'kg' ? weightChangeLbs / 2.20462 : weightChangeLbs;
  return Math.round((currentWeight + weightChange) * 10) / 10;
}

// Detect weight plateau: returns true if weight has been flat for N days
export function detectPlateau(body, units = 'lbs', minDays = 14, threshold = 0.5) {
  const weights = [...body]
    .filter(b => b.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, minDays);

  if (weights.length < minDays) return false;

  const values = weights.map(b => b.weight);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (max - min) <= threshold;
}

// Generate 90-day weight projection data series for charting
export function generateProjection(currentWeight, tdee, avgDailyCals, daysAhead = 90, units = 'lbs') {
  if (!currentWeight || !tdee || !avgDailyCals) return [];
  const points = [];
  const today = new Date();

  for (let day = 0; day <= daysAhead; day += 7) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const projected = projectWeight(currentWeight, tdee, avgDailyCals, day, units);
    if (projected != null) {
      points.push({
        date: date.toISOString().split('T')[0],
        weight: projected,
      });
    }
  }
  return points;
}

// Weekly deficiency report — which micronutrients are consistently low
export function getMicronutrientReport(nutrition, goals = {}) {
  const last7 = nutrition.slice(0, 7);
  if (!last7.length) return [];

  const avg = (key) => {
    const vals = last7.filter(n => n[key] > 0).map(n => n[key]);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  };

  const report = [
    { nutrient: 'Fiber', avg: avg('fiber'), goal: goals.fiber || 25, unit: 'g' },
    { nutrient: 'Sodium', avg: avg('sodium'), goal: 2300, unit: 'mg', higherIsBad: true },
    { nutrient: 'Protein', avg: avg('protein'), goal: goals.protein || 180, unit: 'g' },
  ];

  return report.map(r => ({
    ...r,
    pct: r.goal > 0 ? Math.round((r.avg / r.goal) * 100) : 0,
    status: r.higherIsBad
      ? (r.avg > r.goal ? 'high' : 'ok')
      : (r.avg >= r.goal * 0.9 ? 'ok' : r.avg >= r.goal * 0.7 ? 'low' : 'deficient'),
  }));
}
