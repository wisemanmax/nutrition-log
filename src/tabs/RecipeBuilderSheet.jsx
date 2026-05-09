import React, { useState, useEffect } from 'react';
import { V } from '../utils/theme';
import { Sheet, Btn, Field, Card } from '../components/ui';
import { FoodDb } from '../utils/foodDb';
import { uid } from '../utils/helpers';
import { SuccessToastCtrl } from '../components/ui';
import { Flags } from '../utils/flags';

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

// ─── Ingredient quantity parser ───────────────────────────────────────────────
// Extracts grams estimate and clean food name from raw ingredient strings.

const UNIT_TO_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6,
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  ml: 1, milliliter: 1,
};

const FRACTION_MAP = { '½': 0.5, '⅓': 0.333, '⅔': 0.667, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

function parseIngredient(raw) {
  // Normalize unicode fractions
  let str = raw.trim();
  Object.entries(FRACTION_MAP).forEach(([f, v]) => { str = str.replace(new RegExp(f, 'g'), ` ${v}`); });

  // Match pattern: [number] [unit] [food name]
  const m = str.match(/^([\d./ ]+)\s*([a-zA-Z]+)?\s+(.+)/);
  if (!m) return { raw, searchName: str, servingG: 100 };

  const qty = m[1].trim().includes('/') ? (() => {
    const [n, d] = m[1].trim().split('/');
    return parseFloat(n) / parseFloat(d);
  })() : parseFloat(m[1].trim()) || 1;

  const unit = (m[2] || '').toLowerCase();
  const name = m[3]?.split(',')[0]?.trim() || str; // take part before first comma

  const grams = UNIT_TO_G[unit] ? Math.round(qty * UNIT_TO_G[unit]) : 100;

  return { raw, searchName: name, servingG: Math.max(1, grams) };
}

// ─── Schema.org Recipe JSON-LD parser ────────────────────────────────────────

function parseSchemaOrgRecipe(jsonLd) {
  const data = Array.isArray(jsonLd) ? jsonLd.find(d => d['@type'] === 'Recipe') : jsonLd;
  if (!data || data['@type'] !== 'Recipe') return null;

  const ingredients = (data.recipeIngredient || []).map(raw => {
    const { searchName, servingG } = parseIngredient(raw);
    return {
      raw,
      id: uid(),
      name: searchName,
      qty: servingG, servingG,
      cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0,
      source: 'manual',
    };
  });

  const yields = data.recipeYield;
  const servings = (() => {
    if (!yields) return 1;
    const n = parseInt(Array.isArray(yields) ? yields[0] : yields);
    return isNaN(n) ? 1 : n;
  })();

  // Resolve image — schema.org image can be string, array, or object
  const rawImg = data.image;
  const image = typeof rawImg === 'string' ? rawImg
    : Array.isArray(rawImg) ? (typeof rawImg[0] === 'string' ? rawImg[0] : rawImg[0]?.url || '')
    : rawImg?.url || '';

  return {
    name: data.name || '',
    description: data.description || '',
    servings,
    ingredients,
    rawIngredients: data.recipeIngredient || [],
    sourceUrl: data.url || '',
    image,
    cookTime: data.totalTime || data.cookTime || '',
  };
}

// Try to extract JSON-LD from HTML text
function extractJsonLdFromHtml(html) {
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]);
      // Handle @graph arrays
      if (parsed['@graph']) {
        const recipe = parsed['@graph'].find(n => n['@type'] === 'Recipe');
        if (recipe) return recipe;
      }
      if (Array.isArray(parsed)) {
        const recipe = parsed.find(n => n['@type'] === 'Recipe');
        if (recipe) return recipe;
      }
      if (parsed['@type'] === 'Recipe') return parsed;
    } catch { /* next */ }
  }
  return null;
}

// ─── URL import sheet ─────────────────────────────────────────────────────────

