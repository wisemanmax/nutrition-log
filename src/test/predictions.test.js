import { describe, it, expect } from 'vitest';
import { detectPlateau, projectWeight, getMicronutrientReport, generateProjection } from '../utils/predictions';

describe('predictions', () => {
  it('detectPlateau returns false with fewer than minDays entries', () => {
    const body = Array.from({ length: 10 }, (_, i) => ({ date: `2026-0${i + 1}-01`, weight: 180 }));
    expect(detectPlateau(body)).toBe(false);
  });

  it('detectPlateau returns true when weight is flat for 14 days', () => {
    const body = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-${String(i + 1).padStart(2, '0')}-01`,
      weight: 180 + (Math.random() * 0.3), // < 0.5 threshold
    }));
    expect(detectPlateau(body, 'lbs', 14, 0.5)).toBe(true);
  });

  it('projectWeight calculates deficit correctly', () => {
    // 500 kcal deficit for 7 days = 1 lb loss
    const result = projectWeight(180, 2500, 2000, 7, 'lbs');
    expect(result).toBeCloseTo(179, 0); // ~1 lb loss in 7 days
  });

  it('projectWeight returns null without required inputs', () => {
    expect(projectWeight(null, 2500, 2000, 7)).toBeNull();
    expect(projectWeight(180, null, 2000, 7)).toBeNull();
    expect(projectWeight(180, 2500, null, 7)).toBeNull();
  });

  it('getMicronutrientReport computes averages correctly', () => {
    const nutrition = [
      { date: '2026-05-04', cal: 2000, protein: 150, carbs: 200, fat: 60, fiber: 20, sodium: 2000 },
      { date: '2026-05-03', cal: 1900, protein: 140, carbs: 180, fat: 55, fiber: 18, sodium: 2100 },
      { date: '2026-05-02', cal: 2100, protein: 160, carbs: 220, fat: 65, fiber: 22, sodium: 1900 },
    ];
    const report = getMicronutrientReport(nutrition, { protein: 180, fiber: 25 });
    const fiberEntry = report.find(r => r.nutrient === 'Fiber');
    expect(fiberEntry).toBeTruthy();
    expect(fiberEntry.avg).toBe(20); // avg of 20,18,22
    expect(fiberEntry.status).toBe('low'); // below 25g goal
  });

  it('generateProjection returns weekly data points', () => {
    const data = generateProjection(180, 2500, 2000, 90, 'lbs');
    expect(data.length).toBeGreaterThan(10); // ~13 weeks
    expect(data[0].weight).toBe(180); // starts at current weight
    expect(data[data.length - 1].weight).toBeLessThan(180); // losing weight in deficit
  });
});
