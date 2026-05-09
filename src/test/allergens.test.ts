import { describe, it, expect } from 'vitest';
import { hasAllergenConflict, ALLERGENS, DIETARY_MODES } from '../utils/allergens';

describe('allergens', () => {
  it('returns false when user has no allergens', () => {
    const food = { name: 'Peanut butter', allergens: ['en:peanuts'], brand: '', id: 'f1', servingG: 100, cal: 100, protein: 5, carbs: 10, fat: 5, fiber: 1, sodium: 50 };
    expect(hasAllergenConflict(food, [])).toBe(false);
  });

  it('detects peanut allergen in food name', () => {
    const food = { name: 'Peanut Butter Cookies', allergens: [], brand: '', id: 'f2', servingG: 100, cal: 150, protein: 4, carbs: 18, fat: 8, fiber: 1, sodium: 100 };
    expect(hasAllergenConflict(food, ['peanut'])).toBe(true);
  });

  it('detects dairy in allergen tags', () => {
    const food = { name: 'Greek Yogurt', allergens: ['en:milk', 'en:dairy'], brand: '', id: 'f3', servingG: 100, cal: 60, protein: 10, carbs: 4, fat: 0, fiber: 0, sodium: 40 };
    expect(hasAllergenConflict(food, ['dairy'])).toBe(true);
  });

  it('detects wheat from food name', () => {
    const food = { name: 'Whole Wheat Bread', allergens: [], brand: '', id: 'f4', servingG: 30, cal: 80, protein: 3, carbs: 15, fat: 1, fiber: 2, sodium: 140 };
    expect(hasAllergenConflict(food, ['wheat'])).toBe(true);
  });

  it('no conflict for irrelevant allergen', () => {
    const food = { name: 'Chicken Breast', allergens: [], brand: '', id: 'f5', servingG: 100, cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74 };
    expect(hasAllergenConflict(food, ['shellfish', 'dairy'])).toBe(false);
  });

  it('ALLERGENS list has required ids', () => {
    const ids = ALLERGENS.map(a => a.id);
    expect(ids).toContain('peanut');
    expect(ids).toContain('dairy');
    expect(ids).toContain('wheat');
    expect(ids).toContain('sesame');
  });

  it('DIETARY_MODES list has required ids', () => {
    const ids = DIETARY_MODES.map(m => m.id);
    expect(ids).toContain('vegan');
    expect(ids).toContain('keto');
    expect(ids).toContain('gluten_free');
  });
});
