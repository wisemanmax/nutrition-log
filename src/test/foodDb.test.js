import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FoodDb } from '../utils/foodDb';

// Mock idb so no real IndexedDB operations occur in tests
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    get: vi.fn(() => Promise.resolve(null)),
    put: vi.fn(() => Promise.resolve()),
    transaction: vi.fn(() => ({
      store: { index: vi.fn(() => ({ openCursor: vi.fn(() => Promise.resolve(null)) })) },
      done: Promise.resolve(),
    })),
  })),
}));

// Mock fetch
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
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(MOCK_USDA),
    })
  );
});

describe('FoodDb.scale', () => {
  it('scales calories proportionally', () => {
    const food = { cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74, servingG: 100, sugar: 0, satFat: 0 };
    const scaled = FoodDb.scale(food, 200);
    expect(scaled.cal).toBe(330);
    expect(scaled.protein).toBe(62);
    expect(scaled.fat).toBe(7.2);
  });

  it('handles zero base gracefully', () => {
    const food = { cal: 100, protein: 10, carbs: 5, fat: 3, fiber: 1, sodium: 50, servingG: 0, sugar: 0, satFat: 0 };
    // servingG=0 → ratio = Infinity, but we just ensure no crash
    expect(() => FoodDb.scale(food, 100)).not.toThrow();
  });

  it('rounds calories to integer', () => {
    const food = { cal: 100, protein: 10, carbs: 5, fat: 3, fiber: 1, sodium: 50, servingG: 100, sugar: 0, satFat: 0 };
    const scaled = FoodDb.scale(food, 75);
    expect(Number.isInteger(scaled.cal)).toBe(true);
  });

  it('scales to half-serving', () => {
    const food = { cal: 200, protein: 20, carbs: 10, fat: 8, fiber: 2, sodium: 100, servingG: 100, sugar: 0, satFat: 0 };
    const scaled = FoodDb.scale(food, 50);
    expect(scaled.cal).toBe(100);
    expect(scaled.protein).toBe(10);
  });
});
