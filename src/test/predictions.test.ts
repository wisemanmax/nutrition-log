import { describe, it, expect } from 'vitest';
import {
  estimateTDEE,
  projectWeight,
  detectPlateau,
  generateProjection,
  getMicronutrientReport,
  estimateTDEEInterval,
  getMacroCyclingSuggestion,
} from '../utils/predictions.ts';

const makeBodyEntry = (date: string, weight: number) => ({
  id: date, date, weight, bodyFat: null, neck: null, waist: null, hip: null,
});

const makeDayEntry = (date: string, overrides = {}) => ({
  id: date, date, meals: [],
  cal: 2000, protein: 150, carbs: 200, fat: 60, fiber: 25, sodium: 1800,
  ...overrides,
});

describe('estimateTDEE', () => {
  it('returns null if insufficient data', () => {
    expect(estimateTDEE([], [], 'lbs')).toBeNull();
    expect(estimateTDEE(Array(14).fill(makeDayEntry('2025-01-01')), [], 'lbs')).toBeNull();
  });

  it('estimates TDEE from stable weight (should be near avg intake)', () => {
    const startDate = '2025-01-01';
    const endDate = '2025-01-31';
    const body = [makeBodyEntry(startDate, 180), makeBodyEntry(endDate, 180)];
    const nutrition = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2025-01-01'); d.setDate(d.getDate() + i);
      return makeDayEntry(d.toISOString().split('T')[0], { cal: 2200 });
    });
    const tdee = estimateTDEE(nutrition, body, 'lbs');
    expect(tdee).toBeCloseTo(2200, -2); // within ~100 kcal
  });

  it('accounts for weight gain (surplus → TDEE lower than intake)', () => {
    const body = [makeBodyEntry('2025-01-01', 180), makeBodyEntry('2025-02-01', 182)];
    const nutrition = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2025-01-01'); d.setDate(d.getDate() + i);
      return makeDayEntry(d.toISOString().split('T')[0], { cal: 2500 });
    });
    const tdee = estimateTDEE(nutrition, body, 'lbs');
    expect(tdee).toBeLessThan(2500);
    expect(tdee).toBeGreaterThan(1000);
  });
});

describe('projectWeight', () => {
  it('returns null if any param missing', () => {
    expect(projectWeight(null as any, 2200, 2000, 30)).toBeNull();
    expect(projectWeight(180, null as any, 2000, 30)).toBeNull();
  });

  it('projects weight loss for deficit', () => {
    const proj = projectWeight(180, 2200, 2000, 7, 'lbs'); // 200 kcal deficit × 7 days
    expect(proj).toBeLessThan(180);
    // ~1400 kcal deficit / 3500 = 0.4 lbs loss
    expect(proj).toBeCloseTo(179.6, 0);
  });

  it('projects weight gain for surplus', () => {
    const proj = projectWeight(180, 2000, 2500, 7, 'lbs');
    expect(proj).toBeGreaterThan(180);
  });

  it('handles kg units', () => {
    const proj = projectWeight(80, 2000, 1800, 7, 'kg');
    expect(proj).toBeLessThan(80);
  });
});

describe('detectPlateau', () => {
  it('returns false if not enough data', () => {
    const body = Array.from({ length: 10 }, (_, i) => makeBodyEntry(`2025-01-${String(i + 1).padStart(2, '0')}`, 180));
    expect(detectPlateau(body)).toBe(false);
  });

  it('detects plateau when weight stable for minDays', () => {
    const body = Array.from({ length: 14 }, (_, i) => makeBodyEntry(`2025-01-${String(i + 1).padStart(2, '0')}`, 180 + (i % 2 === 0 ? 0.1 : 0)));
    expect(detectPlateau(body, 'lbs', 14, 0.5)).toBe(true);
  });

  it('does not flag a declining trend as plateau', () => {
    const body = Array.from({ length: 14 }, (_, i) => makeBodyEntry(`2025-01-${String(i + 1).padStart(2, '0')}`, 185 - i * 0.5));
    expect(detectPlateau(body)).toBe(false);
  });
});

