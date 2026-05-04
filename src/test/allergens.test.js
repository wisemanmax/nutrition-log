import { describe, it, expect } from 'vitest';
import { hasAllergenConflict, ALLERGENS, DIETARY_MODES } from '../utils/allergens';

describe('allergens', () => {
  it('returns false when user has no allergens', () => {
    const food = { name: 'Peanut butter', allergens: ['en:peanuts'], brand: '' };
    expect(hasAllergenConflict(food, [])).toBe(false);
  });

  it('detects peanut allergen in food name', () => {
    const food = { name: 'Peanut Butter Cookies', allergens: [], brand: '' };
    expect(hasAllergenConflict(food, ['peanut'])).toBe(true);
  });

  it('detects dairy in allergen tags', () => {
    const food = { name: 'Greek Yogurt', allergens: ['en:milk', 'en:dairy'], brand: '' };
    expect(hasAllergenConflict(food, ['dairy'])).toBe(true);
  });

  it('detects wheat from food name', () => {
    const food = { name: 'Whole Wheat Bread', allergens: [], brand: '' };
    expect(hasAllergenConflict(food, ['wheat'])).toBe(true);
  });

  it('no conflict for irrelevant allergen', () => {
    const food = { name: 'Chicken Breast', allergens: [], brand: '' };
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
