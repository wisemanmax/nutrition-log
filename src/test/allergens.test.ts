import { describe, it, expect } from 'vitest';
import { hasAllergenConflict, calcTDEEFromWeight, ALLERGENS, DIETARY_MODES } from '../utils/allergens.ts';
import type { FoodItem } from '../types';

const makeFood = (overrides: Partial<FoodItem> = {}): Partial<FoodItem> => ({
  id: 'f1', name: 'Test food', brand: '', servingG: 100,
  cal: 100, protein: 10, carbs: 5, fat: 3, fiber: 1, sodium: 50,
  allergens: [],
  ...overrides,
});

describe('hasAllergenConflict', () => {
  it('returns false when user has no allergens set', () => {
    const food = makeFood({ name: 'Peanut butter' });
    expect(hasAllergenConflict(food, [])).toBe(false);
  });

  it('detects peanut by name', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Peanut butter' }), ['peanut'])).toBe(true);
  });

  it('detects dairy via allergens array', () => {
    const food = makeFood({ name: 'Protein bar', allergens: ['en:milk', 'en:soy'] });
    expect(hasAllergenConflict(food, ['dairy'])).toBe(true);
  });

  it('no conflict for unrelated allergen', () => {
    const food = makeFood({ name: 'Plain chicken breast' });
    expect(hasAllergenConflict(food, ['peanut', 'shellfish'])).toBe(false);
  });

  it('detects gluten via wheat keyword in name', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Whole wheat bread' }), ['wheat'])).toBe(true);
  });

  it('detects soy in brand field', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Protein shake', brand: 'Soy Nutrition Co' }), ['soy'])).toBe(true);
  });

  it('detects sesame via tahini', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Hummus with tahini' }), ['sesame'])).toBe(true);
  });

  it('no false positive — salmon vs shellfish', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Salmon fillet' }), ['shellfish'])).toBe(false);
  });

  it('detects fish', () => {
    expect(hasAllergenConflict(makeFood({ name: 'Tuna salad' }), ['fish'])).toBe(true);
  });

  it('handles multiple allergens — stops at first match', () => {
    const food = makeFood({ name: 'Almond milk with soy' });
    expect(hasAllergenConflict(food, ['tree_nut', 'dairy'])).toBe(true);
  });
});

describe('calcTDEEFromWeight', () => {
  it('returns null for incomplete profile', () => {
    expect(calcTDEEFromWeight(180, {})).toBeNull();
    expect(calcTDEEFromWeight(180, { sex: 'male' })).toBeNull();
  });

  it('returns positive number for male profile', () => {
    const tdee = calcTDEEFromWeight(180, {
      sex: 'male', dob: '1990-01-01', height: '70', activityLevel: 'moderate',
    });
    expect(tdee).toBeGreaterThan(1500);
    expect(tdee).toBeLessThan(4000);
  });

  it('female TDEE is lower than male at same stats', () => {
    const profile = { dob: '1990-01-01', height: '65', activityLevel: 'moderate' };
    const male   = calcTDEEFromWeight(155, { ...profile, sex: 'male' })!;
    const female = calcTDEEFromWeight(155, { ...profile, sex: 'female' })!;
    expect(female).toBeLessThan(male);
  });

  it('higher activity multiplies TDEE', () => {
    const base = { sex: 'male', dob: '1990-01-01', height: '70' };
    const sedentary = calcTDEEFromWeight(180, { ...base, activityLevel: 'sedentary' })!;
    const veryActive = calcTDEEFromWeight(180, { ...base, activityLevel: 'very' })!;
    expect(veryActive).toBeGreaterThan(sedentary);
  });
});

describe('ALLERGENS & DIETARY_MODES constants', () => {
  it('all allergens have id, label, icon', () => {
    for (const a of ALLERGENS) {
      expect(a.id).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(a.icon).toBeTruthy();
    }
  });

  it('9 allergens defined (US FDA top 9)', () => {
    expect(ALLERGENS).toHaveLength(9);
  });

  it('all dietary modes have id, label, icon', () => {
    for (const m of DIETARY_MODES) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });
});
