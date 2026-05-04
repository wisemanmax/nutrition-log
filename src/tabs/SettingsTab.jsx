import React, { useState } from 'react';
import { V, setTheme } from '../utils/theme';
import { LS } from '../utils/storage';
import { Card, Btn, Field, Sheet, ConfirmCtrl, SuccessToastCtrl } from '../components/ui';
import { Icons } from '../components/Icons';
import { SessionManager } from '../utils/auth';
import { ALLERGENS, DIETARY_MODES } from '../utils/allergens';
import { RecipeBuilderSheet } from './RecipeBuilderSheet';

export function TOSContent() {
  return (
    <div style={{ fontSize: 12, color: V.text2, lineHeight: 1.8 }}>
      <h3 style={{ color: V.text, marginBottom: 8 }}>Terms of Service</h3>
      <p>By using NutritionLog, you agree to use the app responsibly. Your data is stored locally on your device. Cloud sync is optional and encrypted in transit. We do not sell your data. You must be 13 or older to use this service. We reserve the right to terminate accounts that violate these terms.</p>
      <p style={{ marginTop: 12 }}>Last updated: April 2026</p>
    </div>
  );
}

export function PrivacyContent() {
  return (
    <div style={{ fontSize: 12, color: V.text2, lineHeight: 1.8 }}>
      <h3 style={{ color: V.text, marginBottom: 8 }}>Privacy Policy</h3>
      <p>NutritionLog stores your data locally on your device by default. When you enable cloud sync, your data is encrypted in transit and stored securely. We collect minimal analytics (crash reports via Sentry). We never sell, share, or monetize your personal or health data. You can export or delete all your data at any time from Settings.</p>
      <p style={{ marginTop: 12 }}>Last updated: April 2026</p>
    </div>
  );
}

