// Central type definitions for NutritionLog

// ─── Food ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  source?: 'usda' | 'off' | 'manual' | 'recipe';
  servingG: number;
  servingUnit?: string;
  qty?: number;
  unit?: string;
  // Macros
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  // Extended macros
  sugar?: number;
  satFat?: number;
  cholesterol?: number;
  // Micronutrients
  calcium?: number;
  iron?: number;
  potassium?: number;
  magnesium?: number;
  zinc?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
  vitaminB6?: number;
  folate?: number;
  // Meta
  barcode?: string;
  allergens?: string[];
  dietaryModes?: string[];
  imageUrl?: string;
  loggedAt?: string;
  cachedAt?: number;
}

// ─── Meal ────────────────────────────────────────────────────────────────────

export interface MealSection {
  name: string;
  items: FoodItem[];
}

export interface NutritionDay {
  id: string;
  date: string; // YYYY-MM-DD
  meals: MealSection[];
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export interface BodyEntry {
  id: string;
  date: string;
  weight?: number | null;
  bodyFat?: number | null;
  neck?: number | null;
  waist?: number | null;
  hip?: number | null;
  notes?: string;
  photoUrl?: string;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Goals {
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  height?: string;
  sex?: string;
  dob?: string;
  activityLevel?: string;
  dietaryModes?: string[];
  allergens?: string[];
  state?: string;
  city?: string;
  zipCode?: string;
}

// ─── Recipe ──────────────────────────────────────────────────────────────────

export interface RecipeMacros {
  total: Partial<FoodItem>;
  perServing: Partial<FoodItem>;
}

export interface Recipe {
  id: string;
  name: string;
  items: Array<FoodItem & { qty: number }>;
  servings: number;
  macros: RecipeMacros;
  createdAt?: string;
  notes?: string;
}

// ─── Template ────────────────────────────────────────────────────────────────

export interface MealTemplate {
  id: string;
  name: string;
  meals: MealSection[];
}

// ─── Fasting ─────────────────────────────────────────────────────────────────

export interface FastingState {
  startedAt: string;
  windowHours: number;
}

// ─── Mood ────────────────────────────────────────────────────────────────────

export interface MoodEntry {
  mood?: number;    // 1-5
  energy?: number;  // 1-5
  digestion?: number; // 1-5
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  tab: string;
  nutrition: NutritionDay[];
  body: BodyEntry[];
  water: Record<string, number>;
  mood: Record<string, MoodEntry>;
  recipes: Recipe[];
  favorites: string[];
  recents: FoodItem[];
  frequencyMap: Record<string, number>; // foodId → log count
  templates: MealTemplate[];
  fasting: FastingState | null;
  loaded: boolean;
  onboarded: boolean;
  units: 'lbs' | 'kg';
  goals: Goals;
  profile: UserProfile;
}

// ─── Action Union ─────────────────────────────────────────────────────────────

export type Action =
  | { type: 'INIT'; p: Partial<AppState> }
  | { type: 'IMPORT'; data: Partial<AppState> }
  | { type: 'CLEAR_ALL' }
  | { type: 'ONBOARDED' }
  | { type: 'TAB'; tab: string }
  | { type: 'SET_PROFILE'; profile: Partial<UserProfile> }
  | { type: 'GOALS'; g: Partial<Goals> }
  | { type: 'UNITS'; units: 'lbs' | 'kg' }
  | { type: 'ADD_MEAL_ITEM'; date: string; sectionName: string; item: FoodItem }
  | { type: 'EDIT_MEAL_ITEM'; date: string; sectionName: string; item: FoodItem }
  | { type: 'DELETE_MEAL_ITEM'; date: string; sectionName: string; itemId: string }
  | { type: 'COPY_DAY'; fromDate: string; toDate: string }
  | { type: 'ADD_N'; n: NutritionDay }
  | { type: 'EDIT_N'; n: NutritionDay }
  | { type: 'DEL_N'; id: string }
  | { type: 'LOG_BODY'; entry: Omit<BodyEntry, 'id'> }
  | { type: 'ADD_PHOTO'; date: string; photoUrl: string }
  | { type: 'DEL_B'; id: string }
  | { type: 'ADD_B'; b: BodyEntry }
  | { type: 'SET_WATER'; date: string; count: number }
  | { type: 'LOG_MOOD'; date: string; entry: Partial<MoodEntry> }
  | { type: 'TOGGLE_FAVORITE'; foodId: string }
  | { type: 'SAVE_RECIPE'; recipe: Recipe }
  | { type: 'DELETE_RECIPE'; id: string }
  | { type: 'SAVE_TEMPLATE'; template: MealTemplate }
  | { type: 'DELETE_TEMPLATE'; id: string }
  | { type: 'START_FAST'; startedAt?: string; windowHours?: number }
  | { type: 'STOP_FAST' };

// ─── Micronutrient report ────────────────────────────────────────────────────

export interface MicronutrientReportItem {
  nutrient: string;
  key: string;
  avg: number;
  goal: number;
  unit: string;
  pct: number;
  status: 'ok' | 'low' | 'deficient' | 'high';
  higherIsBad?: boolean;
}

// ─── Feature flags ───────────────────────────────────────────────────────────

export interface FeatureFlags {
  barcodeScanning: boolean;
  aiCoach: boolean;
  photoRecognition: boolean;
  appleHealth: boolean;
  premiumTier: boolean;
  recipeUrlImport: boolean;
  voiceLog: boolean;
  ouraIntegration: boolean;
  restaurantDb: boolean;
  mealPlanning: boolean;
}
