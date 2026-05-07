import React, { useState } from 'react';
import { V, setTheme } from '../utils/theme';
import { LS } from '../utils/storage';
import { Card, Btn, Field, Sheet, ConfirmCtrl, SuccessToastCtrl } from '../components/ui';
import { Icons } from '../components/Icons';
import { SessionManager } from '../utils/auth';
import { ALLERGENS, DIETARY_MODES } from '../utils/allergens';
import { RecipeBuilderSheet } from './RecipeBuilderSheet';
import { Flags } from '../utils/flags';
import { Analytics } from '../utils/analytics';
import { SUPPORTED_LOCALES, getStoredLocale, setStoredLocale } from '../i18n';

const PREMIUM_FEATURES = [
  { icon: '🤖', label: 'AI Nutrition Coach', desc: 'Chat with Claude — personalized, data-driven advice' },
  { icon: '📸', label: 'Photo Meal Recognition', desc: 'Snap a photo, AI identifies and logs your meal' },
  { icon: '📊', label: 'Advanced Micronutrients', desc: 'Vitamins A–K, minerals, deep weekly deficiency reports' },
  { icon: '🔗', label: 'Recipe URL Import', desc: 'Import any recipe from any website in one tap' },
  { icon: '📅', label: '7-Day Meal Planner', desc: 'AI-generated weekly plan + auto grocery list' },
  { icon: '☁️', label: 'Cloud Sync + Backup', desc: 'Encrypted sync across all your devices' },
  { icon: '⌚', label: 'Apple Health / Google Fit', desc: 'Two-way sync with your health ecosystem' },
  { icon: '📷', label: 'Unlimited Progress Photos', desc: 'Side-by-side timeline with privacy-first storage' },
];

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$7.99', period: 'per month', savings: null, highlight: false },
  { id: 'annual', label: 'Annual', price: '$59.99', period: 'per year', savings: 'Save 37%', highlight: true },
];

