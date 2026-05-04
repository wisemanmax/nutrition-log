import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ResponsiveContainer, ReferenceLine
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

const TIP_STYLE = {
  contentStyle: { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#fff' },
  itemStyle: { color: '#fff' },
};

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

// ─── TrendsTab ────────────────────────────────────────────────────────────────

export function TrendsTab({ s }) {
  const [range, setRange] = useState(30);
  const [activeMetric, setActiveMetric] = useState('calories'); // calories | macros | weight | adherence

  const units = s.units || 'lbs';

  // Build date series
  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = range - 1; i >= 0; i--) dates.push(ago(i));
    return dates;
  }, [range]);

  // Nutrition data mapped to date range
  const nutritionData = useMemo(() => {
    return dateRange.map(date => {
      const entry = (s.nutrition || []).find(n => n.date === date);
      return {
        date,
        label: fmtShort(date),
        cal: entry?.cal || null,
        protein: entry?.protein || null,
        carbs: entry?.carbs || null,
        fat: entry?.fat || null,
        fiber: entry?.fiber || null,
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

  // Adherence data
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

  // Streak calculation
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

  const xTickInterval = range === 7 ? 0 : range === 30 ? 4 : range === 90 ? 14 : 30;

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>Trends</div>
        <div style={{ display: 'flex', gap: 4 }}>
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
        <SummaryCard label={`Adherence (${range}d)`} value={`${adherencePct}%`} color={adherencePct >= 80 ? V.accent : adherencePct >= 60 ? V.warn : V.danger}
          sub="Days hitting cal + protein goals" />
      )}

      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
          { id: 'calories', label: '🔥 Calories' },
          { id: 'macros', label: '🥩 Macros' },
          { id: 'weight', label: '⚖️ Weight' },
          { id: 'adherence', label: '✅ Adherence' },
        ].map(m => (
          <Chip key={m.id} label={m.label} active={activeMetric === m.id} onClick={() => setActiveMetric(m.id)} />
        ))}
      </div>

      {/* Charts */}

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
                <Tooltip {...TIP_STYLE} formatter={(v) => [v ? `${v} kcal` : 'No data', 'Calories']} />
                <ReferenceLine y={s.goals?.cal || 2400} stroke={V.accent} strokeDasharray="4 4" strokeOpacity={0.5} />
                <Area type="monotone" dataKey="cal" stroke={V.warn} fill="url(#calGrad)" strokeWidth={2} dot={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

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
                  <Tooltip {...TIP_STYLE} formatter={(v, name) => [v ? `${v}g` : 'No data', name]} />
                  <Legend wrapperStyle={{ fontSize: 10, color: V.text3 }} />
                  <Line type="monotone" dataKey="protein" name="Protein" stroke={V.accent} strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="carbs" name="Carbs" stroke={V.accent2} strokeWidth={2} dot={false} connectNulls={false} />
                  <Line type="monotone" dataKey="fat" name="Fat" stroke={V.warn} strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
              {/* Goal reference lines */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { label: `Protein goal: ${s.goals?.protein || 180}g`, color: V.accent },
                  { label: `Carbs goal: ${s.goals?.carbs || 250}g`, color: V.accent2 },
                  { label: `Fat goal: ${s.goals?.fat || 70}g`, color: V.warn },
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
                <Tooltip {...TIP_STYLE} formatter={(v, name) => [`${v} ${units}`, name]} />
                <Line type="monotone" dataKey="weight" name="Weight" stroke={V.accent} strokeWidth={2} dot={{ fill: V.accent, r: 2 }} activeDot={{ r: 4 }} />
                {bodyData.some(d => d.bodyFat != null) && (
                  <Line type="monotone" dataKey="bodyFat" name="Body Fat %" stroke={V.accent2} strokeWidth={2} dot={false} yAxisId={1} />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

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
                <Tooltip {...TIP_STYLE} formatter={(v) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" fill={V.accent} radius={[3, 3, 0, 0]}
                  label={false}
                  // Color bars individually
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}

      {/* Fiber/Sodium micronutrients overview if data present */}
      {loggedDays >= 3 && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Micronutrient Averages ({range}d)</div>
          {[
            { label: 'Fiber', key: 'fiber', goal: s.goals?.fiber || 25, unit: 'g', color: V.accent },
            { label: 'Sodium', key: 'sodium', goal: 2300, unit: 'mg', color: V.warn },
          ].map(({ label, key, goal, unit, color }) => {
            const vals = nutritionData.filter(d => d.logged && d[key] != null).map(d => d[key]);
            const avg = vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : null;
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: V.text2 }}>{label}</span>
                  <span style={{ fontSize: 11, fontFamily: V.mono, color: avg != null ? color : V.text3 }}>
                    {avg != null ? `${avg} / ${goal} ${unit}` : 'No data'}
                  </span>
                </div>
                {avg != null && (
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (avg / goal) * 100)}%`, background: avg > goal ? V.danger : `linear-gradient(90deg,${color},${color}bb)`, borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Predictive analytics */}
      {(tdeeEstimate || isPlateauing || projectionData.length > 0) && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Predictions & Insights</div>

          {isPlateauing && (
            <div style={{ background: `${V.warn}10`, border: `1px solid ${V.warn}30`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: V.warn, marginBottom: 3 }}>⚠️ Weight Plateau Detected</div>
              <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>Your weight has been stable for 2+ weeks. Consider adjusting your calorie target by ±200 kcal or varying your training.</div>
            </div>
          )}

          {tdeeEstimate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>Estimated TDEE</div>
                <div style={{ fontSize: 10, color: V.text3 }}>Based on your intake + weight changes</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>{tdeeEstimate}</div>
            </div>
          )}

          {projectionData.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>90-Day Weight Projection</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={projectionData}>
                  <XAxis dataKey="date" tickFormatter={d => fmtShort(d)} tick={{ fill: V.text3, fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: V.text3, fontSize: 8 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: `1px solid ${V.cardBorder}`, borderRadius: 8, fontSize: 11, color: V.text }}
                    formatter={(v) => [`${v} ${units}`, 'Projected']} labelFormatter={(l) => fmtShort(l)} />
                  <Line type="monotone" dataKey="weight" stroke={V.accent2} strokeWidth={2} strokeDasharray="6 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: V.text3, textAlign: 'center', marginTop: 4 }}>
                Projected at current avg {avgCal} kcal/day · adjust intake to change trajectory
              </div>
            </>
          )}
        </Card>
      )}

      {/* Micronutrient report */}
      {microReport.length > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Weekly Nutrient Report</div>
          {microReport.map(r => (
            <div key={r.nutrient} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: V.text2, fontWeight: 600 }}>{r.nutrient}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontFamily: V.mono, color: r.status === 'ok' ? V.accent : r.status === 'high' ? V.danger : V.warn }}>
                    {r.avg} / {r.goal} {r.unit}
                  </span>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: r.status === 'ok' ? `${V.accent}15` : r.status === 'high' ? `${V.danger}15` : `${V.warn}15`, color: r.status === 'ok' ? V.accent : r.status === 'high' ? V.danger : V.warn }}>
                    {r.status === 'ok' ? 'Good' : r.status === 'high' ? 'High' : r.status === 'low' ? 'Low' : 'Deficient'}
                  </span>
                </div>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, r.pct)}%`, borderRadius: 3, transition: 'width .4s',
                  background: r.status === 'ok' ? V.accent : r.status === 'high' ? V.danger : V.warn }} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Streak history heatmap */}
      {(s.nutrition || []).length > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Logging Heatmap ({range}d)</div>
          <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {dateRange.map(date => {
              const entry = (s.nutrition || []).find(n => n.date === date);
              const calGoal = s.goals?.cal || 2400;
              const protGoal = s.goals?.protein || 180;
              const calOk = entry && entry.cal >= calGoal * 0.85;
              const protOk = entry && entry.protein >= protGoal * 0.9;
              const both = calOk && protOk;
              const either = calOk || protOk;
              return (
                <div key={date} title={`${fmtShort(date)}: ${entry ? `${entry.cal} kcal` : 'No data'}`}
                  style={{ width: range <= 30 ? 20 : range <= 90 ? 10 : 6, height: range <= 30 ? 20 : range <= 90 ? 10 : 6, borderRadius: 3,
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
