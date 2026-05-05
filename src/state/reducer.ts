import type { AppState, Action, NutritionDay, MealSection, FoodItem } from '../types';
import { uid } from '../utils/helpers';

export const MEAL_SECTIONS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const defaultMeals = (): MealSection[] =>
  MEAL_SECTIONS.map(name => ({ name, items: [] }));

export const init: AppState = {
  tab: 'home',
  nutrition: [],
  body: [],
  water: {},
  mood: {},
  recipes: [],
  favorites: [],
  recents: [],
  templates: [],
  fasting: null,
  loaded: false,
  onboarded: false,
  units: 'lbs',
  goals: { cal: 2400, protein: 180, carbs: 250, fat: 70, fiber: 25, water: 8 },
  profile: {
    firstName: '', lastName: '', email: '', height: '', sex: '', dob: '',
    activityLevel: 'moderate', dietaryModes: [], allergens: [],
  },
};

function computeDayTotals(meals: MealSection[]) {
  const items = meals.flatMap(m => m.items || []);
  return {
    cal:     Math.round(items.reduce((s, i) => s + (i.cal || 0), 0)),
    protein: Math.round(items.reduce((s, i) => s + (i.protein || 0), 0)),
    carbs:   Math.round(items.reduce((s, i) => s + (i.carbs || 0), 0)),
    fat:     Math.round(items.reduce((s, i) => s + (i.fat || 0), 0)),
    fiber:   Math.round(items.reduce((s, i) => s + (i.fiber || 0), 0)),
    sodium:  Math.round(items.reduce((s, i) => s + (i.sodium || 0), 0)),
  };
}

function getOrCreateDay(nutrition: NutritionDay[], date: string): NutritionDay {
  const existing = nutrition.find(n => n.date === date);
  if (existing) return existing;
  return { id: uid(), date, meals: defaultMeals(), cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 };
}

function updateDay(
  nutrition: NutritionDay[],
  date: string,
  updater: (day: NutritionDay) => NutritionDay,
): NutritionDay[] {
  const day = getOrCreateDay(nutrition, date);
  const updated = updater(day);
  const totals = computeDayTotals(updated.meals);
  const final = { ...updated, ...totals };
  const exists = nutrition.some(n => n.date === date);
  const next = exists
    ? nutrition.map(n => (n.date === date ? final : n))
    : [final, ...nutrition];
  return next.sort((a, b) => b.date.localeCompare(a.date));
}

