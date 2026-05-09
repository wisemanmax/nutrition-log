import React, { useState, useEffect, useRef, useCallback } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn, Field, Sheet, Progress } from '../components/ui';
import { Icons } from '../components/Icons';
import { FoodDb } from '../utils/foodDb';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { today, ago, uid, fmtDate } from '../utils/helpers';
import { MEAL_SECTIONS } from '../state/reducer.ts';
import { Analytics } from '../utils/analytics';
import { Flags } from '../utils/flags';
import { hasAllergenConflict } from '../utils/allergens';
import { computeFrequents } from '../utils/frequents';

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── MacroPill ────────────────────────────────────────────────────────────────

function MacroPill({ label, value, color }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, padding: '2px 6px', borderRadius: 6 }}>
      {value}{label}
    </span>
  );
}

// ─── Voice logging ───────────────────────────────────────────────────────────

function VoiceLogButton({ onVoiceResult }) {
  const [listening, setListening] = useState(false);
  const recognRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!supported || !Flags.get('voiceLog')) return null;

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onVoiceResult(transcript);
      setListening(false);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recognRef.current = recog;
    recog.start();
    setListening(true);
    Haptic.light();
    Analytics.track('voice_log_started', {});
  };

  const stop = () => { recognRef.current?.stop(); setListening(false); };

  return (
    <button
      onClick={listening ? stop : start}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      title="Voice search"
      style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', border: `1px solid ${listening ? V.danger : V.cardBorder}`,
        background: listening ? `${V.danger}15` : 'rgba(255,255,255,0.05)', fontSize: 18,
        animation: listening ? 'pulse 1s infinite' : 'none',
      }}
    >
      🎤
    </button>
  );
}

// ─── Photo meal recognition (flag: photoMealLog) ─────────────────────────────

function PhotoLogButton({ onResults }) {
  const [status, setStatus] = useState('idle'); // idle | capturing | analyzing | error
  const inputRef = useRef(null);

  if (!Flags.get('photoMealLog')) return null;

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('analyzing');
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      Analytics.track('photo_meal_started', { size: file.size });
      const res = await fetch('/api/photo-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      onResults(data.items || []);
      Analytics.track('photo_meal_success', { itemCount: (data.items || []).length });
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
      setStatus('idle');
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCapture} aria-hidden="true" />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'analyzing'}
        aria-label={status === 'analyzing' ? 'Analyzing meal photo…' : 'Log meal from photo'}
        title="Photo meal log"
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: status === 'analyzing' ? 'default' : 'pointer',
          border: `1px solid ${status === 'error' ? V.danger : V.cardBorder}`,
          background: status === 'analyzing' ? `${V.accent}15` : 'rgba(255,255,255,0.05)', fontSize: 18,
        }}
      >
        {status === 'analyzing' ? <div style={{ width: 16, height: 16, border: `2px solid ${V.accent}30`, borderTopColor: V.accent, borderRadius: '50%', animation: 'spin .6s linear infinite' }} /> : '🍽️'}
      </button>
    </>
  );
}

// ─── Food Search Sheet ────────────────────────────────────────────────────────