// ─── Premium upgrade sheet ─────────────────────────────────────────────────────
export function PremiumUpgradeSheet({ onClose }) {
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [step, setStep] = useState('plans'); // plans | payment | success
  const [cardNum, setCardNum] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleUpgrade = async () => {
    if (!cardNum.trim() || !cardExp.trim() || !cardCvc.trim()) return;
    setProcessing(true);
    Analytics.track('premium_upgrade_initiated', { plan: selectedPlan });
    await new Promise(r => setTimeout(r, 1800)); // mock processing
    LS.set('nl-premium', true);
    LS.set('nl-premium-plan', selectedPlan);
    LS.set('nl-premium-since', new Date().toISOString());
    Analytics.track('premium_upgrade_success', { plan: selectedPlan });
    setProcessing(false);
    setStep('success');
  };

  if (step === 'success') {
    return (
      <Sheet title="You're Pro! ⭐" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: V.text, marginBottom: 8 }}>Welcome to NutritionLog Pro</div>
          <div style={{ fontSize: 13, color: V.text3, lineHeight: 1.6, marginBottom: 24 }}>
            All premium features are now unlocked. Restart the app to activate AI Coach and photo recognition.
          </div>
          <Btn full onClick={onClose}>Get Started</Btn>
        </div>
      </Sheet>
    );
  }

  if (step === 'payment') {
    return (
      <Sheet title="Complete Upgrade" onClose={() => setStep('plans')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 12, background: `${V.accent}10`, border: `1px solid ${V.accent}20`, fontSize: 12, color: V.text2, textAlign: 'center' }}>
            🔒 Payments powered by Stripe — your card is never stored on our servers
          </div>
          <div style={{ fontSize: 11, color: V.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {selectedPlan === 'annual' ? 'Annual Plan — $59.99/year' : 'Monthly Plan — $7.99/month'}
          </div>
          <div>
            <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>Card Number</div>
            <input value={cardNum} onChange={e => setCardNum(e.target.value.replace(/\D/g, '').slice(0, 16))}
              placeholder="1234 5678 9012 3456" inputMode="numeric"
              style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 15, fontFamily: V.font, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>Expiry</div>
              <input value={cardExp} onChange={e => setCardExp(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))}
                placeholder="MM/YY"
                style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 15, fontFamily: V.font, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>CVC</div>
              <input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123" inputMode="numeric"
                style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 15, fontFamily: V.font, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ fontSize: 10, color: V.text3, textAlign: 'center', lineHeight: 1.5 }}>
            This is a demo — no real charge will occur. Cancel anytime from Settings.
          </div>
          <Btn full disabled={processing || cardNum.length < 16}
            onClick={handleUpgrade}
            style={{ background: `linear-gradient(135deg,${V.accent},${V.accent2})`, color: '#060a0e', fontWeight: 800 }}>
            {processing ? 'Processing…' : `Start 7-Day Free Trial`}
          </Btn>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="NutritionLog Pro ⭐" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontSize: 13, color: V.text3, lineHeight: 1.6 }}>
            Unlock the full intelligence layer — AI coaching, photo logging, wearable sync, and more.
          </div>
        </div>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PREMIUM_FEATURES.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.text }}>{f.label}</div>
                <div style={{ fontSize: 11, color: V.text3 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Plan selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PLANS.map(plan => (
            <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
              aria-pressed={selectedPlan === plan.id}
              style={{
                flex: 1, padding: 12, borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${selectedPlan === plan.id ? V.accent : V.cardBorder}`,
                background: selectedPlan === plan.id ? `${V.accent}12` : 'transparent',
                textAlign: 'center', fontFamily: V.font, position: 'relative',
              }}>
              {plan.savings && (
                <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: V.accent, color: '#060a0e', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8 }}>
                  {plan.savings}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 700, color: V.text }}>{plan.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: selectedPlan === plan.id ? V.accent : V.text, fontFamily: V.mono }}>{plan.price}</div>
              <div style={{ fontSize: 10, color: V.text3 }}>{plan.period}</div>
            </button>
          ))}
        </div>

        {/* Trial note */}
        <div style={{ textAlign: 'center', fontSize: 11, color: V.text3 }}>
          7-day free trial · Cancel anytime · No charge today
        </div>

        <Btn full onClick={() => { Analytics.track('premium_upgrade_started', { plan: selectedPlan }); setStep('payment'); }}
          style={{ background: `linear-gradient(135deg,${V.accent},${V.accent2})`, color: '#060a0e', fontWeight: 800 }}>
          Start Free Trial
        </Btn>
      </div>
    </Sheet>
  );
}

// ─── Feature gate component ───────────────────────────────────────────────────
// Wraps premium-only content. When user is not premium, renders a paywall card.
export function PremiumGate({ feature, children, compact = false }) {
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPremium = LS.get('nl-premium') === true;
  if (isPremium) return children;
  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
        background: `linear-gradient(135deg, ${V.accent}20, ${V.accent2}20)`, border: `1px solid ${V.accent}30`,
        fontSize: 10, fontWeight: 700, color: V.accent, letterSpacing: '.04em' }}>
        PRO
      </div>
    );
  }
  return (
    <>
      <div style={{ padding: 14, borderRadius: 12, border: `1px dashed ${V.accent}40`,
        background: `linear-gradient(135deg, ${V.accent}08, ${V.accent2}08)`, textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 6 }}>⭐</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 4 }}>Premium Feature</div>
        <div style={{ fontSize: 11, color: V.text3, marginBottom: 10, lineHeight: 1.5 }}>
          {feature || 'This feature'} is available on NutritionLog Pro.
        </div>
        <Btn v="small" onClick={() => setShowUpgrade(true)}>Upgrade to Pro</Btn>
      </div>
      {showUpgrade && <PremiumUpgradeSheet onClose={() => setShowUpgrade(false)} />}
    </>
  );
}

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
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const [locale, setLocale] = useState(getStoredLocale);
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

      {/* Premium upgrade card */}
      {Flags.get('premiumTier') && !LS.get('nl-premium') && (
        <div style={{
          padding: 16, borderRadius: 14,
          background: `linear-gradient(135deg, ${V.accent}20, ${V.accent2}15)`,
          border: `1px solid ${V.accent}35`, position: 'relative', overflow: 'hidden',
        }}
          role="region" aria-label="Premium upgrade"
        >
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.07 }}>⭐</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: V.accent, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
                NutritionLog Pro
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: V.text, marginBottom: 6 }}>
                Unlock every feature
              </div>
              <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.6 }}>
                ✓ AI-powered meal recognition<br />
                ✓ Barcode scanner (unlimited)<br />
                ✓ Advanced micronutrient tracking<br />
                ✓ Recipe URL import<br />
                ✓ 7-day meal planner + grocery list<br />
                ✓ Cloud sync + encrypted backup
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn onClick={() => setShowUpgradeSheet(true)}
              style={{ background: `linear-gradient(135deg,${V.accent},${V.accent2})`, color: '#060a0e', fontWeight: 800, fontSize: 13 }}>
              Upgrade — from $7.99/mo
            </Btn>
            <div style={{ fontSize: 10, color: V.text3 }}>7-day free trial</div>
          </div>
        </div>
      )}

      {/* Premium upgrade sheet */}
      {showUpgradeSheet && <PremiumUpgradeSheet onClose={() => setShowUpgradeSheet(false)} />}

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

      {/* Language */}
      <Card style={{ padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Language</div>
        <div style={{ display: "flex", gap: 6 }}>
          {SUPPORTED_LOCALES.map(l => (
            <button key={l.id} onClick={() => { setStoredLocale(l.id); setLocale(l.id); SuccessToastCtrl.show(`Language set to ${l.label}`); Analytics.track('locale_changed', { locale: l.id }); }}
              aria-pressed={locale === l.id}
              style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: `1px solid ${locale === l.id ? V.accent : V.cardBorder}`,
                background: locale === l.id ? `${V.accent}12` : "transparent", color: locale === l.id ? V.accent : V.text3,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: V.font, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: V.text3, marginTop: 8, textAlign: "center" }}>
          Full translations in progress — some text may still show in English
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