function addToRecents(recents: FoodItem[], item: FoodItem): FoodItem[] {
  const filtered = (recents || []).filter(r => r.id !== item.id);
  return [{ ...item }, ...filtered].slice(0, 30);
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    // ── Bootstrap ──
    case 'INIT': return { ...s, ...a.p, loaded: true };
    case 'IMPORT': return { ...s, ...a.data, loaded: true };
    case 'CLEAR_ALL': return { ...init, loaded: true, onboarded: true, profile: s.profile };
    case 'ONBOARDED': return { ...s, onboarded: true };

    // ── Navigation ──
    case 'TAB': return { ...s, tab: a.tab };

    // ── Profile / Goals ──
    case 'SET_PROFILE': return { ...s, profile: { ...(s.profile || {}), ...a.profile } };
    case 'GOALS': return { ...s, goals: { ...s.goals, ...a.g } };
    case 'UNITS': return { ...s, units: a.units };

    // ── Meal logging ──
    case 'ADD_MEAL_ITEM': {
      const nutrition = updateDay(s.nutrition, a.date, day => ({
        ...day,
        meals: day.meals.map(m =>
          m.name === a.sectionName
            ? { ...m, items: [...(m.items || []), { ...a.item, id: a.item.id || uid(), loggedAt: new Date().toISOString() }] }
            : m,
        ),
      }));
      return { ...s, nutrition, recents: addToRecents(s.recents, a.item) };
    }
    case 'EDIT_MEAL_ITEM': {
      const nutrition = updateDay(s.nutrition, a.date, day => ({
        ...day,
        meals: day.meals.map(m =>
          m.name === a.sectionName
            ? { ...m, items: (m.items || []).map(i => (i.id === a.item.id ? { ...i, ...a.item } : i)) }
            : m,
        ),
      }));
      return { ...s, nutrition };
    }
    case 'DELETE_MEAL_ITEM': {
      const nutrition = updateDay(s.nutrition, a.date, day => ({
        ...day,
        meals: day.meals.map(m =>
          m.name === a.sectionName
            ? { ...m, items: (m.items || []).filter(i => i.id !== a.itemId) }
            : m,
        ),
      }));
      return { ...s, nutrition };
    }
    case 'COPY_DAY': {
      const fromDay = s.nutrition.find(n => n.date === a.fromDate);
      if (!fromDay) return s;
      const clonedMeals = fromDay.meals.map(m => ({
        ...m,
        items: (m.items || []).map(i => ({ ...i, id: uid(), loggedAt: new Date().toISOString() })),
      }));
      const nutrition = updateDay(s.nutrition, a.toDate, day => ({ ...day, meals: clonedMeals }));
      return { ...s, nutrition };
    }

    // Legacy backwards-compat actions
    case 'ADD_N': {
      if (s.nutrition.some(n => n.id === a.n.id)) return s;
      return { ...s, nutrition: [a.n, ...s.nutrition].sort((a, b) => b.date.localeCompare(a.date)) };
    }
    case 'EDIT_N': return { ...s, nutrition: s.nutrition.map(n => (n.id === a.n.id ? a.n : n)) };
    case 'DEL_N': return { ...s, nutrition: s.nutrition.filter(n => n.id !== a.id) };

    // ── Body logging ──
    case 'LOG_BODY': {
      const entry = { id: uid(), ...a.entry };
      const exists = s.body.some(b => b.date === a.entry.date);
      const body = exists
        ? s.body.map(b => (b.date === a.entry.date ? { ...b, ...a.entry } : b))
        : [entry, ...s.body].sort((a, b) => b.date.localeCompare(a.date));
      return { ...s, body };
    }
    case 'ADD_PHOTO': {
      const body = s.body.some(b => b.date === a.date)
        ? s.body.map(b => (b.date === a.date ? { ...b, photoUrl: a.photoUrl } : b))
        : [{ id: uid(), date: a.date, photoUrl: a.photoUrl }, ...s.body].sort((a, b) => b.date.localeCompare(a.date));
      return { ...s, body };
    }
    case 'DEL_B': return { ...s, body: s.body.filter(b => b.id !== a.id) };
    case 'ADD_B': {
      if (s.body.some(b => b.id === a.b.id)) return s;
      return { ...s, body: [a.b, ...s.body].sort((a, b) => b.date.localeCompare(a.date)) };
    }

    // ── Water ──
    case 'SET_WATER': return { ...s, water: { ...s.water, [a.date]: a.count } };

    // ── Mood ──
    case 'LOG_MOOD': return { ...s, mood: { ...s.mood, [a.date]: { ...(s.mood[a.date] || {}), ...a.entry } } };

    // ── Favorites ──
    case 'TOGGLE_FAVORITE': {
      const id = a.foodId;
      const favs = s.favorites || [];
      return { ...s, favorites: favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id] };
    }

    // ── Recipes ──
    case 'SAVE_RECIPE': {
      const recipe = { ...a.recipe, id: a.recipe.id || uid(), createdAt: a.recipe.createdAt || new Date().toISOString() };
      const exists = (s.recipes || []).some(r => r.id === recipe.id);
      return {
        ...s,
        recipes: exists
          ? s.recipes.map(r => (r.id === recipe.id ? recipe : r))
          : [recipe, ...(s.recipes || [])],
      };
    }
    case 'DELETE_RECIPE': return { ...s, recipes: (s.recipes || []).filter(r => r.id !== a.id) };

    // ── Templates ──
    case 'SAVE_TEMPLATE': {
      const tmpl = { ...a.template, id: a.template.id || uid() };
      const exists = (s.templates || []).some(t => t.id === tmpl.id);
      return {
        ...s,
        templates: exists
          ? s.templates.map(t => (t.id === tmpl.id ? tmpl : t))
          : [tmpl, ...(s.templates || [])],
      };
    }
    case 'DELETE_TEMPLATE': return { ...s, templates: (s.templates || []).filter(t => t.id !== a.id) };

    // ── Fasting ──
    case 'START_FAST': return { ...s, fasting: { startedAt: a.startedAt || new Date().toISOString(), windowHours: a.windowHours || 16 } };
    case 'STOP_FAST': return { ...s, fasting: null };

    default: return s;
  }
}
