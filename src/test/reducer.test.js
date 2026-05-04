import { describe, it, expect, beforeEach } from 'vitest';
import { reducer, init, MEAL_SECTIONS } from '../state/reducer';

describe('reducer', () => {
  let state;
  beforeEach(() => { state = { ...init, loaded: true, onboarded: true }; });

  it('INIT merges persisted data', () => {
    const s = reducer(init, { type: 'INIT', p: { units: 'kg', onboarded: true } });
    expect(s.units).toBe('kg');
    expect(s.loaded).toBe(true);
  });

  it('TAB switches active tab', () => {
    const s = reducer(state, { type: 'TAB', tab: 'log' });
    expect(s.tab).toBe('log');
  });

  it('GOALS merges goal fields', () => {
    const s = reducer(state, { type: 'GOALS', g: { cal: 2000, protein: 150 } });
    expect(s.goals.cal).toBe(2000);
    expect(s.goals.protein).toBe(150);
    expect(s.goals.carbs).toBe(init.goals.carbs);
  });

  it('ADD_MEAL_ITEM creates a new day entry', () => {
    const item = { id: 'abc', name: 'Chicken', cal: 200, protein: 30, carbs: 0, fat: 5, fiber: 0, sodium: 100, qty: 100, unit: 'g', servingG: 100, source: 'usda' };
    const s = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-05-04', sectionName: 'Lunch', item });
    expect(s.nutrition).toHaveLength(1);
    const day = s.nutrition[0];
    expect(day.date).toBe('2026-05-04');
    expect(day.cal).toBe(200);
    expect(day.protein).toBe(30);
    const lunch = day.meals.find(m => m.name === 'Lunch');
    expect(lunch.items).toHaveLength(1);
    expect(lunch.items[0].name).toBe('Chicken');
  });

  it('ADD_MEAL_ITEM adds to recents', () => {
    const item = { id: 'abc', name: 'Egg', cal: 70, protein: 6, carbs: 0, fat: 5, fiber: 0, sodium: 60, qty: 1, unit: 'serving', servingG: 50, source: 'manual' };
    const s = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-05-04', sectionName: 'Breakfast', item });
    expect(s.recents).toHaveLength(1);
    expect(s.recents[0].name).toBe('Egg');
  });

  it('EDIT_MEAL_ITEM updates item in-place', () => {
    const item = { id: 'item1', name: 'Rice', cal: 200, protein: 4, carbs: 45, fat: 1, fiber: 1, sodium: 0, qty: 100, unit: 'g', servingG: 100 };
    const s1 = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-05-04', sectionName: 'Lunch', item });
    const s2 = reducer(s1, { type: 'EDIT_MEAL_ITEM', date: '2026-05-04', sectionName: 'Lunch', item: { ...item, cal: 220, name: 'Brown Rice' } });
    const lunch = s2.nutrition[0].meals.find(m => m.name === 'Lunch');
    expect(lunch.items[0].name).toBe('Brown Rice');
    expect(s2.nutrition[0].cal).toBe(220);
  });

  it('DELETE_MEAL_ITEM removes item and recomputes totals', () => {
    const item = { id: 'item2', name: 'Bread', cal: 100, protein: 3, carbs: 20, fat: 1, fiber: 2, sodium: 150, qty: 1, unit: 'slice', servingG: 40 };
    const s1 = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-05-04', sectionName: 'Breakfast', item });
    expect(s1.nutrition[0].cal).toBe(100);
    const s2 = reducer(s1, { type: 'DELETE_MEAL_ITEM', date: '2026-05-04', sectionName: 'Breakfast', itemId: 'item2' });
    expect(s2.nutrition[0].cal).toBe(0);
    const breakfast = s2.nutrition[0].meals.find(m => m.name === 'Breakfast');
    expect(breakfast.items).toHaveLength(0);
  });

  it('COPY_DAY clones meals with new ids', () => {
    const item = { id: 'orig', name: 'Oats', cal: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sodium: 0, qty: 100, unit: 'g', servingG: 100 };
    const s1 = reducer(state, { type: 'ADD_MEAL_ITEM', date: '2026-05-03', sectionName: 'Breakfast', item });
    const s2 = reducer(s1, { type: 'COPY_DAY', fromDate: '2026-05-03', toDate: '2026-05-04' });
    const today = s2.nutrition.find(n => n.date === '2026-05-04');
    expect(today).toBeTruthy();
    const breakfast = today.meals.find(m => m.name === 'Breakfast');
    expect(breakfast.items[0].name).toBe('Oats');
    expect(breakfast.items[0].id).not.toBe('orig');
  });

  it('LOG_BODY creates a new body entry', () => {
    const s = reducer(state, { type: 'LOG_BODY', entry: { date: '2026-05-04', weight: 180, bodyFat: 15, waist: 34 } });
    expect(s.body).toHaveLength(1);
    expect(s.body[0].weight).toBe(180);
    expect(s.body[0].waist).toBe(34);
  });

  it('LOG_BODY updates existing entry for same date', () => {
    const s1 = reducer(state, { type: 'LOG_BODY', entry: { date: '2026-05-04', weight: 180 } });
    const s2 = reducer(s1, { type: 'LOG_BODY', entry: { date: '2026-05-04', weight: 179.5, bodyFat: 14.8 } });
    expect(s2.body).toHaveLength(1);
    expect(s2.body[0].weight).toBe(179.5);
    expect(s2.body[0].bodyFat).toBe(14.8);
  });

  it('SET_WATER tracks water count per day', () => {
    const s = reducer(state, { type: 'SET_WATER', date: '2026-05-04', count: 6 });
    expect(s.water['2026-05-04']).toBe(6);
  });

  it('TOGGLE_FAVORITE adds and removes food ids', () => {
    const s1 = reducer(state, { type: 'TOGGLE_FAVORITE', foodId: 'usda-123' });
    expect(s1.favorites).toContain('usda-123');
    const s2 = reducer(s1, { type: 'TOGGLE_FAVORITE', foodId: 'usda-123' });
    expect(s2.favorites).not.toContain('usda-123');
  });

  it('SAVE_RECIPE creates and updates recipes', () => {
    const recipe = { id: 'r1', name: 'Protein Pancakes', items: [], servings: 2 };
    const s1 = reducer(state, { type: 'SAVE_RECIPE', recipe });
    expect(s1.recipes).toHaveLength(1);
    const s2 = reducer(s1, { type: 'SAVE_RECIPE', recipe: { ...recipe, name: 'Updated Pancakes' } });
    expect(s2.recipes).toHaveLength(1);
    expect(s2.recipes[0].name).toBe('Updated Pancakes');
  });

  it('START_FAST / STOP_FAST toggle fasting state', () => {
    const s1 = reducer(state, { type: 'START_FAST', windowHours: 18 });
    expect(s1.fasting).toBeTruthy();
    expect(s1.fasting.windowHours).toBe(18);
    const s2 = reducer(s1, { type: 'STOP_FAST' });
    expect(s2.fasting).toBeNull();
  });

  it('CLEAR_ALL resets state but preserves profile', () => {
    const s1 = reducer(state, { type: 'SET_PROFILE', profile: { firstName: 'Jane' } });
    const s2 = reducer(s1, { type: 'LOG_BODY', entry: { date: '2026-05-04', weight: 150 } });
    const s3 = reducer(s2, { type: 'CLEAR_ALL' });
    expect(s3.nutrition).toHaveLength(0);
    expect(s3.body).toHaveLength(0);
    expect(s3.profile.firstName).toBe('Jane');
  });
});