function FoodSearchSheet({ onSelect, onClose, recents = [], favorites = [], allFoods = [], frequents = [], onToggleFavorite, userAllergens = [] }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // search | recents | favorites | frequents
  const [showBarcode, setShowBarcode] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [photoResults, setPhotoResults] = useState(null); // null | FoodItem[]
  const debouncedQuery = useDebounce(query, 350);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    FoodDb.search(debouncedQuery).then(res => {
      if (!cancelled) { setResults(res); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleBarcodeResult = async (barcode) => {
    setShowBarcode(false);
    setBarcodeLoading(true);
    Analytics.track('barcode_scanned', { barcode });
    const food = await FoodDb.lookupBarcode(barcode);
    setBarcodeLoading(false);
    if (food) {
      setResults([food]);
      setQuery(food.name);
      setActiveTab('search');
    } else {
      setQuery(barcode);
      setActiveTab('search');
    }
  };

  const handleVoiceResult = (transcript) => {
    setQuery(transcript);
    setActiveTab('search');
  };

  const displayList = activeTab === 'recents' ? recents
    : activeTab === 'favorites' ? allFoods.filter(f => favorites.includes(f.id))
    : activeTab === 'frequents' ? frequents
    : activeTab === 'photo' ? []
    : results;

  if (showBarcode) {
    return <BarcodeScanner onResult={handleBarcodeResult} onClose={() => setShowBarcode(false)} />;
  }

  return (
    <Sheet title="Add Food" onClose={onClose}>
      {/* Search input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveTab('search'); }}
            placeholder="Search USDA database…"
            aria-label="Search foods"
            style={{
              width: '100%', padding: '12px 36px 12px 14px', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 15,
              fontFamily: V.font, outline: 'none', boxSizing: 'border-box', minHeight: 44,
            }}
          />
          {loading || barcodeLoading ? (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, border: `2px solid ${V.accent}30`, borderTopColor: V.accent, borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
          ) : query ? (
            <button onClick={() => setQuery('')} aria-label="Clear search" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: V.text3, fontSize: 18, lineHeight: 1 }}>×</button>
          ) : null}
        </div>

        {Flags.get('barcodeScanning') && (
          <button onClick={() => setShowBarcode(true)} aria-label="Scan barcode"
            style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${V.cardBorder}`, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            📷
          </button>
        )}

        <VoiceLogButton onVoiceResult={handleVoiceResult} />
        <PhotoLogButton onResults={(items) => { setPhotoResults(items); setActiveTab('photo'); }} />
      </div>

      {/* Photo recognition results confirmation */}
      {activeTab === 'photo' && photoResults && (
        <div style={{ marginBottom: 12, background: `${V.accent}08`, border: `1px solid ${V.accent}20`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.accent, marginBottom: 8 }}>🍽️ AI recognized {photoResults.length} item{photoResults.length !== 1 ? 's' : ''} — confirm before logging</div>
          {photoResults.length === 0 && <div style={{ fontSize: 12, color: V.text3 }}>No items recognized. Try a clearer photo.</div>}
          {photoResults.map((food, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${V.cardBorder}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{food.name}</div>
                <div style={{ fontSize: 10, color: V.text3 }}>{food.cal} kcal · {food.protein}P · {food.carbs}C · {food.fat}F</div>
              </div>
              <Btn style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => { onSelect(food); Analytics.track('photo_meal_item_logged', { name: food.name }); }}>Log</Btn>
            </div>
          ))}
          <button onClick={() => { setPhotoResults(null); setActiveTab('search'); }} style={{ marginTop: 8, fontSize: 11, color: V.text3, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['search', 'Search'], ['frequents', '🔁 Often'], ['recents', 'Recents'], ['favorites', '★ Saved']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}
            style={{
              flex: 1, padding: '7px 2px', borderRadius: 10, border: `1px solid ${activeTab === id ? V.accent : V.cardBorder}`,
              background: activeTab === id ? `${V.accent}12` : 'transparent', color: activeTab === id ? V.accent : V.text3,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: V.font,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      {displayList.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: V.text3 }}>
          {activeTab === 'search' && !query ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13 }}>Search 1.4M+ USDA foods</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Or scan a barcode{Flags.get('voiceLog') ? ' or speak your food' : ''}</div>
            </div>
          ) : activeTab === 'frequents' ? (
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔁</div>
              <div style={{ fontSize: 13 }}>No frequent foods yet</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Foods you log often will appear here</div>
            </div>
          ) : (
            <div style={{ fontSize: 13 }}>No results found</div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {displayList.map(food => (
          <FoodResultRow
            key={food.id}
            food={food}
            onSelect={food2 => onSelect(food2)}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
            allergenWarning={hasAllergenConflict(food, userAllergens)}
          />
        ))}
      </div>
    </Sheet>
  );
}

function FoodResultRow({ food, onSelect, favorites = [], onToggleFavorite, allergenWarning = false }) {
  const [expanded, setExpanded] = useState(false);
  const [qty, setQty] = useState(String(food.servingG || 100));
  const [unit, setUnit] = useState('g');
  const isFav = favorites.includes(food.id);

  const grams = parseFloat(qty) || food.servingG || 100;
  const scaled = FoodDb.scale(food, grams);

  return (
    <div style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: V.text, lineHeight: 1.3, wordBreak: 'break-word' }}>{food.name}</div>
              {onToggleFavorite && (
                <button onClick={e => { e.stopPropagation(); onToggleFavorite(food.id); }}
                  aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: isFav ? V.gold : V.text3, padding: 0, flexShrink: 0 }}>
                  {isFav ? '★' : '☆'}
                </button>
              )}
            </div>
            {food.brand && <div style={{ fontSize: 10, color: V.text3, marginTop: 1 }}>{food.brand}</div>}
            {allergenWarning && (
              <div role="alert" style={{ fontSize: 10, color: V.danger, fontWeight: 700, marginTop: 2 }}>⚠️ Contains allergen</div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
              <MacroPill label=" kcal" value={food.cal} color={V.warn} />
              <MacroPill label="P" value={food.protein} color={V.accent} />
              <MacroPill label="C" value={food.carbs} color={V.accent2} />
              <MacroPill label="F" value={food.fat} color={V.warn} />
            </div>
          </div>
          <span aria-hidden="true" style={{ color: V.text3, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${V.cardBorder}` }}>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <Field label="Amount" type="number" value={qty} onChange={setQty} inputMode="decimal" style={{ flex: 1, marginBottom: 0 }} />
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 11, color: V.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, fontWeight: 600 }}>Unit</div>
              <select value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit"
                style={{ padding: '12px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 14, minHeight: 44 }}>
                <option value="g">g</option>
                <option value="oz">oz</option>
                <option value="serving">serving ({food.servingG}g)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: 11, color: V.text3, flexWrap: 'wrap' }}>
            <span style={{ color: V.warn, fontWeight: 700 }}>{scaled.cal} kcal</span>
            <span>{scaled.protein}g P</span>
            <span>{scaled.carbs}g C</span>
            <span>{scaled.fat}g F</span>
            {scaled.fiber > 0 && <span>{scaled.fiber}g Fiber</span>}
          </div>

          <Btn full style={{ marginTop: 10 }} onClick={() => {
            let finalGrams = parseFloat(qty) || food.servingG || 100;
            if (unit === 'oz') finalGrams = finalGrams * 28.3495;
            if (unit === 'serving') finalGrams = food.servingG || 100;
            const item = FoodDb.scale(food, finalGrams);
            onSelect({ ...item, qty: parseFloat(qty), unit });
          }}>
            {Icons.plus({ size: 14, color: '#060a0e' })} Add to Meal
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Meal Item Row ─────────────────────────────────────────────────────────────

function MealItemRow({ item, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.qty || item.servingG || 100));

  const grams = parseFloat(qty) || item.servingG || 100;
  const scaled = FoodDb.scale(item, grams);

  if (editing) {
    return (
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${V.cardBorder}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: V.text, marginBottom: 6 }}>{item.name}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Field label="" type="number" value={qty} onChange={setQty} inputMode="decimal" style={{ flex: 1, marginBottom: 0 }} />
          <span style={{ fontSize: 11, color: V.text3 }}>{item.unit || 'g'}</span>
          <Btn v="small" onClick={() => { onEdit({ ...scaled, qty: parseFloat(qty), unit: item.unit }); setEditing(false); }}>Save</Btn>
          <button onClick={() => setEditing(false)} aria-label="Cancel edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.text3, fontSize: 18 }}>×</button>
        </div>
        <div style={{ fontSize: 10, color: V.text3, marginTop: 4 }}>{scaled.cal} kcal · {scaled.protein}P · {scaled.carbs}C · {scaled.fat}F</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: V.text, lineHeight: 1.3, wordBreak: 'break-word' }}>{item.name}</div>
        <div style={{ fontSize: 10, color: V.text3, marginTop: 1 }}>
          {item.qty || item.servingG || 100}{item.unit || 'g'} · {item.cal} kcal
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
        <MacroPill label="P" value={item.protein} color={V.accent} />
        <MacroPill label="C" value={item.carbs} color={V.accent2} />
        <MacroPill label="F" value={item.fat} color={V.warn} />
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
        <button onClick={() => setEditing(true)} aria-label={`Edit ${item.name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.text3, padding: 4, fontSize: 14 }}>✏️</button>
        <button onClick={onDelete} aria-label={`Delete ${item.name}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.danger, padding: 4, fontSize: 14 }}>🗑</button>
      </div>
    </div>
  );
}

// ─── Meal Section Card ────────────────────────────────────────────────────────

function MealSection({ section, date, onAdd, onEditItem, onDeleteItem }) {
  const items = section.items || [];
  const sectionCal = items.reduce((s, i) => s + (i.cal || 0), 0);
  const sectionProt = items.reduce((s, i) => s + (i.protein || 0), 0);

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }} role="region" aria-label={section.name}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: items.length ? `1px solid ${V.cardBorder}` : 'none' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: V.text }}>{section.name}</span>
          {sectionCal > 0 && (
            <span style={{ fontSize: 10, color: V.text3, marginLeft: 8 }}>{sectionCal} kcal · {Math.round(sectionProt)}g P</span>
          )}
        </div>
        <Btn v="ghost" onClick={onAdd} aria-label={`Add food to ${section.name}`} style={{ padding: '4px 8px', minHeight: 32, fontSize: 12 }}>
          {Icons.plus({ size: 12, color: V.accent })} Add
        </Btn>
      </div>
      {items.map(item => (
        <MealItemRow
          key={item.id}
          item={item}
          onEdit={updated => onEditItem(section.name, { ...item, ...updated })}
          onDelete={() => onDeleteItem(section.name, item.id)}
        />
      ))}
    </Card>
  );
}

// ─── Quick manual add ─────────────────────────────────────────────────────────

function QuickAddSheet({ sectionName, onSave, onClose }) {
  const [name, setName] = useState('');
  const [cal, setCal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: uid(), name: name.trim(), cal: parseFloat(cal) || 0,
      protein: parseFloat(protein) || 0, carbs: parseFloat(carbs) || 0, fat: parseFloat(fat) || 0,
      fiber: 0, sodium: 0, qty: 1, unit: 'serving', servingG: 1, source: 'manual',
    });
    onClose();
  };

  return (
    <Sheet title={`Quick Add to ${sectionName}`} onClose={onClose} footer={
      <div style={{ padding: 16 }}>
        <Btn full onClick={save} disabled={!name.trim()}>Save Entry</Btn>
      </div>
    }>
      <Field label="Food Name" value={name} onChange={setName} placeholder="e.g. Protein shake" autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Calories" type="number" value={cal} onChange={setCal} inputMode="decimal" unit="kcal" />
        <Field label="Protein" type="number" value={protein} onChange={setProtein} inputMode="decimal" unit="g" />
        <Field label="Carbs" type="number" value={carbs} onChange={setCarbs} inputMode="decimal" unit="g" />
        <Field label="Fat" type="number" value={fat} onChange={setFat} inputMode="decimal" unit="g" />
      </div>
    </Sheet>
  );
}

// ─── Template picker sheet ────────────────────────────────────────────────────

function TemplatePickerSheet({ templates, onApply, onClose }) {
  if (!templates || templates.length === 0) {
    return (
      <Sheet title="Apply Template" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: V.text3 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 13 }}>No meal templates saved yet.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>Save a day's meals as a template from the log options.</div>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="Apply Template" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.map(tmpl => {
          const totalCal = tmpl.meals?.flatMap(m => m.items || []).reduce((s, i) => s + (i.cal || 0), 0) || 0;
          const totalProt = tmpl.meals?.flatMap(m => m.items || []).reduce((s, i) => s + (i.protein || 0), 0) || 0;
          return (
            <button key={tmpl.id} onClick={() => { onApply(tmpl); onClose(); }}
              style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: V.text }}>{tmpl.name}</div>
              <div style={{ fontSize: 10, color: V.text3, marginTop: 3 }}>
                {totalCal > 0 ? `${totalCal} kcal · ${Math.round(totalProt)}g protein` : 'No macros saved'}
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ─── Save-as-template sheet ───────────────────────────────────────────────────

function SaveTemplateSheet({ dayData, onSave, onClose }) {
  const [name, setName] = useState('');
  const save = () => {
    if (!name.trim()) return;
    onSave({ id: uid(), name: name.trim(), meals: dayData?.meals || [] });
    onClose();
  };
  return (
    <Sheet title="Save as Template" onClose={onClose} footer={<div style={{ padding: 16 }}><Btn full onClick={save} disabled={!name.trim()}>Save Template</Btn></div>}>
      <Field label="Template Name" value={name} onChange={setName} placeholder="e.g. Typical Bulking Day" autoFocus />
      <div style={{ fontSize: 12, color: V.text3, lineHeight: 1.5 }}>
        All meals from this day will be saved as a reusable template.
      </div>
    </Sheet>
  );
}

// ─── LogTab ───────────────────────────────────────────────────────────────────

export function LogTab({ s, d }) {
  const [viewDate, setViewDate] = useState(today());
  const [addingToSection, setAddingToSection] = useState(null);
  const [quickAddSection, setQuickAddSection] = useState(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const frequents = useCallback(() => computeFrequents(s.nutrition || [], 10), [s.nutrition])();

  const dayData = s.nutrition.find(n => n.date === viewDate);
  const meals = dayData?.meals || MEAL_SECTIONS.map(name => ({ name, items: [] }));

  const totalCal = dayData?.cal || 0;
  const totalProtein = dayData?.protein || 0;
  const totalCarbs = dayData?.carbs || 0;
  const totalFat = dayData?.fat || 0;

  const isToday = viewDate === today();

  const navigateDay = (delta) => {
    const d2 = new Date(viewDate + 'T12:00:00');
    d2.setDate(d2.getDate() + delta);
    setViewDate(d2.toISOString().split('T')[0]);
  };

  const copyFromYesterday = () => {
    const yesterday = ago(1);
    d({ type: 'COPY_DAY', fromDate: yesterday, toDate: viewDate });
    Haptic.success();
    Analytics.track('copy_from_yesterday', {});
  };

  const applyTemplate = (tmpl) => {
    const clonedMeals = (tmpl.meals || []).map(m => ({
      ...m,
      items: (m.items || []).map(i => ({ ...i, id: uid(), loggedAt: new Date().toISOString() })),
    }));
    clonedMeals.forEach(m => {
      (m.items || []).forEach(item => {
        d({ type: 'ADD_MEAL_ITEM', date: viewDate, sectionName: m.name, item });
      });
    });
    Haptic.success();
    Analytics.track('template_applied', { name: tmpl.name });
  };

  const handleFoodSelect = (food) => {
    d({ type: 'ADD_MEAL_ITEM', date: viewDate, sectionName: addingToSection, item: food });
    Haptic.light();
    Analytics.track('meal_item_added', { source: food.source, section: addingToSection });
    setAddingToSection(null);
  };

  const handleEditItem = (sectionName, item) => {
    d({ type: 'EDIT_MEAL_ITEM', date: viewDate, sectionName, item });
  };

  const handleDeleteItem = (sectionName, itemId) => {
    d({ type: 'DELETE_MEAL_ITEM', date: viewDate, sectionName, itemId });
    Haptic.medium();
  };

  const hasAnyItems = dayData?.meals?.some(m => (m.items || []).length > 0);

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigateDay(-1)} aria-label="Previous day"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.accent, fontSize: 20, padding: '4px 8px' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: V.text }}>{fmtDate(viewDate)}</div>
          {!isToday && <div style={{ fontSize: 10, color: V.text3 }}>{viewDate}</div>}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Options menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowOptions(v => !v)} aria-label="Day options" aria-haspopup="true"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.text3, fontSize: 18, padding: '4px 6px' }}>
              ⋮
            </button>
            {showOptions && (
              <>
                <div onClick={() => setShowOptions(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 100, minWidth: 180,
                  background: '#1a1f2e', border: `1px solid ${V.cardBorder}`, borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
                }}>
                  {[
                    { label: '📋 Apply Template', action: () => { setShowTemplatePicker(true); setShowOptions(false); } },
                    { label: '💾 Save as Template', action: () => { setShowSaveTemplate(true); setShowOptions(false); }, disabled: !hasAnyItems },
                    { label: '📅 Copy from Yesterday', action: () => { copyFromYesterday(); setShowOptions(false); } },
                  ].map(opt => (
                    <button key={opt.label} onClick={opt.action} disabled={opt.disabled}
                      style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: opt.disabled ? 'default' : 'pointer', textAlign: 'left', color: opt.disabled ? V.text3 : V.text, fontSize: 13, fontFamily: V.font, borderBottom: `1px solid ${V.cardBorder}`, opacity: opt.disabled ? 0.5 : 1 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => navigateDay(1)} disabled={isToday} aria-label="Next day"
            style={{ background: 'none', border: 'none', cursor: isToday ? 'default' : 'pointer', color: isToday ? V.text3 : V.accent, fontSize: 20, padding: '4px 8px' }}>›</button>
        </div>
      </div>

      {/* Daily Summary */}
      <Card style={{ padding: '12px 16px', background: `linear-gradient(135deg,${V.accent}08,${V.accent2}06)`, border: `1px solid ${V.accent}15` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: V.text3, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Calories</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: totalCal > (s.goals?.cal || 2400) ? V.danger : V.warn, fontFamily: V.mono, lineHeight: 1 }}>{totalCal}</div>
            <div style={{ fontSize: 10, color: V.text3 }}>/ {s.goals?.cal || 2400}</div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Protein', val: totalProtein, goal: s.goals?.protein || 180, color: V.accent },
              { label: 'Carbs', val: totalCarbs, goal: s.goals?.carbs || 250, color: V.accent2 },
              { label: 'Fat', val: totalFat, goal: s.goals?.fat || 70, color: V.warn },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: V.text3, fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color, fontFamily: V.mono }}>{m.val}</div>
                <div style={{ fontSize: 9, color: V.text3 }}>/{m.goal}g</div>
              </div>
            ))}
          </div>
        </div>
        <Progress val={totalCal} max={s.goals?.cal || 2400} color={totalCal > (s.goals?.cal || 2400) ? V.danger : V.accent} h={6} />
      </Card>

      {/* Meal sections */}
      {meals.map(section => (
        <MealSection
          key={section.name}
          section={section}
          date={viewDate}
          onAdd={() => setAddingToSection(section.name)}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
        />
      ))}

      {/* Empty day prompt */}
      {!hasAnyItems && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn v="secondary" full onClick={() => setShowTemplatePicker(true)}>
            📋 Apply Template
          </Btn>
          <Btn v="secondary" full onClick={copyFromYesterday}>
            📅 Copy Yesterday
          </Btn>
        </div>
      )}

      {/* Food search sheet */}
      {addingToSection && (
        <FoodSearchSheet
          onSelect={handleFoodSelect}
          onClose={() => setAddingToSection(null)}
          recents={s.recents || []}
          favorites={s.favorites || []}
          frequents={frequents}
          allFoods={s.recents || []}
          onToggleFavorite={(foodId) => d({ type: 'TOGGLE_FAVORITE', foodId })}
          userAllergens={s.profile?.allergens || []}
        />
      )}

      {/* Quick add sheet */}
      {quickAddSection && (
        <QuickAddSheet
          sectionName={quickAddSection}
          onSave={food => { d({ type: 'ADD_MEAL_ITEM', date: viewDate, sectionName: quickAddSection, item: food }); }}
          onClose={() => setQuickAddSection(null)}
        />
      )}

      {/* Template picker */}
      {showTemplatePicker && (
        <TemplatePickerSheet
          templates={s.templates || []}
          onApply={applyTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* Save as template */}
      {showSaveTemplate && (
        <SaveTemplateSheet
          dayData={dayData}
          onSave={tmpl => { d({ type: 'SAVE_TEMPLATE', template: tmpl }); }}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
