import React, { useState, useEffect } from 'react';
import { V } from '../utils/theme';
import { Sheet, Btn, Field, Card } from '../components/ui';
import { FoodDb } from '../utils/foodDb';
import { uid } from '../utils/helpers';
import { SuccessToastCtrl } from '../components/ui';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function MacroPill({ label, value, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, padding: '2px 6px', borderRadius: 6 }}>
      {value}{label}
    </span>
  );
}

export function RecipeBuilderSheet({ existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || '');
  const [servings, setServings] = useState(String(existing?.servings || 1));
  const [items, setItems] = useState(existing?.items || []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 350);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    FoodDb.search(debouncedQuery, { pageSize: 10 }).then(res => {
      if (!cancelled) { setResults(res); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const totalMacros = items.reduce((acc, item) => ({
    cal: acc.cal + (item.cal || 0),
    protein: acc.protein + (item.protein || 0),
    carbs: acc.carbs + (item.carbs || 0),
    fat: acc.fat + (item.fat || 0),
    fiber: acc.fiber + (item.fiber || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  const svgs = parseFloat(servings) || 1;
  const perServing = {
    cal: Math.round(totalMacros.cal / svgs),
    protein: Math.round(totalMacros.protein / svgs * 10) / 10,
    carbs: Math.round(totalMacros.carbs / svgs * 10) / 10,
    fat: Math.round(totalMacros.fat / svgs * 10) / 10,
    fiber: Math.round(totalMacros.fiber / svgs * 10) / 10,
  };

  const addIngredient = (food) => {
    setItems(prev => [...prev, { ...food, id: uid(), qty: food.servingG || 100, unit: 'g' }]);
    setQuery('');
    setResults([]);
  };

  const removeIngredient = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const updateQty = (id, qty) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const grams = parseFloat(qty) || i.servingG || 100;
      return { ...i, ...FoodDb.scale(i, grams), qty: parseFloat(qty) || grams };
    }));
  };

  const save = () => {
    if (!name.trim() || items.length === 0) return;
    onSave({
      id: existing?.id || uid(),
      name: name.trim(),
      servings: svgs,
      items,
      macros: { total: totalMacros, perServing },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    SuccessToastCtrl.show(existing ? 'Recipe updated' : 'Recipe saved');
    onClose();
  };

  return (
    <Sheet title={existing ? 'Edit Recipe' : 'New Recipe'} onClose={onClose}
      footer={
        <div style={{ padding: 16, display: 'flex', gap: 8 }}>
          <Btn v="secondary" full onClick={onClose}>Cancel</Btn>
          <Btn full onClick={save} disabled={!name.trim() || items.length === 0}>Save Recipe</Btn>
        </div>
      }>
      <Field label="Recipe Name" value={name} onChange={setName} placeholder="e.g. Protein Pancakes" autoFocus />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Field label="Servings" type="number" value={servings} onChange={setServings} inputMode="decimal" />
      </div>

      {/* Per-serving macros */}
      {items.length > 0 && (
        <Card style={{ padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: V.text3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Per Serving</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <MacroPill label=" kcal" value={perServing.cal} color={V.warn} />
            <MacroPill label="P" value={perServing.protein} color={V.accent} />
            <MacroPill label="C" value={perServing.carbs} color={V.accent2} />
            <MacroPill label="F" value={perServing.fat} color={V.warn} />
            {perServing.fiber > 0 && <MacroPill label="g Fiber" value={perServing.fiber} color={V.text2} />}
          </div>
        </Card>
      )}

      {/* Ingredients list */}
      {items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Ingredients</div>
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.text, lineHeight: 1.2 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: V.text3 }}>{item.cal} kcal · {item.protein}P</div>
              </div>
              <input type="number" value={item.qty} onChange={e => updateQty(item.id, e.target.value)}
                style={{ width: 60, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 8, color: V.text, fontSize: 12, textAlign: 'right' }} />
              <span style={{ fontSize: 10, color: V.text3 }}>g</span>
              <button onClick={() => removeIngredient(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.danger, fontSize: 16, padding: 2 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Ingredient search */}
      <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Add Ingredient</div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods…"
          style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 14, fontFamily: V.font, outline: 'none', boxSizing: 'border-box' }} />
        {loading && (
          <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: `2px solid ${V.accent}30`, borderTopColor: V.accent, borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {results.slice(0, 6).map(food => (
          <button key={food.id} onClick={() => addIngredient(food)}
            style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>{food.name}</div>
              {food.brand && <div style={{ fontSize: 10, color: V.text3 }}>{food.brand}</div>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <MacroPill label=" kcal" value={food.cal} color={V.warn} />
              <MacroPill label="P" value={food.protein} color={V.accent} />
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
