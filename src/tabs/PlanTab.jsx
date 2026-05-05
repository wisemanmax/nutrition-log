import React, { useState, useMemo, useCallback } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn, Sheet, SuccessToastCtrl } from '../components/ui';
import { uid } from '../utils/helpers';
import { LS } from '../utils/storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const SLOT_ICONS = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snacks: '🍎' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayDates() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function loadPlan() {
  return LS.get('nl-meal-plan') || {};
}

function savePlan(plan) {
  LS.set('nl-meal-plan', plan);
}

// Aggregate grocery items from all recipes in a plan
function buildGroceryList(plan, recipes) {
  const items = {};
  Object.values(plan).forEach(dayPlan => {
    SLOTS.forEach(slot => {
      const entry = dayPlan[slot];
      if (!entry) return;
      if (entry.type === 'recipe' && entry.recipeId) {
        const recipe = recipes.find(r => r.id === entry.recipeId);
        if (recipe) {
          recipe.items.forEach(item => {
            const key = item.name.toLowerCase();
            if (!items[key]) items[key] = { name: item.name, servings: 0, unit: 'serving' };
            items[key].servings += 1;
          });
        }
      } else if (entry.type === 'custom' && entry.name) {
        const key = entry.name.toLowerCase();
        if (!items[key]) items[key] = { name: entry.name, servings: 0, unit: 'serving' };
        items[key].servings += 1;
      }
    });
  });
  return Object.values(items).sort((a, b) => a.name.localeCompare(b.name));
}

// Sum macros for a plan entry
function entryMacros(entry, recipes) {
  if (!entry) return null;
  if (entry.type === 'recipe' && entry.recipeId) {
    const recipe = recipes.find(r => r.id === entry.recipeId);
    return recipe?.macros?.perServing || null;
  }
  if (entry.macros) return entry.macros;
  return null;
}

// ─── Slot picker sheet ────────────────────────────────────────────────────────