function UrlImportSheet({ onImport, onClose }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  const fetchRecipe = async () => {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      setError('Please enter a valid URL starting with https://');
      return;
    }
    setLoading(true);
    setError('');
    setPreview(null);

    // Multiple CORS proxies — try in order
    const PROXIES = [
      (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    ];

    let html = null;
    for (const makeProxy of PROXIES) {
      try {
        const res = await fetch(makeProxy(trimmed), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const d = await res.json();
          html = d.contents || d.data || null;
        } else {
          html = await res.text();
        }
        if (html) break;
      } catch { continue; }
    }

    if (!html) {
      setError('Could not fetch the page. Check the URL and try again.');
      setLoading(false);
      return;
    }

    const jsonLd = extractJsonLdFromHtml(html);
    if (!jsonLd) {
      setError('No recipe data found on this page. Try a site like AllRecipes, NYT Cooking, or Serious Eats.');
      setLoading(false);
      return;
    }

    const parsed = parseSchemaOrgRecipe(jsonLd);
    if (!parsed) {
      setError('Could not parse the recipe format from this page.');
      setLoading(false);
      return;
    }
    setPreview(parsed);
    setLoading(false);
  };

  return (
    <Sheet title="Import Recipe from URL" onClose={onClose}
      footer={
        <div style={{ padding: 16 }}>
          {preview ? (
            <Btn full onClick={() => { onImport(preview); onClose(); }}>
              Import Recipe
            </Btn>
          ) : (
            <Btn full onClick={fetchRecipe} disabled={!url.trim() || loading}>
              {loading ? 'Fetching…' : 'Fetch Recipe'}
            </Btn>
          )}
        </div>
      }>
      <Field
        label="Recipe URL"
        type="url"
        value={url}
        onChange={setUrl}
        placeholder="https://www.allrecipes.com/recipe/..."
        autoFocus
      />
      <div style={{ fontSize: 10, color: V.text3, marginBottom: 12 }}>
        Works with sites that use standard recipe markup (AllRecipes, NYT Cooking, Serious Eats, etc.)
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: V.text3, fontSize: 12 }}>
          <div style={{ display: 'inline-block', width: 20, height: 20, border: `2px solid ${V.accent}30`, borderTopColor: V.accent, borderRadius: '50%', animation: 'spin .6s linear infinite', marginBottom: 8 }} />
          <div>Fetching recipe…</div>
        </div>
      )}

      {error && (
        <div style={{ background: `${V.danger}10`, border: `1px solid ${V.danger}30`, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: V.danger }}>
          {error}
        </div>
      )}

      {preview && (
        <Card style={{ padding: 12 }}>
          {preview.image && (
            <img src={preview.image} alt={preview.name} style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 160, marginBottom: 10 }} />
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color: V.text, marginBottom: 4 }}>{preview.name}</div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: V.text3, marginBottom: 8 }}>
            <span>{preview.servings} serving{preview.servings !== 1 ? 's' : ''}</span>
            {preview.cookTime && <span>· {preview.cookTime.replace(/PT|M/g, ' ').trim()}</span>}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Ingredients ({preview.rawIngredients.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {preview.rawIngredients.slice(0, 8).map((ing, i) => (
              <div key={i} style={{ fontSize: 11, color: V.text2, padding: '3px 0', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                • {ing}
              </div>
            ))}
            {preview.rawIngredients.length > 8 && (
              <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>
                +{preview.rawIngredients.length - 8} more…
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, color: V.text3, marginTop: 10, padding: '6px 8px', background: `${V.warn}08`, borderRadius: 6, border: `1px solid ${V.warn}20` }}>
            ⚠️ Nutrition data from imported recipes needs to be added manually. Use the ingredient search to look up macros.
          </div>
        </Card>
      )}
    </Sheet>
  );
}

// ─── Recipe Builder Sheet ─────────────────────────────────────────────────────

export function RecipeBuilderSheet({ existing, onSave, onClose }) {
  const [name, setName] = useState(existing?.name || '');
  const [servings, setServings] = useState(String(existing?.servings || 1));
  const [items, setItems] = useState(existing?.items || []);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUrlImport, setShowUrlImport] = useState(false);
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

  const handleUrlImport = (parsed) => {
    if (parsed.name && !name) setName(parsed.name);
    if (parsed.servings) setServings(String(parsed.servings));
    // Imported raw ingredients become searchable stubs — user fills in nutrition
    const stubs = parsed.rawIngredients.map(raw => ({
      id: uid(), name: raw, cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
      sodium: 0, servingG: 100, qty: 100, unit: 'g', source: 'manual',
    }));
    setItems(prev => [...prev, ...stubs]);
    SuccessToastCtrl.show(`Imported ${parsed.rawIngredients.length} ingredients — add nutrition via search`);
  };

  const save = () => {
    if (!name.trim() || items.length === 0) return;
    onSave({
      id: existing?.id || uid(),
      name: name.trim(),
      servings: svgs,
      items,
      notes: notes.trim(),
      macros: { total: totalMacros, perServing },
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    SuccessToastCtrl.show(existing ? 'Recipe updated' : 'Recipe saved');
    onClose();
  };

  return (
    <>
      <Sheet title={existing ? 'Edit Recipe' : 'New Recipe'} onClose={onClose}
        footer={
          <div style={{ padding: 16, display: 'flex', gap: 8 }}>
            <Btn v="secondary" full onClick={onClose}>Cancel</Btn>
            <Btn full onClick={save} disabled={!name.trim() || items.length === 0}>Save Recipe</Btn>
          </div>
        }>

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1 }}>
            <Field label="Recipe Name" value={name} onChange={setName} placeholder="e.g. Protein Pancakes" autoFocus />
          </div>
          {Flags.get('recipeUrlImport') && (
            <div style={{ paddingTop: 28 }}>
              <button onClick={() => setShowUrlImport(true)}
                title="Import from URL"
                aria-label="Import recipe from URL"
                style={{ height: 44, padding: '0 14px', borderRadius: 12, border: `1px solid ${V.cardBorder}`, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: V.text2, fontSize: 12, fontFamily: V.font, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                🔗 URL
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Field label="Servings" type="number" value={servings} onChange={setServings} inputMode="decimal" />
        </div>

        <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="e.g. prep tips, storage instructions" />

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
            <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Ingredients ({items.length})
            </div>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.text, lineHeight: 1.2, wordBreak: 'break-word' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: V.text3 }}>{item.cal} kcal · {item.protein}P</div>
                </div>
                <input type="number" value={item.qty} onChange={e => updateQty(item.id, e.target.value)}
                  aria-label={`Quantity for ${item.name}`}
                  style={{ width: 60, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 8, color: V.text, fontSize: 12, textAlign: 'right' }} />
                <span style={{ fontSize: 10, color: V.text3 }}>g</span>
                <button onClick={() => removeIngredient(item.id)} aria-label={`Remove ${item.name}`}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.danger, fontSize: 16, padding: 2, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Ingredient search */}
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          Add Ingredient
        </div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search foods…"
            aria-label="Search foods to add as ingredient"
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
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <MacroPill label=" kcal" value={food.cal} color={V.warn} />
                <MacroPill label="P" value={food.protein} color={V.accent} />
              </div>
            </button>
          ))}
        </div>
      </Sheet>

      {showUrlImport && (
        <UrlImportSheet onImport={handleUrlImport} onClose={() => setShowUrlImport(false)} />
      )}
    </>
  );
}
