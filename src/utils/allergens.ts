import type { FoodItem } from '../types';

export interface AllergenDef { id: string; label: string; icon: string; }
export interface DietaryModeDef { id: string; label: string; icon: string; }
export interface ActivityLevelDef { id: string; label: string; desc: string; multiplier: number; }

export const ALLERGENS: AllergenDef[] = [
  { id: 'peanut',    label: 'Peanut',       icon: '🥜' },
  { id: 'tree_nut',  label: 'Tree Nut',     icon: '🌰' },
  { id: 'dairy',     label: 'Dairy',        icon: '🥛' },
  { id: 'egg',       label: 'Egg',          icon: '🥚' },
  { id: 'soy',       label: 'Soy',          icon: '🫘' },
  { id: 'wheat',     label: 'Wheat/Gluten', icon: '🌾' },
  { id: 'fish',      label: 'Fish',         icon: '🐟' },
  { id: 'shellfish', label: 'Shellfish',    icon: '🦐' },
  { id: 'sesame',    label: 'Sesame',       icon: '🌿' },
];

export const DIETARY_MODES: DietaryModeDef[] = [
  { id: 'vegetarian',         label: 'Vegetarian',        icon: '🥗' },
  { id: 'vegan',              label: 'Vegan',             icon: '🌱' },
  { id: 'keto',               label: 'Keto',              icon: '🥩' },
  { id: 'paleo',              label: 'Paleo',             icon: '🍖' },
  { id: 'mediterranean',      label: 'Mediterranean',     icon: '🫒' },
  { id: 'low_fodmap',         label: 'Low-FODMAP',        icon: '🥬' },
  { id: 'gluten_free',        label: 'Gluten-Free',       icon: '🌾' },
  { id: 'halal',              label: 'Halal',             icon: '☪️' },
  { id: 'kosher',             label: 'Kosher',            icon: '✡️' },
  { id: 'intermittent_fasting', label: 'Intermittent Fasting', icon: '⏱' },
];

export const ACTIVITY_LEVELS: ActivityLevelDef[] = [
  { id: 'sedentary', label: 'Sedentary',        desc: 'Little or no exercise',     multiplier: 1.2   },
  { id: 'light',     label: 'Lightly Active',   desc: '1-3 days/week',             multiplier: 1.375 },
  { id: 'moderate',  label: 'Moderately Active', desc: '3-5 days/week',            multiplier: 1.55  },
  { id: 'very',      label: 'Very Active',       desc: '6-7 days/week',            multiplier: 1.725 },
  { id: 'extra',     label: 'Extremely Active',  desc: 'Physical job + exercise',  multiplier: 1.9   },
];

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanut:    ['peanut'],
  tree_nut:  ['almond', 'cashew', 'walnut', 'pecan', 'hazelnut', 'pistachio', 'brazil nut', 'pine nut', 'tree nut'],
  dairy:     ['milk', 'cheese', 'butter', 'cream', 'whey', 'casein', 'lactose', 'dairy', 'yogurt'],
  egg:       ['egg'],
  soy:       ['soy', 'soya', 'tofu', 'tempeh', 'edamame'],
  wheat:     ['wheat', 'gluten', 'flour', 'bread', 'pasta', 'semolina', 'barley', 'rye'],
  fish:      ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy'],
  shellfish: ['shrimp', 'lobster', 'crab', 'shellfish', 'clam', 'oyster', 'scallop'],
  sesame:    ['sesame', 'tahini'],
};

export function hasAllergenConflict(food: Partial<FoodItem>, userAllergens: string[]): boolean {
  if (!userAllergens.length) return false;
  const foodAllergens = ((food.allergens || []) as string[]).join(' ').toLowerCase();
  const foodName = ((food.name ?? '') + ' ' + (food.brand ?? '')).toLowerCase();

  return userAllergens.some(allergenId => {
    const keywords = ALLERGEN_KEYWORDS[allergenId] ?? [allergenId];
    return keywords.some(kw => foodAllergens.includes(kw) || foodName.includes(kw));
  });
}

export interface TDEEComponents { mult: number; age: number; heightCm: number; sex: string; }

export function calcTDEEComponents(
  profile: { sex?: string; dob?: string; height?: string; activityLevel?: string },
): TDEEComponents | null {
  const { sex, dob, height, activityLevel } = profile;
  if (!sex || !dob || !height) return null;

  const age = new Date().getFullYear() - new Date(dob).getFullYear();
  const heightCm = parseFloat(height) * 2.54; // input is inches
  const mult = ACTIVITY_LEVELS.find(a => a.id === activityLevel)?.multiplier ?? 1.55;
  return { mult, age, heightCm, sex };
}

export function calcTDEEFromWeight(
  weightLbs: number,
  profile: { sex?: string; dob?: string; height?: string; activityLevel?: string },
): number | null {
  const components = calcTDEEComponents(profile);
  if (!components) return null;
  const { mult, age, heightCm, sex } = components;
  const weightKg = weightLbs * 0.453592;
  // Mifflin-St Jeor BMR
  const bmr = sex === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  return Math.round(bmr * mult);
}
