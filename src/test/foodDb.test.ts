import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoodDb } from '../utils/foodDb';
import type { FoodItem } from '../types';

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    count: vi.fn(() => Promise.resolve(0)),
    transaction: vi.fn(() => ({
      store: { index: vi.fn(() => ({ openCursor: vi.fn(() => Promise.resolve(null)) })) },
      done: Promise.resolve(),
    })),
  })),
}));

const MOCK_USDA = {
  foods: [
    {
      fdcId: 12345,
      description: 'Chicken Breast, raw',
      brandOwner: '',
      servingSize: 100,
      servingSizeUnit: 'g',
      foodNutrients: [
        { nutrientName: 'Energy (Kcal)', value: 165 },
        { nutrientName: 'Protein', value: 31 },
        { nutrientName: 'Total lipid (fat)', value: 3.6 },
        { nutrientName: 'Carbohydrate, by difference', value: 0 },
        { nutrientName: 'Fiber, total dietary', value: 0 },
        { nutrientName: 'Sodium, Na', value: 74 },
      ],
    },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(MOCK_USDA) }),
  ) as unknown as typeof fetch;
});

describe('FoodDb.scale', () => {
  const baseFood: FoodItem = {
    id: 'test-1', name: 'Chicken Breast', source: 'usda',
    servingG: 100, cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74,
  };

  it('scales calories proportionally', () => {
    const scaled = FoodDb.scale(baseFood, 200);
    expect(scaled.cal).toBe(330);
    expect(scaled.protein).toBe(62);
    expect(scaled.fat).toBe(7.2);
  });

  it('handles zero base gracefully', () => {
    const food: FoodItem = { ...baseFood, servingG: 0 };
    expect(() => FoodDb.scale(food, 100)).not.toThrow();
  });

  it('rounds calories to integer', () => {
    const scaled = FoodDb.scale(baseFood, 75);
    expect(Number.isInteger(scaled.cal)).toBe(true);
  });

  it('scales to half-serving', () => {
    const food: FoodItem = { ...baseFood, cal: 200, protein: 20, carbs: 10, fat: 8, fiber: 2, sodium: 100 };
    const scaled = FoodDb.scale(food, 50);
    expect(scaled.cal).toBe(100);
    expect(scaled.protein).toBe(10);
  });

  it('scales micronutrients', () => {
    const food: FoodItem = { ...baseFood, vitaminC: 20, calcium: 100 };
    const scaled = FoodDb.scale(food, 200);
    expect(scaled.vitaminC).toBe(40);
    expect(scaled.calcium).toBe(200);
  });
});

describe('FoodDb.search', () => {
  it('returns empty array for empty query', async () => {
    const results = await FoodDb.search('');
    expect(results).toEqual([]);
  });

  it('returns results for valid query', async () => {
    const results = await FoodDb.search('chicken');
    expect(Array.isArray(results)).toBe(true);
  });
});
