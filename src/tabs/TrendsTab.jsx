import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { V } from '../utils/theme';
import { Card, Chip } from '../components/ui';
import { today, ago, fmtShort } from '../utils/helpers';
import { estimateTDEE, detectPlateau, generateProjection, getMicronutrientReport } from '../utils/predictions';

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
];

const TIP = {
  contentStyle: { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#fff' },
  itemStyle: { color: '#fff' },
};

// ─── Daily Reference Intakes ──────────────────────────────────────────────────

const MICRONUTRIENTS = [
  { key: 'vitaminA',   label: 'Vitamin A',   unit: 'mcg', dri: 900,   higherIsBad: false },
  { key: 'vitaminC',   label: 'Vitamin C',   unit: 'mg',  dri: 90,    higherIsBad: false },
  { key: 'vitaminD',   label: 'Vitamin D',   unit: 'mcg', dri: 20,    higherIsBad: false },
  { key: 'vitaminE',   label: 'Vitamin E',   unit: 'mg',  dri: 15,    higherIsBad: false },
  { key: 'vitaminK',   label: 'Vitamin K',   unit: 'mcg', dri: 120,   higherIsBad: false },
  { key: 'vitaminB12', label: 'Vitamin B12', unit: 'mcg', dri: 2.4,   higherIsBad: false },
  { key: 'vitaminB6',  label: 'Vitamin B6',  unit: 'mg',  dri: 1.7,   higherIsBad: false },
  { key: 'thiamin',    label: 'Thiamin B1',  unit: 'mg',  dri: 1.2,   higherIsBad: false },
  { key: 'riboflavin', label: 'Riboflavin B2', unit: 'mg', dri: 1.3, higherIsBad: false },
  { key: 'niacin',     label: 'Niacin B3',   unit: 'mg',  dri: 16,    higherIsBad: false },
  { key: 'folate',     label: 'Folate',       unit: 'mcg', dri: 400,   higherIsBad: false },
  { key: 'calcium',    label: 'Calcium',      unit: 'mg',  dri: 1000,  higherIsBad: false },
  { key: 'iron',       label: 'Iron',         unit: 'mg',  dri: 8,     higherIsBad: false },
  { key: 'magnesium',  label: 'Magnesium',    unit: 'mg',  dri: 420,   higherIsBad: false },
  { key: 'zinc',       label: 'Zinc',         unit: 'mg',  dri: 11,    higherIsBad: false },
  { key: 'potassium',  label: 'Potassium',    unit: 'mg',  dri: 3400,  higherIsBad: false },
  { key: 'sodium',     label: 'Sodium',       unit: 'mg',  dri: 2300,  higherIsBad: true  },
  { key: 'fiber',      label: 'Fiber',        unit: 'g',   dri: 28,    higherIsBad: false },
  { key: 'omega3',     label: 'Omega-3',      unit: 'g',   dri: 1.6,   higherIsBad: false },
  { key: 'choline',    label: 'Choline',      unit: 'mg',  dri: 550,   higherIsBad: false },
];

// ─── Stat summary card ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, unit, color, sub }) {
  return (
    <div style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: V.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || V.text, fontFamily: V.mono }}>
        {value ?? '—'}{value != null && unit ? <span style={{ fontSize: 11, fontWeight: 600, color: V.text3 }}>{unit}</span> : null}
      </div>
      {sub && <div style={{ fontSize: 9, color: V.text3, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── Micronutrient bar ─────────────────────────────────────────────────────────

function MicroBar({ label, avg, dri, unit, higherIsBad }) {
  const pct = dri > 0 ? Math.min(150, (avg / dri) * 100) : 0;
  const status = avg === 0 ? 'no-data'
    : higherIsBad
      ? (avg > dri ? 'high' : 'ok')
      : (avg >= dri * 0.9 ? 'ok' : avg >= dri * 0.7 ? 'low' : 'deficient');
  const color = status === 'no-data' ? V.text3
    : status === 'ok' ? V.accent
    : status === 'high' ? V.danger
    : status === 'low' ? V.warn
    : V.danger;
  const statusLabel = status === 'no-data' ? 'No data'
    : status === 'ok' ? 'Good'
    : status === 'high' ? 'High'
    : status === 'low' ? 'Low'
    : 'Deficient';

  return (
    <div style={{ marginBottom: 10 }} role="meter" aria-label={`${label}: ${avg} / ${dri} ${unit}`} aria-valuenow={avg} aria-valuemin={0} aria-valuemax={dri}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: V.text2 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontFamily: V.mono, color: status !== 'no-data' ? color : V.text3 }}>
            {avg > 0 ? `${avg} / ${dri} ${unit}` : 'No data'}
          </span>
          {status !== 'no-data' && (
            <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: `${color}15`, color }}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: status === 'no-data' ? 'rgba(255,255,255,0.06)' : `linear-gradient(90deg,${color},${color}bb)`, borderRadius: 3, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

// ─── Mood correlation card ─────────────────────────────────────────────────────

function MoodCorrelations({ nutrition, mood, goals }) {
  const correlations = useMemo(() => {
    const results = [];
    const protGoal = goals?.protein || 180;
    const calGoal = goals?.cal || 2400;
    const fiberGoal = goals?.fiber || 25;

    // Collect days with both nutrition and mood data
    const combined = [];
    Object.entries(mood || {}).forEach(([date, moodEntry]) => {
      const day = nutrition.find(n => n.date === date);
      if (day && moodEntry?.mood != null) {
        combined.push({
          date, mood: moodEntry.mood, energy: moodEntry.energy, digestion: moodEntry.digestion,
          cal: day.cal, protein: day.protein, carbs: day.carbs, fat: day.fat, fiber: day.fiber,
        });
      }
    });

    if (combined.length < 5) return [];

    // Helper: compute simple Pearson-like correlation rank
    const rankCorr = (metric, moodKey) => {
      const pairs = combined.filter(d => d[moodKey] != null && d[metric] != null);
      if (pairs.length < 4) return null;
      const avgM = pairs.reduce((s, p) => s + p[metric], 0) / pairs.length;
      const avgR = pairs.reduce((s, p) => s + p[moodKey], 0) / pairs.length;
      const num = pairs.reduce((s, p) => s + (p[metric] - avgM) * (p[moodKey] - avgR), 0);
      const denM = Math.sqrt(pairs.reduce((s, p) => s + (p[metric] - avgM) ** 2, 0));
      const denR = Math.sqrt(pairs.reduce((s, p) => s + (p[moodKey] - avgR) ** 2, 0));
      return denM * denR === 0 ? null : num / (denM * denR);
    };

    // Protein → energy
    const protEnergy = rankCorr('protein', 'energy');
    if (protEnergy != null && Math.abs(protEnergy) > 0.3) {
      results.push({
        insight: protEnergy > 0 ? 'Higher protein days tend to correlate with better energy' : 'Higher protein days show no clear energy benefit for you',
        metric: 'Protein → Energy',
        corr: protEnergy,
      });
    }

    // Fiber → digestion
    const fiberDigest = rankCorr('fiber', 'digestion');
    if (fiberDigest != null && Math.abs(fiberDigest) > 0.3) {
      results.push({
        insight: fiberDigest > 0 ? 'Hitting your fiber goal correlates with better digestion scores' : 'Fiber intake has mixed effects on your digestion scores',
        metric: 'Fiber → Digestion',
        corr: fiberDigest,
      });
    }

    // Calorie deficit → mood
    const calMood = rankCorr('cal', 'mood');
    if (calMood != null && Math.abs(calMood) > 0.25) {
      results.push({
        insight: calMood > 0 ? 'Days you eat closer to your calorie goal correlate with better mood' : 'Large calorie deficits appear to correlate with lower mood for you',
        metric: 'Calories → Mood',
        corr: calMood,
      });
    }

    return results;
  }, [nutrition, mood, goals]);

  if (correlations.length === 0) {
    return (
      <Card style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 6 }}>Diet ↔ Mood Correlations</div>
        <div style={{ fontSize: 11, color: V.text3, lineHeight: 1.5 }}>
          Log mood entries for 5+ days alongside nutrition to see personalized correlations.
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Diet ↔ Mood Correlations</div>
      {correlations.map((c, i) => {
        const strength = Math.abs(c.corr);
        const dir = c.corr >= 0 ? '↑' : '↓';
        const color = strength > 0.6 ? V.accent : strength > 0.4 ? V.accent2 : V.warn;
        return (
          <div key={i} style={{ marginBottom: i < correlations.length - 1 ? 12 : 0, padding: '10px 12px', background: `${color}08`, borderRadius: 10, border: `1px solid ${color}20` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color }}>{c.metric}</span>
              <span style={{ fontSize: 10, color, fontFamily: V.mono }}>{dir} {(strength * 100).toFixed(0)}%</span>
            </div>
            <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>{c.insight}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 9, color: V.text3, marginTop: 8 }}>Based on your logged mood + nutrition data. Correlation ≠ causation.</div>
    </Card>
  );
}

// ─── Goal revision suggestions ─────────────────────────────────────────────────

function GoalRevisionCard({ tdeeEstimate, avgCal, goals, units }) {
  if (!tdeeEstimate) return null;

  const currentGoal = goals?.cal || 2400;
  const diff = Math.abs(tdeeEstimate - currentGoal);
  if (diff < 150) return null; // No suggestion needed if within 150 kcal

  const isMaintenance = Math.abs(avgCal - tdeeEstimate) < 150;
  const suggestion = tdeeEstimate > currentGoal
    ? `Your estimated maintenance is ${tdeeEstimate} kcal — ${tdeeEstimate - currentGoal} kcal above your current goal. If you're not seeing expected results, consider adjusting your goal upward.`
    : `Your estimated maintenance is ${tdeeEstimate} kcal — ${currentGoal - tdeeEstimate} kcal below your current goal. Your body may be more efficient than estimated.`;

  return (
    <Card style={{ padding: 12, borderLeft: `3px solid ${V.accent2}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: V.accent2, marginBottom: 4 }}>💡 Goal Calibration</div>
      <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>{suggestion}</div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
        <div><span style={{ color: V.text3 }}>Your goal: </span><span style={{ color: V.text, fontFamily: V.mono }}>{currentGoal} kcal</span></div>
        <div><span style={{ color: V.text3 }}>Est. TDEE: </span><span style={{ color: V.accent2, fontFamily: V.mono }}>{tdeeEstimate} kcal</span></div>
      </div>
    </Card>
  );
}

// ─── TrendsTab ────────────────────────────────────────────────────────────────

export function TrendsTab({ s }) {
  const [range, setRange] = useState(30);
  const [activeMetric, setActiveMetric] = useState('calories');
  const [microFilter, setMicroFilter] = useState('all'); // all | vitamins | minerals | other

  const units = s.units || 'lbs';

  // Date series
  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = range - 1; i >= 0; i--) dates.push(ago(i));
    return dates;
  }, [range]);

  // Nutrition data
  const nutritionData = useMemo(() => {
    return dateRange.map(date => {
      const entry = (s.nutrition || []).find(n => n.date === date);
      return {
        date, label: fmtShort(date),
        cal: entry?.cal || null, protein: entry?.protein || null,
        carbs: entry?.carbs || null, fat: entry?.fat || null,
        fiber: entry?.fiber || null, sodium: entry?.sodium || null,
        logged: !!entry,
      };
    });
  }, [dateRange, s.nutrition]);

  // Body data
  const bodyData = useMemo(() => {
    return dateRange.map(date => {
      const entry = (s.body || []).find(b => b.date === date);
      return { date, label: fmtShort(date), weight: entry?.weight || null, bodyFat: entry?.bodyFat || null };
    }).filter(d => d.weight != null || d.bodyFat != null);
  }, [dateRange, s.body]);

  // Adherence
  const adherenceData = useMemo(() => {
    const calGoal = s.goals?.cal || 2400;
    const protGoal = s.goals?.protein || 180;
    return dateRange.map(date => {
      const entry = (s.nutrition || []).find(n => n.date === date);
      if (!entry) return { date, label: fmtShort(date), score: 0, logged: false };
      const calOk = entry.cal >= calGoal * 0.85 && entry.cal <= calGoal * 1.15 ? 50 : 0;
      const protOk = entry.protein >= protGoal * 0.9 ? 50 : 0;
      return { date, label: fmtShort(date), score: calOk + protOk, logged: true };
    });
  }, [dateRange, s.nutrition, s.goals]);

  // Summary stats
  const loggedDays = nutritionData.filter(d => d.logged).length;
  const adherencePct = loggedDays > 0 ? Math.round((adherenceData.filter(d => d.score === 100).length / loggedDays) * 100) : null;
  const avgCal = loggedDays > 0 ? Math.round(nutritionData.filter(d => d.logged).reduce((s, d) => s + (d.cal || 0), 0) / loggedDays) : null;
  const avgProtein = loggedDays > 0 ? Math.round(nutritionData.filter(d => d.logged).reduce((s, d) => s + (d.protein || 0), 0) / loggedDays) : null;
  const weightStart = bodyData.length > 0 ? bodyData[0].weight : null;
  const weightEnd = bodyData.length > 0 ? bodyData[bodyData.length - 1].weight : null;
  const weightChange = weightStart && weightEnd ? Math.round((weightEnd - weightStart) * 10) / 10 : null;

  // Streak
  const streak = useMemo(() => {
    let count = 0, i = 0;
    while ((s.nutrition || []).some(n => n.date === ago(i))) { count++; i++; }
    return count;
  }, [s.nutrition]);

  // Predictive analytics
  const tdeeEstimate = useMemo(() => estimateTDEE(s.nutrition || [], s.body || [], units), [s.nutrition, s.body, units]);
  const isPlateauing = useMemo(() => detectPlateau(s.body || [], units), [s.body, units]);
  const microReport = useMemo(() => getMicronutrientReport(s.nutrition || [], s.goals), [s.nutrition, s.goals]);

  const currentWeight = (s.body || []).find(b => b.weight != null)?.weight;
  const projectionData = useMemo(() => {
    if (!currentWeight || !tdeeEstimate || !avgCal) return [];
    return generateProjection(currentWeight, tdeeEstimate, avgCal, 90, units);
  }, [currentWeight, tdeeEstimate, avgCal, units]);

  // Micronutrient averages for the range
  const microAvgs = useMemo(() => {
    const logged = (s.nutrition || []).filter(n => dateRange.includes(n.date));
    if (!logged.length) return {};
    const result = {};
    MICRONUTRIENTS.forEach(({ key }) => {
      const vals = logged.filter(n => (n[key] || 0) > 0).map(n => n[key] || 0);
      result[key] = vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length * 10) / 10 : 0;
    });
    return result;
  }, [s.nutrition, dateRange]);

  // Micro filter options
  const VITAMIN_KEYS = ['vitaminA','vitaminC','vitaminD','vitaminE','vitaminK','vitaminB12','vitaminB6','thiamin','riboflavin','niacin','folate'];
  const MINERAL_KEYS = ['calcium','iron','magnesium','zinc','potassium','sodium','phosphorus','selenium'];
  const filteredMicros = MICRONUTRIENTS.filter(m =>
    microFilter === 'all' ? true :
    microFilter === 'vitamins' ? VITAMIN_KEYS.includes(m.key) :
    microFilter === 'minerals' ? MINERAL_KEYS.includes(m.key) :
    !VITAMIN_KEYS.includes(m.key) && !MINERAL_KEYS.includes(m.key)
  );

  const xTickInterval = range === 7 ? 0 : range === 30 ? 4 : range === 90 ? 14 : 30;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>Trends</div>
        <div role="group" aria-label="Time range" style={{ display: 'flex', gap: 4 }}>
          {RANGE_OPTIONS.map(opt => (
            <Chip key={opt.label} label={opt.label} active={range === opt.days} onClick={() => setRange(opt.days)} />
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <SummaryCard label="Days Logged" value={loggedDays} color={V.accent} sub={`of ${range}`} />
        <SummaryCard label="Avg Cal" value={avgCal} color={V.warn} />
        <SummaryCard label="Avg Protein" value={avgProtein} unit="g" color={V.accent} />
        <SummaryCard label="Streak" value={streak} unit="d" color={streak >= 7 ? V.accent : V.text2} />
      </div>

      {weightChange != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <SummaryCard label="Weight Start" value={weightStart} unit={units} color={V.text2} />
          <SummaryCard label="Weight Now" value={weightEnd} unit={units} color={V.accent} />
          <SummaryCard label="Change" value={weightChange >= 0 ? `+${weightChange}` : weightChange} unit={units}
            color={weightChange < 0 ? V.accent : weightChange === 0 ? V.text2 : V.danger} />
        </div>
      )}

      {adherencePct != null && (
        <SummaryCard label={`Adherence (${range}d)`} value={`${adherencePct}%`}
          color={adherencePct >= 80 ? V.accent : adherencePct >= 60 ? V.warn : V.danger}
          sub="Days hitting cal + protein goals" />
      )}

      {/* Metric selector */}
      <div role="group" aria-label="Chart metric" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'calories', label: '🔥 Calories' },
          { id: 'macros', label: '🥩 Macros' },
          { id: 'weight', label: '⚖️ Weight' },
          { id: 'adherence', label: '✅ Adherence' },
          { id: 'micros', label: '🧪 Nutrients' },
          { id: 'mood', label: '😊 Mood' },
          { id: 'predictions', label: '🔮 Forecast' },
        ].map(m => (
          <Chip key={m.id} label={m.label} active={activeMetric === m.id} onClick={() => setActiveMetric(m.id)} />
        ))}
      </div>

      {/* ── Calories chart ── */}
      {activeMetric === 'calories' && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 12 }}>Daily Calories</div>
          {loggedDays === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: V.text3, fontSize: 12 }}>No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={nutritionData}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={V.warn} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={V.warn} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval={xTickInterval} />
                <YAxis tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={36} domain={[0, 'auto']} />
                <Tooltip {...TIP} formatter={(v) => [v ? `${v} kcal` : 'No data', 'Calories']} />
                <ReferenceLine y={s.goals?.cal || 2400} stroke={V.accent} strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Goal', fill: V.accent, fontSize: 9 }} />
                <Area type="monotone" dataKey="cal" stroke={V.warn} fill="url(#calGrad)" strokeWidth={2} dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {avgCal && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: V.text3 }}>
              <span>Avg: <span style={{ color: V.warn, fontFamily: V.mono }}>{avgCal} kcal</span></span>
              <span>Goal: <span style={{ color: V.accent, fontFamily: V.mono }}>{s.goals?.cal || 2400} kcal</span></span>
              {avgCal && <span>Diff: <span style={{ color: avgCal > (s.goals?.cal || 2400) ? V.danger : V.accent, fontFamily: V.mono }}>{avgCal - (s.goals?.cal || 2400) > 0 ? '+' : ''}{avgCal - (s.goals?.cal || 2400)}</span></span>}
            </div>
          )}
        </Card>
      )}

      {/* ── Macros chart ── */}
      {activeMetric === 'macros' && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 12 }}>Daily Macros (g)</div>
          {loggedDays === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: V.text3, fontSize: 12 }}>No data for this period</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={nutritionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval={xTickInterval} />
                  <YAxis tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip {...TIP} formatter={(v, name) => [v ? `${v}g` : 'No data', name]} />
                  <Legend wrapperStyle={{ fontSize: 10, color: V.text3 }} />
                  <Line type="monotone" dataKey="protein" name="Protein" stroke={V.accent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="carbs" name="Carbs" stroke={V.accent2} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fat" name="Fat" stroke={V.warn} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { label: `P goal: ${s.goals?.protein || 180}g`, color: V.accent },
                  { label: `C goal: ${s.goals?.carbs || 250}g`, color: V.accent2 },
                  { label: `F goal: ${s.goals?.fat || 70}g`, color: V.warn },
                ].map(g => (
                  <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 12, height: 2, background: g.color }} />
                    <span style={{ fontSize: 9, color: V.text3 }}>{g.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Weight chart ── */}
      {activeMetric === 'weight' && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 12 }}>Weight ({units})</div>
          {bodyData.length < 2 ? (
            <div style={{ textAlign: 'center', padding: 24, color: V.text3, fontSize: 12 }}>Log at least 2 weigh-ins to see trend</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={bodyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval={xTickInterval} />
                <YAxis domain={['auto', 'auto']} tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...TIP} formatter={(v, name) => [`${v} ${units}`, name]} />
                <Line type="monotone" dataKey="weight" name="Weight" stroke={V.accent} strokeWidth={2} dot={{ fill: V.accent, r: 2 }} activeDot={{ r: 4 }} />
                {bodyData.some(d => d.bodyFat != null) && (
                  <Line type="monotone" dataKey="bodyFat" name="Body Fat %" stroke={V.accent2} strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* ── Adherence chart ── */}
      {activeMetric === 'adherence' && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 4 }}>Adherence Score</div>
          <div style={{ fontSize: 10, color: V.text3, marginBottom: 12 }}>100 = hit both calorie and protein goals</div>
          {loggedDays === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: V.text3, fontSize: 12 }}>No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={adherenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval={xTickInterval} />
                <YAxis domain={[0, 100]} tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" fill={V.accent} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* ── Micronutrients panel ── */}
      {activeMetric === 'micros' && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.text }}>Nutrient Panel (avg {range}d)</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['all', 'All'], ['vitamins', 'Vitamins'], ['minerals', 'Minerals'], ['other', 'Other']].map(([id, label]) => (
                <button key={id} onClick={() => setMicroFilter(id)}
                  style={{ padding: '3px 8px', borderRadius: 8, border: `1px solid ${microFilter === id ? V.accent : V.cardBorder}`, background: microFilter === id ? `${V.accent}12` : 'transparent', color: microFilter === id ? V.accent : V.text3, fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: V.font }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loggedDays === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: V.text3, fontSize: 12 }}>Log meals with USDA foods to see nutrient data</div>
          ) : (
            filteredMicros.map(m => (
              <MicroBar
                key={m.key}
                label={m.label}
                avg={microAvgs[m.key] || 0}
                dri={m.dri}
                unit={m.unit}
                higherIsBad={m.higherIsBad}
              />
            ))
          )}
          <div style={{ fontSize: 9, color: V.text3, marginTop: 8 }}>
            DRI = Dietary Reference Intake (adult male). Data quality depends on foods logged via USDA database.
          </div>
        </Card>
      )}

      {/* ── Mood panel ── */}
      {activeMetric === 'mood' && (
        <>
          {/* Mood chart */}
          <Card style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 12 }}>Mood & Energy Scores</div>
            {Object.keys(s.mood || {}).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: V.text3, fontSize: 12 }}>
                Log mood on the Home tab to see trends
              </div>
            ) : (() => {
              const moodData = dateRange.map(date => {
                const entry = s.mood?.[date];
                return {
                  label: fmtShort(date),
                  mood: entry?.mood ?? null,
                  energy: entry?.energy ?? null,
                  digestion: entry?.digestion ?? null,
                };
              });
              const hasData = moodData.some(d => d.mood != null);
              if (!hasData) return <div style={{ textAlign: 'center', padding: 20, color: V.text3, fontSize: 12 }}>No mood data for this period</div>;
              return (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={moodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval={xTickInterval} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
                    <Tooltip {...TIP} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="mood" name="Mood" stroke={V.purple} strokeWidth={2} dot={{ fill: V.purple, r: 2 }} connectNulls />
                    <Line type="monotone" dataKey="energy" name="Energy" stroke={V.accent} strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="digestion" name="Digestion" stroke={V.accent2} strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              );
            })()}
          </Card>

          <MoodCorrelations nutrition={s.nutrition || []} mood={s.mood || {}} goals={s.goals} />
        </>
      )}

      {/* ── Predictions panel ── */}
      {activeMetric === 'predictions' && (
        <>
          {isPlateauing && (
            <Card style={{ padding: 12, borderLeft: `3px solid ${V.warn}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: V.warn, marginBottom: 3 }}>⚠️ Weight Plateau Detected</div>
              <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>Your weight has been stable for 2+ weeks. Consider adjusting calories by ±200 kcal or changing training stimulus.</div>
            </Card>
          )}

          <GoalRevisionCard tdeeEstimate={tdeeEstimate} avgCal={avgCal} goals={s.goals} units={units} />

          {tdeeEstimate && (
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 8 }}>Estimated Maintenance</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>{tdeeEstimate}</div>
                  <div style={{ fontSize: 10, color: V.text3 }}>kcal/day estimated TDEE</div>
                </div>
                <div style={{ fontSize: 11, color: V.text3, textAlign: 'right', lineHeight: 1.5 }}>
                  Based on intake + weight<br />changes over tracked period
                </div>
              </div>
            </Card>
          )}

          {projectionData.length > 0 && (
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 6 }}>90-Day Weight Forecast</div>
              <div style={{ fontSize: 10, color: V.text3, marginBottom: 8 }}>At your current avg {avgCal} kcal/day</div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={projectionData}>
                  <XAxis dataKey="date" tickFormatter={d => fmtShort(d)} tick={{ fill: V.text3, fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: V.text3, fontSize: 8 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: `1px solid ${V.cardBorder}`, borderRadius: 8, fontSize: 11, color: V.text }}
                    formatter={(v) => [`${v} ${units}`, 'Projected']}
                    labelFormatter={(l) => fmtShort(l)}
                  />
                  <Line type="monotone" dataKey="weight" stroke={V.accent2} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: V.text3, textAlign: 'center', marginTop: 4 }}>
                Adjust calorie intake to change your trajectory
              </div>
            </Card>
          )}

          {!tdeeEstimate && (
            <Card style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔮</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: V.text2, marginBottom: 6 }}>Not enough data yet</div>
              <div style={{ fontSize: 12, color: V.text3 }}>Log meals and weigh-ins for 14+ days to unlock weight forecasting</div>
            </Card>
          )}
        </>
      )}

      {/* Logging heatmap (always visible) */}
      {activeMetric !== 'micros' && activeMetric !== 'mood' && (s.nutrition || []).length > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Logging Heatmap ({range}d)</div>
          <div role="img" aria-label={`Logging heatmap for the past ${range} days`} style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {dateRange.map(date => {
              const entry = (s.nutrition || []).find(n => n.date === date);
              const calGoal = s.goals?.cal || 2400;
              const protGoal = s.goals?.protein || 180;
              const calOk = entry && entry.cal >= calGoal * 0.85;
              const protOk = entry && entry.protein >= protGoal * 0.9;
              const both = calOk && protOk;
              const either = calOk || protOk;
              const size = range <= 30 ? 20 : range <= 90 ? 10 : 6;
              return (
                <div key={date} title={`${fmtShort(date)}: ${entry ? `${entry.cal} kcal` : 'No data'}`}
                  style={{ width: size, height: size, borderRadius: 3,
                    background: both ? '#22c55e' : either ? '#f59e0b' : entry ? 'rgba(244,63,94,0.4)' : 'rgba(255,255,255,0.05)' }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {[{ c: '#22c55e', l: 'Both goals' }, { c: '#f59e0b', l: 'Partial' }, { c: 'rgba(244,63,94,0.4)', l: 'Logged' }, { c: 'rgba(255,255,255,0.05)', l: 'Nothing' }].map(x => (
              <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
                <span style={{ fontSize: 8, color: V.text3 }}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(s.nutrition || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: V.text3 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: V.text2, marginBottom: 6 }}>No data yet</div>
          <div style={{ fontSize: 13 }}>Start logging meals to see your trends</div>
        </div>
      )}
    </div>
  );
}