export function SettingsTab({ s, d }) {
  const [isDark, setIsDark] = useState(V.mode === "dark");
  const [editingGoals, setEditingGoals] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null); // null | 'new' | recipe object
  const [goalDraft, setGoalDraft] = useState({ ...s.goals });
  const email = s.profile?.email || LS.get("ft-session-email");

  const toggleAllergen = (id) => {
    const current = s.profile?.allergens || [];
    const next = current.includes(id) ? current.filter(a => a !== id) : [...current, id];
    d({ type: 'SET_PROFILE', profile: { allergens: next } });
  };

  const toggleDietaryMode = (id) => {
    const current = s.profile?.dietaryModes || [];
    const next = current.includes(id) ? current.filter(m => m !== id) : [...current, id];
    d({ type: 'SET_PROFILE', profile: { dietaryModes: next } });
  };

  const toggleTheme = () => {
    const mode = isDark ? "light" : "dark";
    setTheme(mode);
    setIsDark(!isDark);
  };

  const exportData = () => {
    const data = { nutrition: s.nutrition, body: s.body, goals: s.goals, units: s.units, profile: s.profile };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `nutritionlog-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    SuccessToastCtrl.show("Data exported");
  };

  const importData = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          d({ type: "IMPORT", data });
          SuccessToastCtrl.show("Data imported successfully");
        } catch (err) { alert("Invalid backup file"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const signOut = async () => {
    await SessionManager.revoke();
    LS.set("nl-onboarded", null);
    window.location.reload();
  };

  const clearAll = () => {
    ConfirmCtrl.show("Delete All Data?", "This will permanently remove all your nutrition logs, body metrics, and goals. This cannot be undone.", () => {
      d({ type: "CLEAR_ALL" });
      SuccessToastCtrl.show("All data cleared");
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>Settings</div>

      {/* Account */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Account</div>
        <div style={{ fontSize: 13, color: V.text }}>{s.profile?.firstName} {s.profile?.lastName}</div>
        <div style={{ fontSize: 11, color: V.text3 }}>{email || "Not signed in"}</div>
      </Card>

      {/* Theme */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: V.text }}>Dark Mode</span>
          <button onClick={toggleTheme} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: isDark ? V.accent : "rgba(255,255,255,0.15)", position: "relative", transition: "background .2s" }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3,
              left: isDark ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </button>
        </div>
      </Card>

      {/* Goals */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em" }}>Daily Goals</div>
          <Btn v="ghost" onClick={() => { setGoalDraft({ ...s.goals }); setEditingGoals(true); }} style={{ padding: '4px 8px', minHeight: 28, fontSize: 11 }}>Edit</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
          <div><span style={{ color: V.text3 }}>Calories:</span> <span style={{ color: V.warn, fontFamily: V.mono }}>{s.goals?.cal || 2400}</span></div>
          <div><span style={{ color: V.text3 }}>Protein:</span> <span style={{ color: V.accent, fontFamily: V.mono }}>{s.goals?.protein || 180}g</span></div>
          <div><span style={{ color: V.text3 }}>Carbs:</span> <span style={{ color: V.accent2, fontFamily: V.mono }}>{s.goals?.carbs || 250}g</span></div>
          <div><span style={{ color: V.text3 }}>Fat:</span> <span style={{ color: V.warn, fontFamily: V.mono }}>{s.goals?.fat || 70}g</span></div>
          <div><span style={{ color: V.text3 }}>Fiber:</span> <span style={{ color: V.accent, fontFamily: V.mono }}>{s.goals?.fiber || 25}g</span></div>
          <div><span style={{ color: V.text3 }}>Water:</span> <span style={{ color: V.accent2, fontFamily: V.mono }}>{s.goals?.water || 8} cups</span></div>
        </div>
      </Card>

      {/* Dietary modes */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Dietary Preferences</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DIETARY_MODES.map(mode => {
            const active = (s.profile?.dietaryModes || []).includes(mode.id);
            return (
              <button key={mode.id} onClick={() => toggleDietaryMode(mode.id)}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${active ? V.accent : V.cardBorder}`,
                  background: active ? `${V.accent}15` : 'transparent', color: active ? V.accent : V.text3,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: V.font }}>
                {mode.icon} {mode.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Allergens */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Allergen Alerts</div>
        <div style={{ fontSize: 10, color: V.text3, marginBottom: 10 }}>Foods containing these will be flagged in search</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGENS.map(a => {
            const active = (s.profile?.allergens || []).includes(a.id);
            return (
              <button key={a.id} onClick={() => toggleAllergen(a.id)}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${active ? V.danger : V.cardBorder}`,
                  background: active ? `${V.danger}12` : 'transparent', color: active ? V.danger : V.text3,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: V.font }}>
                {a.icon} {a.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Recipes */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em" }}>My Recipes</div>
          <Btn v="small" onClick={() => setEditingRecipe('new')}>+ New</Btn>
        </div>
        {(s.recipes || []).length === 0 ? (
          <div style={{ fontSize: 12, color: V.text3, textAlign: 'center', padding: '12px 0' }}>No recipes yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(s.recipes || []).slice(0, 5).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: V.text3 }}>{r.macros?.perServing?.cal} kcal/serving · {r.servings} servings</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingRecipe(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.text3, fontSize: 13 }}>✏️</button>
                  <button onClick={() => ConfirmCtrl.show('Delete Recipe?', r.name, () => d({ type: 'DELETE_RECIPE', id: r.id }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.danger, fontSize: 13 }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Goals edit sheet */}
      {editingGoals && (
        <Sheet title="Edit Daily Goals" onClose={() => setEditingGoals(false)}
          footer={<div style={{ padding: 16 }}><Btn full onClick={() => { d({ type: 'GOALS', g: { cal: parseInt(goalDraft.cal), protein: parseInt(goalDraft.protein), carbs: parseInt(goalDraft.carbs), fat: parseInt(goalDraft.fat), fiber: parseInt(goalDraft.fiber || 25), water: parseInt(goalDraft.water || 8) } }); setEditingGoals(false); SuccessToastCtrl.show('Goals updated'); }}>Save Goals</Btn></div>}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Calories" type="number" value={String(goalDraft.cal || '')} onChange={v => setGoalDraft(g => ({...g, cal: v}))} inputMode="numeric" unit="kcal" />
            <Field label="Protein" type="number" value={String(goalDraft.protein || '')} onChange={v => setGoalDraft(g => ({...g, protein: v}))} inputMode="numeric" unit="g" />
            <Field label="Carbs" type="number" value={String(goalDraft.carbs || '')} onChange={v => setGoalDraft(g => ({...g, carbs: v}))} inputMode="numeric" unit="g" />
            <Field label="Fat" type="number" value={String(goalDraft.fat || '')} onChange={v => setGoalDraft(g => ({...g, fat: v}))} inputMode="numeric" unit="g" />
            <Field label="Fiber" type="number" value={String(goalDraft.fiber || '')} onChange={v => setGoalDraft(g => ({...g, fiber: v}))} inputMode="numeric" unit="g" />
            <Field label="Water" type="number" value={String(goalDraft.water || '')} onChange={v => setGoalDraft(g => ({...g, water: v}))} inputMode="numeric" unit="cups" />
          </div>
        </Sheet>
      )}

      {/* Recipe builder sheet */}
      {editingRecipe && (
        <RecipeBuilderSheet
          existing={editingRecipe !== 'new' ? editingRecipe : undefined}
          onSave={(recipe) => d({ type: 'SAVE_RECIPE', recipe })}
          onClose={() => setEditingRecipe(null)}
        />
      )}

      {/* Units */}
      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: V.text }}>Weight Units</span>
          <div style={{ display: "flex", gap: 6 }}>
            {["lbs", "kg"].map(u => (
              <button key={u} onClick={() => d({ type: "UNITS", units: u })}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${s.units === u ? V.accent : V.cardBorder}`,
                  background: s.units === u ? `${V.accent}12` : "transparent", color: s.units === u ? V.accent : V.text3,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: V.font }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Data */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Data</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="secondary" full onClick={exportData}>{Icons.download({ size: 14, color: V.text2 })} Export</Btn>
          <Btn v="secondary" full onClick={importData}>{Icons.upload({ size: 14, color: V.text2 })} Import</Btn>
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.danger, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Danger Zone</div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="danger" full onClick={clearAll}>{Icons.trash({ size: 14, color: V.danger })} Clear All Data</Btn>
          <Btn v="secondary" full onClick={signOut}>Sign Out</Btn>
        </div>
      </Card>

      {/* Version */}
      <div style={{ textAlign: "center", fontSize: 10, color: V.text3, padding: 12 }}>
        NutritionLog v1.0 - Part of the IRONLOG ecosystem
      </div>
    </div>
  );
}
