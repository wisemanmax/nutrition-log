import { describe, it, expect } from 'vitest';
import { reducer, init, MEAL_SECTIONS } from '../state/reducer.ts';
import type { AppState, Action } from '../types';

function applyActions(actions: Action[], state: AppState = init): AppState {
  return actions.reduce((s, a) => reducer(s, a), state);
}

const TODAY = new Date().toISOString().split('T')[0];

describe('reducer — Bootstrap', () => {
  it('INIT sets loaded = true and merges partial state', () => {
    const s = reducer(init, { type: 'INIT', p: { units: 'kg' } });
    expect(s.loaded).toBe(true);
    expect(s.units).toBe('kg');
  });

  it('IMPORT merges data', () => {
    const s = reducer(init, { type: 'IMPORT', data: { onboarded: true } });
    expect(s.onboarded).toBe(true);
    expect(s.loaded).toBe(true);
  });

  it('CLEAR_ALL resets nutrition but keeps profile', () => {
    const withData = applyActions([
      { type: 'INIT', p: { profile: { firstName: 'Alice' } } },
      { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Breakfast', item: { id: 'a', name: 'Egg', cal: 80, protein: 6, carbs: 1, fat: 5, fiber: 0, sodium: 60, servingG: 50 } },
    ]);
    const cleared = reducer(withData, { type: 'CLEAR_ALL' });
    expect(cleared.nutrition).toHaveLength(0);
    expect(cleared.profile?.firstName).toBe('Alice');
  });
});

describe('reducer — Navigation', () => {
  it('TAB changes tab', () => {
    const s = reducer(init, { type: 'TAB', tab: 'trends' });
    expect(s.tab).toBe('trends');
  });
});

describe('reducer — Profile & Goals', () => {
  it('SET_PROFILE merges profile fields', () => {
    const s = reducer(init, { type: 'SET_PROFILE', profile: { firstName: 'Bob', allergens: ['dairy'] } });
    expect(s.profile?.firstName).toBe('Bob');
    expect(s.profile?.allergens).toContain('dairy');
  });

  it('GOALS merges goal fields', () => {
    const s = reducer(init, { type: 'GOALS', g: { cal: 3000, protein: 200 } });
    expect(s.goals.cal).toBe(3000);
    expect(s.goals.protein).toBe(200);
    expect(s.goals.fat).toBe(70); // unchanged
  });

  it('UNITS changes units', () => {
    const s = reducer(init, { type: 'UNITS', units: 'kg' });
    expect(s.units).toBe('kg');
  });
});

describe('reducer — Meal logging', () => {
  const baseItem = { id: 'item1', name: 'Chicken Breast', cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sodium: 74, servingG: 100 };

  it('ADD_MEAL_ITEM creates day if missing and computes totals', () => {
    const s = reducer(init, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Lunch', item: baseItem });
    const day = s.nutrition.find(n => n.date === TODAY)!;
    expect(day).toBeDefined();
    expect(day.cal).toBe(165);
    expect(day.protein).toBe(31);
    const lunchSection = day.meals.find(m => m.name === 'Lunch')!;
    expect(lunchSection.items).toHaveLength(1);
    expect(lunchSection.items[0].name).toBe('Chicken Breast');
  });

  it('ADD_MEAL_ITEM adds to recents', () => {
    const s = reducer(init, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Breakfast', item: baseItem });
    expect(s.recents).toHaveLength(1);
    expect(s.recents[0].name).toBe('Chicken Breast');
  });

  it('recents are capped at 30', () => {
    let s = init;
    for (let i = 0; i < 35; i++) {
      s = reducer(s, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Snacks', item: { ...baseItem, id: `item${i}`, name: `Food${i}` } });
    }
    expect(s.recents.length).toBe(30);
  });

  it('EDIT_MEAL_ITEM updates item and recomputes totals', () => {
    let s = reducer(init, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Lunch', item: baseItem });
    s = reducer(s, { type: 'EDIT_MEAL_ITEM', date: TODAY, sectionName: 'Lunch', item: { ...baseItem, cal: 200 } });
    const day = s.nutrition.find(n => n.date === TODAY)!;
    expect(day.cal).toBe(200);
  });

  it('DELETE_MEAL_ITEM removes item and recomputes totals', () => {
    let s = reducer(init, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Lunch', item: baseItem });
    s = reducer(s, { type: 'DELETE_MEAL_ITEM', date: TODAY, sectionName: 'Lunch', itemId: 'item1' });
    const day = s.nutrition.find(n => n.date === TODAY)!;
    expect(day.cal).toBe(0);
    const lunch = day.meals.find(m => m.name === 'Lunch')!;
    expect(lunch.items).toHaveLength(0);
  });

  it('COPY_DAY clones meals with new ids', () => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split('T')[0];
    let s = reducer(init, { type: 'ADD_MEAL_ITEM', date: yDate, sectionName: 'Breakfast', item: baseItem });
    s = reducer(s, { type: 'COPY_DAY', fromDate: yDate, toDate: TODAY });
    const todayDay = s.nutrition.find(n => n.date === TODAY)!;
    expect(todayDay.cal).toBe(165);
    const breakfast = todayDay.meals.find(m => m.name === 'Breakfast')!;
    expect(breakfast.items[0].id).not.toBe('item1'); // cloned with new id
  });
});

describe('reducer — Body logging', () => {
  it('LOG_BODY creates entry', () => {
    const s = reducer(init, { type: 'LOG_BODY', entry: { date: TODAY, weight: 180, bodyFat: 15, neck: null, waist: null, hip: null } });
    expect(s.body).toHaveLength(1);
    expect(s.body[0].weight).toBe(180);
  });

  it('LOG_BODY updates existing entry for same date', () => {
    let s = reducer(init, { type: 'LOG_BODY', entry: { date: TODAY, weight: 180, bodyFat: null, neck: null, waist: null, hip: null } });
    s = reducer(s, { type: 'LOG_BODY', entry: { date: TODAY, weight: 182, bodyFat: 16, neck: null, waist: null, hip: null } });
    expect(s.body).toHaveLength(1);
    expect(s.body[0].weight).toBe(182);
  });

  it('ADD_PHOTO attaches photo to body entry', () => {
    let s = reducer(init, { type: 'LOG_BODY', entry: { date: TODAY, weight: 180, bodyFat: null, neck: null, waist: null, hip: null } });
    s = reducer(s, { type: 'ADD_PHOTO', date: TODAY, photoUrl: 'data:image/png;base64,abc' });
    expect(s.body[0].photoUrl).toBe('data:image/png;base64,abc');
  });

  it('DEL_B removes entry', () => {
    let s = reducer(init, { type: 'LOG_BODY', entry: { date: TODAY, weight: 180, bodyFat: null, neck: null, waist: null, hip: null } });
    const id = s.body[0].id;
    s = reducer(s, { type: 'DEL_B', id });
    expect(s.body).toHaveLength(0);
  });
});

describe('reducer — Water', () => {
  it('SET_WATER updates water count for date', () => {
    const s = reducer(init, { type: 'SET_WATER', date: TODAY, count: 6 });
    expect(s.water[TODAY]).toBe(6);
  });
});

describe('reducer — Mood', () => {
  it('LOG_MOOD merges mood entry', () => {
    let s = reducer(init, { type: 'LOG_MOOD', date: TODAY, entry: { mood: 4, energy: 3 } });
    s = reducer(s, { type: 'LOG_MOOD', date: TODAY, entry: { digestion: 5 } });
    expect(s.mood[TODAY].mood).toBe(4);
    expect(s.mood[TODAY].digestion).toBe(5);
  });
});

describe('reducer — Favorites', () => {
  it('TOGGLE_FAVORITE adds and removes', () => {
    let s = reducer(init, { type: 'TOGGLE_FAVORITE', foodId: 'food1' });
    expect(s.favorites).toContain('food1');
    s = reducer(s, { type: 'TOGGLE_FAVORITE', foodId: 'food1' });
    expect(s.favorites).not.toContain('food1');
  });
});

describe('reducer — Recipes', () => {
  const recipe = { id: 'r1', name: 'Pancakes', items: [], servings: 4, macros: { total: {}, perServing: {} } };

  it('SAVE_RECIPE adds a new recipe', () => {
    const s = reducer(init, { type: 'SAVE_RECIPE', recipe });
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].name).toBe('Pancakes');
  });

  it('SAVE_RECIPE updates existing recipe', () => {
    let s = reducer(init, { type: 'SAVE_RECIPE', recipe });
    s = reducer(s, { type: 'SAVE_RECIPE', recipe: { ...recipe, name: 'Updated Pancakes' } });
    expect(s.recipes).toHaveLength(1);
    expect(s.recipes[0].name).toBe('Updated Pancakes');
  });

  it('DELETE_RECIPE removes it', () => {
    let s = reducer(init, { type: 'SAVE_RECIPE', recipe });
    s = reducer(s, { type: 'DELETE_RECIPE', id: 'r1' });
    expect(s.recipes).toHaveLength(0);
  });
});

describe('reducer — Templates', () => {
  const template = { id: 't1', name: 'Bulk Day', meals: [] };

  it('SAVE_TEMPLATE adds template', () => {
    const s = reducer(init, { type: 'SAVE_TEMPLATE', template });
    expect(s.templates).toHaveLength(1);
  });

  it('DELETE_TEMPLATE removes template', () => {
    let s = reducer(init, { type: 'SAVE_TEMPLATE', template });
    s = reducer(s, { type: 'DELETE_TEMPLATE', id: 't1' });
    expect(s.templates).toHaveLength(0);
  });
});

describe('reducer — Fasting', () => {
  it('START_FAST sets fasting state', () => {
    const s = reducer(init, { type: 'START_FAST', windowHours: 18 });
    expect(s.fasting?.windowHours).toBe(18);
    expect(s.fasting?.startedAt).toBeDefined();
  });

  it('STOP_FAST clears fasting', () => {
    let s = reducer(init, { type: 'START_FAST', windowHours: 16 });
    s = reducer(s, { type: 'STOP_FAST' });
    expect(s.fasting).toBeNull();
  });
});

describe('reducer — day totals', () => {
  it('computes totals across all sections', () => {
    const egg = { id: 'e1', name: 'Egg', cal: 70, protein: 6, carbs: 0, fat: 5, fiber: 0, sodium: 60, servingG: 50 };
    const oats = { id: 'o1', name: 'Oats', cal: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sodium: 5, servingG: 100 };
    let s = reducer(init, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Breakfast', item: egg });
    s = reducer(s, { type: 'ADD_MEAL_ITEM', date: TODAY, sectionName: 'Breakfast', item: oats });
    const day = s.nutrition.find(n => n.date === TODAY)!;
    expect(day.cal).toBe(220);
    expect(day.protein).toBe(11);
    expect(day.fiber).toBe(4);
  });
});