function SlotPicker({ date, slot, recipes, templates, nutrition, onSave, onClear, onClose }) {
  const [tab, setTab] = useState('recipes');
  const [customName, setCustomName] = useState('');
  const [customCal, setCustomCal] = useState('');
  const [customProt, setCustomProt] = useState('');

  // Find logged meals for this date from nutrition log
  const loggedDay = nutrition.find(n => n.date === date);
  const loggedSection = loggedDay?.meals.find(m => m.name === slot);

  const tabs = [
    { id: 'recipes', label: 'Recipes' },
    { id: 'templates', label: 'Templates' },
    { id: 'logged', label: 'From Log' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <Sheet title={`${SLOT_ICONS[slot]} ${slot} — ${date}`} onClose={onClose}
      footer={
        <div style={{ padding: 16, display: 'flex', gap: 8 }}>
          {tab === 'custom' && (
            <Btn full onClick={() => {
              if (!customName.trim()) return;
              onSave({ type: 'custom', name: customName.trim(), macros: { cal: parseInt(customCal) || 0, protein: parseInt(customProt) || 0 } });
            }}>Add</Btn>
          )}
          <Btn v="secondary" full onClick={onClear}>Clear Slot</Btn>
        </div>
      }
    >
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, padding: '0 4px' }} role="tablist">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, fontWeight: tab === t.id ? 700 : 500,
              border: 'none', background: tab === t.id ? `${V.accent}20` : 'transparent',
              color: tab === t.id ? V.accent : V.text3, cursor: 'pointer', fontFamily: V.font }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recipes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recipes.length === 0 && (
            <div style={{ fontSize: 12, color: V.text3, textAlign: 'center', padding: 20 }}>
              No recipes yet. Add recipes in Settings.
            </div>
          )}
          {recipes.map(r => (
            <button key={r.id} onClick={() => onSave({ type: 'recipe', recipeId: r.id, name: r.name })}
              style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                background: V.card, cursor: 'pointer', fontFamily: V.font }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{r.name}</div>
              <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>
                {r.macros?.perServing?.cal} kcal · {r.macros?.perServing?.protein}g protein · {r.servings} servings
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.length === 0 && (
            <div style={{ fontSize: 12, color: V.text3, textAlign: 'center', padding: 20 }}>
              No templates yet. Save meal templates from the Log tab.
            </div>
          )}
          {templates.map(t => (
            <button key={t.id} onClick={() => onSave({ type: 'template', templateId: t.id, name: t.name })}
              style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                background: V.card, cursor: 'pointer', fontFamily: V.font }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{t.name}</div>
              <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>Meal template</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'logged' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!loggedSection || loggedSection.items.length === 0 ? (
            <div style={{ fontSize: 12, color: V.text3, textAlign: 'center', padding: 20 }}>
              No items logged for {slot} on this date.
            </div>
          ) : (
            <>
              <button onClick={() => onSave({
                type: 'logged', name: `${slot} (${date})`,
                macros: { cal: loggedSection.items.reduce((s, i) => s + (i.cal || 0), 0), protein: loggedSection.items.reduce((s, i) => s + (i.protein || 0), 0) },
              })}
                style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 10, border: `1px solid ${V.accent}40`,
                  background: `${V.accent}10`, cursor: 'pointer', fontFamily: V.font }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>Use logged {slot}</div>
                <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>
                  {loggedSection.items.length} items · {loggedSection.items.reduce((s, i) => s + (i.cal || 0), 0)} kcal
                </div>
              </button>
              {loggedSection.items.map(item => (
                <div key={item.id} style={{ fontSize: 11, color: V.text2, padding: '4px 8px' }}>
                  • {item.name} — {item.cal} kcal
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>Meal name</div>
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Chicken & Rice"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                background: 'rgba(255,255,255,0.05)', color: V.text, fontSize: 13, fontFamily: V.font, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>Calories</div>
              <input type="number" value={customCal} onChange={e => setCustomCal(e.target.value)}
                placeholder="0" inputMode="numeric"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                  background: 'rgba(255,255,255,0.05)', color: V.text, fontSize: 13, fontFamily: V.font, boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>Protein (g)</div>
              <input type="number" value={customProt} onChange={e => setCustomProt(e.target.value)}
                placeholder="0" inputMode="numeric"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                  background: 'rgba(255,255,255,0.05)', color: V.text, fontSize: 13, fontFamily: V.font, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ─── Grocery list sheet ───────────────────────────────────────────────────────

function GroceryListSheet({ groceryItems, onClose }) {
  const [checked, setChecked] = useState({});

  const toggle = (name) => setChecked(c => ({ ...c, [name]: !c[name] }));

  const unchecked = groceryItems.filter(i => !checked[i.name]);
  const checkedItems = groceryItems.filter(i => checked[i.name]);

  const copyToClipboard = () => {
    const text = unchecked.map(i => `□ ${i.name}`).join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => SuccessToastCtrl.show('Copied to clipboard'));
    }
  };

  return (
    <Sheet title="🛒 Grocery List" onClose={onClose}
      footer={
        <div style={{ padding: 16, display: 'flex', gap: 8 }}>
          <Btn full onClick={copyToClipboard}>Copy to Clipboard</Btn>
          <Btn v="secondary" onClick={() => setChecked({})}>Reset</Btn>
        </div>
      }
    >
      {groceryItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, fontSize: 13, color: V.text3 }}>
          No items in plan yet. Add recipes to your plan first.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: V.text3, marginBottom: 10 }}>
            {unchecked.length} items remaining
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {unchecked.map(item => (
              <button key={item.name} onClick={() => toggle(item.name)}
                aria-label={`Mark ${item.name} as bought`}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: `1px solid ${V.cardBorder}`,
                  background: V.card, cursor: 'pointer', fontFamily: V.font }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${V.cardBorder}`, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: V.text }}>{item.name}</span>
              </button>
            ))}
            {checkedItems.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: V.text3, margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Done ({checkedItems.length})
                </div>
                {checkedItems.map(item => (
                  <button key={item.name} onClick={() => toggle(item.name)}
                    aria-label={`Unmark ${item.name}`}
                    style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, border: `1px solid ${V.cardBorder}20`,
                      background: 'transparent', cursor: 'pointer', fontFamily: V.font }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${V.accent}`, background: `${V.accent}30`, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: V.accent }}>✓</div>
                    <span style={{ fontSize: 13, color: V.text3, textDecoration: 'line-through' }}>{item.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}

// ─── PlanTab ──────────────────────────────────────────────────────────────────

export function PlanTab({ s }) {
  const weekDates = useMemo(() => getMondayDates(), []);
  const [selectedDay, setSelectedDay] = useState(0);
  const [plan, setPlan] = useState(loadPlan);
  const [pickingSlot, setPickingSlot] = useState(null); // { date, slot }
  const [showGrocery, setShowGrocery] = useState(false);

  const recipes = s.recipes || [];
  const templates = s.templates || [];
  const goals = s.goals || {};

  const updateSlot = useCallback((date, slot, entry) => {
    setPlan(prev => {
      const next = {
        ...prev,
        [date]: { ...(prev[date] || {}), [slot]: entry },
      };
      savePlan(next);
      return next;
    });
    setPickingSlot(null);
    Haptic.light();
    SuccessToastCtrl.show(`${slot} planned`);
  }, []);

  const clearSlot = useCallback((date, slot) => {
    setPlan(prev => {
      const dayPlan = { ...(prev[date] || {}) };
      delete dayPlan[slot];
      const next = { ...prev, [date]: dayPlan };
      savePlan(next);
      return next;
    });
    setPickingSlot(null);
  }, []);

  const clearDay = (date) => {
    setPlan(prev => {
      const next = { ...prev };
      delete next[date];
      savePlan(next);
      return next;
    });
  };

  // Day totals
  const dayTotals = useMemo(() => {
    return weekDates.map(date => {
      const dayPlan = plan[date] || {};
      let cal = 0, protein = 0;
      SLOTS.forEach(slot => {
        const m = entryMacros(dayPlan[slot], recipes);
        if (m) { cal += m.cal || 0; protein += m.protein || 0; }
      });
      return { date, cal: Math.round(cal), protein: Math.round(protein) };
    });
  }, [plan, weekDates, recipes]);

  const groceryItems = useMemo(() => buildGroceryList(plan, recipes), [plan, recipes]);

  const selectedDate = weekDates[selectedDay];
  const dayPlan = plan[selectedDate] || {};
  const todayTotals = dayTotals[selectedDay];
  const calGoal = goals.cal || 2400;
  const protGoal = goals.protein || 180;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>Meal Plan</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn v="ghost" onClick={() => setShowGrocery(true)}
            aria-label="View grocery list"
            style={{ padding: '6px 10px', fontSize: 12 }}>
            🛒 Grocery
            {groceryItems.length > 0 && (
              <span style={{ marginLeft: 5, background: V.accent, color: '#060a0e', borderRadius: 10, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                {groceryItems.length}
              </span>
            )}
          </Btn>
        </div>
      </div>

      {/* Weekly mini-overview */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}
        role="tablist" aria-label="Select day">
        {weekDates.map((date, i) => {
          const t = dayTotals[i];
          const hasData = SLOTS.some(slot => dayPlan[slot]) && selectedDay === i
            || SLOTS.some(slot => (plan[date] || {})[slot]);
          const pct = Math.min(100, Math.round((t.cal / calGoal) * 100));
          const isToday = date === new Date().toISOString().split('T')[0];
          const isSelected = i === selectedDay;
          return (
            <button key={date} role="tab" aria-selected={isSelected}
              aria-label={`${DAYS[i]}, ${date}${isToday ? ', today' : ''}`}
              onClick={() => setSelectedDay(i)}
              style={{ flex: '1 0 40px', minWidth: 40, padding: '8px 4px', borderRadius: 10, border: `1px solid ${isSelected ? V.accent : V.cardBorder}`,
                background: isSelected ? `${V.accent}15` : 'transparent', cursor: 'pointer', fontFamily: V.font,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: isSelected ? V.accent : V.text3, textTransform: 'uppercase' }}>
                {DAYS[i]}
              </div>
              {isToday && <div style={{ width: 4, height: 4, borderRadius: 2, background: V.accent }} />}
              {/* Calorie fill bar */}
              <div style={{ width: '100%', height: 3, borderRadius: 2, background: `${V.cardBorder}`, overflow: 'hidden' }}>
                {hasData && (
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2,
                    background: pct > 100 ? V.warn : V.accent, transition: 'width .3s' }} />
                )}
              </div>
              <div style={{ fontSize: 8, color: V.text3, fontFamily: V.mono }}>
                {t.cal > 0 ? `${t.cal}` : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: V.text }}>
            {DAYS[selectedDay]} — {selectedDate}
          </div>
          <div style={{ fontSize: 11, color: V.text3 }}>
            {todayTotals.cal} / {calGoal} kcal · {todayTotals.protein} / {protGoal}g protein
          </div>
        </div>
        {SLOTS.some(slot => dayPlan[slot]) && (
          <button onClick={() => clearDay(selectedDate)}
            aria-label="Clear this day's plan"
            style={{ fontSize: 11, color: V.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: V.font }}>
            Clear day
          </button>
        )}
      </div>

      {/* Macro progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Calories', val: todayTotals.cal, goal: calGoal, unit: 'kcal', color: V.warn },
          { label: 'Protein', val: todayTotals.protein, goal: protGoal, unit: 'g', color: V.accent },
        ].map(({ label, val, goal, unit, color }) => {
          const pct = Math.min(100, Math.round((val / goal) * 100));
          return (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: V.text3, marginBottom: 3 }}>
                <span>{label}</span>
                <span style={{ fontFamily: V.mono }}>{val} / {goal} {unit}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: `${color}20`, overflow: 'hidden' }}
                role="meter" aria-valuenow={val} aria-valuemin={0} aria-valuemax={goal} aria-label={`${label} ${val} of ${goal} ${unit}`}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Meal slots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SLOTS.map(slot => {
          const entry = dayPlan[slot];
          return (
            <Card key={slot} style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                    {SLOT_ICONS[slot]} {slot}
                  </div>
                  {entry ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{entry.name}</div>
                      {(() => {
                        const m = entryMacros(entry, recipes);
                        return m ? (
                          <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>
                            {m.cal || 0} kcal · {m.protein || 0}g protein
                          </div>
                        ) : null;
                      })()}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: V.text3, fontStyle: 'italic' }}>Not planned</div>
                  )}
                </div>
                <button
                  onClick={() => setPickingSlot({ date: selectedDate, slot })}
                  aria-label={entry ? `Edit ${slot}` : `Add ${slot}`}
                  style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${V.cardBorder}`,
                    background: 'transparent', color: V.text3, cursor: 'pointer', fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {entry ? '✏️' : '+'}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Weekly summary */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Week Summary
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dayTotals.map(({ date, cal, protein }, i) => {
            const pct = Math.min(100, Math.round((cal / calGoal) * 100));
            const isToday = date === new Date().toISOString().split('T')[0];
            return (
              <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, fontSize: 10, fontWeight: 700, color: isToday ? V.accent : V.text3 }}>
                  {DAYS[i]}
                </div>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: `${V.cardBorder}`, overflow: 'hidden' }}>
                  {cal > 0 && (
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3,
                      background: pct > 100 ? V.warn : V.accent }} />
                  )}
                </div>
                <div style={{ width: 60, textAlign: 'right', fontSize: 10, color: V.text3, fontFamily: V.mono }}>
                  {cal > 0 ? `${cal} kcal` : '—'}
                </div>
              </div>
            );
          })}
        </div>
        {groceryItems.length > 0 && (
          <button onClick={() => setShowGrocery(true)}
            style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 10, border: `1px solid ${V.accent}30`,
              background: `${V.accent}10`, color: V.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: V.font }}>
            🛒 View Grocery List ({groceryItems.length} items)
          </button>
        )}
      </Card>

      {/* Slot picker sheet */}
      {pickingSlot && (
        <SlotPicker
          date={pickingSlot.date}
          slot={pickingSlot.slot}
          recipes={recipes}
          templates={templates}
          nutrition={s.nutrition || []}
          onSave={(entry) => updateSlot(pickingSlot.date, pickingSlot.slot, entry)}
          onClear={() => clearSlot(pickingSlot.date, pickingSlot.slot)}
          onClose={() => setPickingSlot(null)}
        />
      )}

      {/* Grocery list sheet */}
      {showGrocery && (
        <GroceryListSheet
          groceryItems={groceryItems}
          onClose={() => setShowGrocery(false)}
        />
      )}
    </div>
  );
}