describe('generateProjection', () => {
  it('returns empty array if params missing', () => {
    expect(generateProjection(null as any, 2200, 2000, 90)).toHaveLength(0);
  });

  it('generates ~14 weekly points for 90 days', () => {
    const pts = generateProjection(180, 2200, 2000, 90);
    expect(pts.length).toBeGreaterThan(10);
    expect(pts.length).toBeLessThanOrEqual(14);
    expect(pts[0]).toHaveProperty('date');
    expect(pts[0]).toHaveProperty('weight');
  });

  it('first point matches current weight', () => {
    const pts = generateProjection(175, 2200, 2200, 90); // no deficit
    expect(pts[0].weight).toBe(175); // first point at day 0
  });
});

describe('getMicronutrientReport', () => {
  it('returns empty array with no data', () => {
    expect(getMicronutrientReport([], {})).toHaveLength(0);
  });

  it('marks fiber as ok when at goal', () => {
    const data = Array.from({ length: 7 }, (_, i) => makeDayEntry(`2025-01-${i + 1}`, { fiber: 25 }));
    const report = getMicronutrientReport(data, { fiber: 25, protein: 150 });
    const fiberRow = report.find(r => r.nutrient === 'Fiber')!;
    expect(fiberRow).toBeDefined();
    expect(fiberRow.status).toBe('ok');
  });

  it('marks sodium as high when over goal', () => {
    const data = Array.from({ length: 7 }, (_, i) => makeDayEntry(`2025-01-${i + 1}`, { sodium: 3500 }));
    const report = getMicronutrientReport(data, {});
    const sodiumRow = report.find(r => r.nutrient === 'Sodium')!;
    expect(sodiumRow.status).toBe('high');
  });

  it('marks protein as deficient when well below goal', () => {
    const data = Array.from({ length: 7 }, (_, i) => makeDayEntry(`2025-01-${i + 1}`, { protein: 50 }));
    const report = getMicronutrientReport(data, { protein: 180 });
    const protRow = report.find(r => r.nutrient === 'Protein')!;
    expect(protRow.status).toBe('deficient');
  });
});

describe('estimateTDEEInterval', () => {
  it('returns null when TDEE cannot be estimated', () => {
    expect(estimateTDEEInterval([], [], 'lbs')).toBeNull();
  });

  it('returns [low, high] with low < high', () => {
    const body = [makeBodyEntry('2025-01-01', 180), makeBodyEntry('2025-02-01', 180)];
    const nutrition = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2025-01-01'); d.setDate(d.getDate() + i);
      return makeDayEntry(d.toISOString().split('T')[0], { cal: 2200 });
    });
    const interval = estimateTDEEInterval(nutrition, body, 'lbs');
    expect(interval).not.toBeNull();
    expect(interval![0]).toBeLessThan(interval![1]);
  });

  it('interval spans roughly 20% of TDEE value (±10%)', () => {
    const body = [makeBodyEntry('2025-01-01', 180), makeBodyEntry('2025-02-01', 180)];
    const nutrition = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2025-01-01'); d.setDate(d.getDate() + i);
      return makeDayEntry(d.toISOString().split('T')[0], { cal: 2200 });
    });
    const interval = estimateTDEEInterval(nutrition, body, 'lbs')!;
    const span = interval[1] - interval[0];
    // Span should be ~20% of TDEE (~440 kcal) — allow ±50 kcal for rounding
    expect(span).toBeGreaterThan(350);
    expect(span).toBeLessThan(500);
  });
});

describe('getMacroCyclingSuggestion', () => {
  it('returns null when TDEE is 0', () => {
    expect(getMacroCyclingSuggestion({ cal: 2400 }, 2200, 0)).toBeNull();
  });

  it('training day has more calories than rest day', () => {
    const s = getMacroCyclingSuggestion({ cal: 2400, protein: 180, fat: 70, carbs: 250 }, 2300, 2500);
    expect(s).not.toBeNull();
    expect(s!.training.cal!).toBeGreaterThan(s!.rest.cal!);
  });

  it('protein is equal on training and rest days', () => {
    const s = getMacroCyclingSuggestion({ cal: 2400, protein: 180, fat: 70 }, 2300, 2500);
    expect(s!.training.protein).toBe(s!.rest.protein);
  });

  it('rest day is not below 1200 kcal', () => {
    const s = getMacroCyclingSuggestion({ cal: 1400, protein: 130, fat: 60 }, 1300, 1600);
    expect(s!.rest.cal!).toBeGreaterThanOrEqual(1200);
  });
});
