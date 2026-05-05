import React, { useState, useRef, useEffect, useMemo } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn } from '../components/ui';
import { Analytics } from '../utils/analytics';
import { ago } from '../utils/helpers';
import { estimateTDEE, detectPlateau } from '../utils/predictions';

// ─── Insight engine ───────────────────────────────────────────────────────────

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const ex = xs[i] - mx, ey = ys[i] - my;
    num += ex * ey; dx += ex * ex; dy += ey * ey;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : parseFloat((num / denom).toFixed(2));
}

function generateInsights(s) {
  const insights = [];
  const goals = s.goals || {};
  const nutrition = s.nutrition || [];
  const body = s.body || [];
  const mood = s.mood || {};
  const water = s.water || {};

  const last7Dates = Array.from({ length: 7 }, (_, i) => ago(i));
  const last7 = last7Dates.map(d => nutrition.find(n => n.date === d)).filter(Boolean);
  const last14 = Array.from({ length: 14 }, (_, i) => ago(i)).map(d => nutrition.find(n => n.date === d)).filter(Boolean);
  const last30 = Array.from({ length: 30 }, (_, i) => ago(i)).map(d => nutrition.find(n => n.date === d)).filter(Boolean);

  const avg = (days, key) => {
    const vals = days.filter(d => (d[key] || 0) > 0);
    return vals.length ? vals.reduce((s, d) => s + (d[key] || 0), 0) / vals.length : 0;
  };

  // ── Logging streak ──────────────────────────────────────────────────────────
  let streak = 0;
  for (let i = 0; ; i++) {
    if (nutrition.some(n => n.date === ago(i))) streak++;
    else break;
  }
  if (streak >= 7 && streak % 7 === 0) {
    insights.push({
      priority: 1, type: 'success', icon: '🔥',
      title: `${streak}-day logging streak!`,
      body: `Incredible consistency — ${streak} consecutive days logged. People who track 6+ days/week are 3× more likely to reach their goals.`,
      action: null,
    });
  }

  if (last7.length < 3) {
    insights.push({
      priority: 10, type: 'info', icon: '🌱',
      title: 'Start logging to unlock insights',
      body: 'Log meals for at least 3 days to get personalized coach insights. The more data you provide, the smarter your coach becomes.',
      action: null,
    });
    return insights;
  }

  // ── Calorie adherence ───────────────────────────────────────────────────────
  const calGoal = goals.cal || 2400;
  const avgCal = avg(last7, 'cal');
  const deficit = calGoal - avgCal;
  if (deficit > 400) {
    insights.push({
      priority: 3, type: 'warning', icon: '⚡',
      title: `Large calorie deficit (avg ${Math.round(Math.abs(deficit))} kcal/day)`,
      body: `You're eating ${Math.round(Math.abs(deficit))} kcal below goal daily. Projected loss: ~${(Math.abs(deficit) * 7 / 3500).toFixed(1)} lbs/week. Deficits over 500 kcal/day risk muscle loss and fatigue — consider upping slightly.`,
      action: null,
    });
  } else if (deficit > 100) {
    insights.push({
      priority: 5, type: 'info', icon: '🔥',
      title: `${Math.round(Math.abs(deficit))} kcal/day deficit on track`,
      body: `Averaging ${Math.round(avgCal)} kcal vs. your ${calGoal} goal. At this pace, expect ~${(Math.abs(deficit) * 7 / 3500).toFixed(1)} lbs/week loss.`,
      action: null,
    });
  } else if (deficit < -300) {
    insights.push({
      priority: 3, type: 'warning', icon: '⚠️',
      title: `${Math.round(Math.abs(deficit))} kcal/day surplus`,
      body: `Averaging ${Math.round(Math.abs(deficit))} kcal over goal — this could add ~${(Math.abs(deficit) * 7 / 3500).toFixed(1)} lbs/week if sustained. Track portions carefully.`,
      action: null,
    });
  }

  // ── Protein ─────────────────────────────────────────────────────────────────
  const protGoal = goals.protein || 180;
  const avgProt = avg(last7, 'protein');
  if (avgProt > 0 && avgProt < protGoal * 0.8) {
    insights.push({
      priority: 2, type: 'warning', icon: '💪',
      title: `Low protein — avg ${Math.round(avgProt)}g vs ${protGoal}g goal`,
      body: `You're ${Math.round(protGoal - avgProt)}g short daily. At a deficit, inadequate protein leads to muscle loss. Try: Greek yogurt (17g), chicken (31g/100g), cottage cheese (14g/½ cup).`,
      action: null,
    });
  } else if (avgProt >= protGoal) {
    insights.push({
      priority: 8, type: 'success', icon: '🎯',
      title: `Protein goal hit — ${Math.round(avgProt)}g avg`,
      body: `You're meeting your ${protGoal}g protein target. This preserves muscle during any deficit and keeps you satiated.`,
      action: null,
    });
  }

  // ── Fiber ───────────────────────────────────────────────────────────────────
  const avgFiber = avg(last7, 'fiber');
  const fiberGoal = goals.fiber || 25;
  if (avgFiber > 0 && avgFiber < fiberGoal * 0.6) {
    insights.push({
      priority: 4, type: 'warning', icon: '🥦',
      title: `Low fiber — avg ${Math.round(avgFiber)}g/day`,
      body: `Goal is ${fiberGoal}g. Low fiber is linked to poor gut health, increased hunger, and blood sugar spikes. Add: lentils (16g/cup), avocado (10g), raspberries (8g/cup), oats (4g/½ cup).`,
      action: null,
    });
  }

  // ── Sodium ──────────────────────────────────────────────────────────────────
  const avgSodium = avg(last7, 'sodium');
  if (avgSodium > 2800) {
    insights.push({
      priority: 4, type: 'warning', icon: '🧂',
      title: `High sodium — avg ${Math.round(avgSodium)}mg/day`,
      body: `The American Heart Association recommends ≤2300mg. High sodium causes water retention and raises blood pressure. Watch: processed meats, canned soups, restaurant meals.`,
      action: null,
    });
  } else if (avgSodium > 0 && avgSodium < 1500) {
    insights.push({
      priority: 6, type: 'info', icon: '💧',
      title: `Low sodium intake`,
      body: `Averaging only ${Math.round(avgSodium)}mg sodium. If active, ensure adequate electrolytes — too little sodium can cause fatigue and muscle cramps.`,
      action: null,
    });
  }

  // ── Water ───────────────────────────────────────────────────────────────────
  const waterGoal = goals.water || 8;
  const waterDays = last7Dates.filter(d => water[d] != null);
  if (waterDays.length >= 3) {
    const avgWater = waterDays.reduce((s, d) => s + (water[d] || 0), 0) / waterDays.length;
    if (avgWater < waterGoal * 0.75) {
      insights.push({
        priority: 3, type: 'warning', icon: '💧',
        title: `Low hydration — avg ${avgWater.toFixed(1)} glasses/day`,
        body: `You're below your ${waterGoal}-glass daily goal. Dehydration reduces energy, impairs performance, and can mask hunger as appetite. Set a 9am/1pm/5pm reminder.`,
        action: null,
      });
    }
  }

  // ── Consistency ─────────────────────────────────────────────────────────────
  if (last7.length < 5) {
    insights.push({
      priority: 2, type: 'info', icon: '📝',
      title: `Logging ${last7.length}/7 days — improve consistency`,
      body: `Consistent logging is the #1 predictor of goal success. Research shows people who log 6+ days/week lose 2× more weight. Try logging right after each meal.`,
      action: null,
    });
  }

  // ── Weight plateau ──────────────────────────────────────────────────────────
  const recentBody = [...body].sort((a, b) => b.date.localeCompare(a.date)).filter(b => b.weight != null);
  if (detectPlateau(body, s.units, 14)) {
    insights.push({
      priority: 2, type: 'info', icon: '📊',
      title: 'Weight plateau detected',
      body: `Your weight has barely moved in 2 weeks. Common breaks: add a refeed day (+200 kcal), vary workout intensity, or check if your TDEE estimate needs updating.`,
      action: null,
    });
  }

  // ── TDEE goal-revision ──────────────────────────────────────────────────────
  const tdee = estimateTDEE(last30, recentBody, s.units || 'lbs');
  if (tdee && Math.abs(tdee - calGoal) > 150) {
    const diff = tdee - calGoal;
    insights.push({
      priority: 1, type: diff > 0 ? 'success' : 'warning', icon: '🧮',
      title: `Goal calibration: estimated TDEE ${tdee > calGoal ? 'higher' : 'lower'} than goal`,
      body: `Based on your weight data and calorie intake, your estimated maintenance is ~${tdee} kcal/day. Your current goal is ${calGoal} kcal. ${diff > 0 ? `You may have more room to eat — consider raising your goal by ${Math.round(diff)} kcal.` : `Your goal may be too high for your current metabolism — consider lowering by ${Math.round(Math.abs(diff))} kcal.`}`,
      action: { label: `Set goal to ${tdee} kcal`, tdee },
    });
  }

  // ── Mood correlations ───────────────────────────────────────────────────────
  const moodDays = Object.keys(mood).sort().slice(-14);
  if (moodDays.length >= 5) {
    const nutMap = Object.fromEntries(nutrition.map(n => [n.date, n]));
    const protVals = moodDays.filter(d => nutMap[d] && mood[d]?.energy != null).map(d => nutMap[d].protein);
    const energyVals = moodDays.filter(d => nutMap[d] && mood[d]?.energy != null).map(d => mood[d].energy);
    const r = pearson(protVals, energyVals);
    if (r !== null && r > 0.4) {
      insights.push({
        priority: 5, type: 'success', icon: '⚡',
        title: 'Protein boosts your energy',
        body: `Your data shows a ${(r * 100).toFixed(0)}% correlation between protein intake and energy levels. Higher protein days are your higher-energy days.`,
        action: null,
      });
    } else if (r !== null && r < -0.4) {
      insights.push({
        priority: 5, type: 'info', icon: '😴',
        title: 'Pattern: high protein → lower energy?',
        body: `Interestingly, your energy scores dip on high-protein days. This could indicate overeating on those days, or heavy meals affecting sleep quality.`,
        action: null,
      });
    }
  }

  // ── Weekend vs weekday pattern ──────────────────────────────────────────────
  if (last14.length >= 8) {
    const weekday = last14.filter(d => { const dow = new Date(d.date + 'T12:00:00').getDay(); return dow > 0 && dow < 6; });
    const weekend = last14.filter(d => { const dow = new Date(d.date + 'T12:00:00').getDay(); return dow === 0 || dow === 6; });
    if (weekday.length >= 3 && weekend.length >= 2) {
      const wdAvg = avg(weekday, 'cal');
      const weAvg = avg(weekend, 'cal');
      if (weAvg - wdAvg > 400) {
        insights.push({
          priority: 6, type: 'info', icon: '📅',
          title: `Weekend surplus: +${Math.round(weAvg - wdAvg)} kcal over weekdays`,
          body: `You eat ~${Math.round(weAvg - wdAvg)} more calories on weekends vs weekdays. This can undo a week's deficit. Plan ahead: choose restaurants that show nutrition info, prep healthy snacks.`,
          action: null,
        });
      }
    }
  }

  // Sort by priority and return top 4
  return insights
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
}

// ─── Chat engine ──────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'How am I doing this week?',
  'What should I eat for more protein?',
  'Why is my weight not changing?',
  'How do I break a plateau?',
  'What are good high-fiber foods?',
  'How do I calculate my TDEE?',
  'Am I in a calorie deficit?',
  'How much water should I drink?',
];

function generateResponse(question, s) {
  const q = question.toLowerCase();
  const goals = s.goals || {};
  const nutrition = s.nutrition || [];
  const body = s.body || [];
  const water = s.water || {};

  const last7 = Array.from({ length: 7 }, (_, i) => ago(i)).map(d => nutrition.find(n => n.date === d)).filter(Boolean);
  const last30 = Array.from({ length: 30 }, (_, i) => ago(i)).map(d => nutrition.find(n => n.date === d)).filter(Boolean);
  const avg = (days, key) => days.length ? Math.round(days.reduce((s, d) => s + (d[key] || 0), 0) / days.length) : 0;

  const avgCal = avg(last7, 'cal');
  const avgProt = avg(last7, 'protein');
  const avgFiber = avg(last7, 'fiber');
  const avgSodium = avg(last7, 'sodium');
  const calGoal = goals.cal || 2400;
  const protGoal = goals.protein || 180;

  // Week summary
  if (q.includes('week') || q.includes('doing') || q.includes('summary')) {
    const calDiff = avgCal - calGoal;
    const protStatus = avgProt >= protGoal ? '✅' : avgProt >= protGoal * 0.85 ? '⚡' : '❌';
    return `**7-Day Summary**\n\n• Calories: avg ${avgCal} kcal (goal ${calGoal}) → ${Math.abs(calDiff)} kcal ${calDiff > 0 ? 'surplus' : 'deficit'}\n• Protein: avg ${avgProt}g / ${protGoal}g ${protStatus}\n• Fiber: avg ${avgFiber}g / ${goals.fiber || 25}g\n• Days logged: ${last7.length}/7\n\n${last7.length >= 6 ? '✅ Great consistency!' : last7.length >= 4 ? '⚡ Decent — aim for 6-7 days.' : '📝 Log more consistently for better insights.'}`;
  }

  // Protein guidance
  if (q.includes('protein')) {
    const gap = protGoal - avgProt;
    return `You're averaging **${avgProt}g** protein vs. your **${protGoal}g** goal${gap > 0 ? ` — ${gap}g short daily` : ' — on target! ✅'}.\n\n**High-protein foods:**\n• Greek yogurt: 17g/cup (low cal)\n• Chicken breast: 31g/100g\n• Cottage cheese: 14g/½ cup\n• Canned tuna: 25g/100g\n• Eggs: 6g each\n• Lentils: 18g/cup (+ fiber)\n• Whey protein: 25g/scoop\n\n**Tip:** Spread protein across 3-4 meals (30-40g each) for optimal muscle protein synthesis.`;
  }

  // Weight/plateau
  if (q.includes('weight') || q.includes('plateau') || q.includes('not changing') || q.includes('stuck')) {
    const recentWeights = [...body].sort((a, b) => b.date.localeCompare(a.date)).filter(b => b.weight != null);
    const isPlateau = detectPlateau(body, s.units, 14);
    const tdee = estimateTDEE(last30, recentWeights, s.units || 'lbs');
    return `${isPlateau ? '**Plateau detected** — your weight has barely moved in 2 weeks.\n\n' : ''}**Why weight stalls:**\n• Metabolism adapts to lower intake over time\n• Water retention masks fat loss (hormones, sodium, glycogen)\n• Calorie estimates drift — portions creep up\n\n**Plateau breakers:**\n• Take a 2-day diet break at TDEE (${tdee ? tdee + ' kcal' : 'maintenance'}) to reset hormones\n• Add 1-2 high-intensity cardio sessions\n• Reduce sodium for 3-5 days to flush retained water\n• Recalculate portion sizes with a food scale\n\n**Your estimated TDEE:** ${tdee ? `~${tdee} kcal/day (based on weight change data)` : 'Need 4+ weeks of data to estimate'}`;
  }

  // Deficit / calorie question
  if (q.includes('deficit') || (q.includes('calorie') && !q.includes('tdee') && !q.includes('maintenance'))) {
    const diff = calGoal - avgCal;
    const inDeficit = diff > 0;
    return `**Your calorie picture:**\n\nGoal: **${calGoal} kcal** | Avg intake: **${avgCal} kcal**\n\n${inDeficit ? `You're in a **${Math.round(diff)} kcal/day deficit**. At this rate: ~${(diff * 7 / 3500).toFixed(2)} lbs/week loss.` : `You're in a **${Math.round(Math.abs(diff))} kcal surplus**. At this rate: ~${(Math.abs(diff) * 7 / 3500).toFixed(2)} lbs/week gain.`}\n\n**Practical tips:**\n• 500 kcal deficit → ~1 lb/week loss (sustainable)\n• 1000 kcal deficit → risks muscle loss, fatigue\n• Stay above your BMR (~${Math.round(calGoal * 0.65)} kcal est.) to protect metabolism`;
  }

  // Fiber
  if (q.includes('fiber')) {
    return `You're averaging **${avgFiber}g** fiber/day (goal: ${goals.fiber || 25}g).\n\n**Best fiber sources:**\n• **Legumes**: lentils (16g/cup), black beans (15g), chickpeas (12g)\n• **Vegetables**: broccoli (5g/cup), Brussels sprouts (4g), sweet potato (4g)\n• **Fruits**: avocado (10g), raspberries (8g/cup), pear (5.5g)\n• **Grains**: oats (4g/½ cup), quinoa (5g/cup), whole wheat bread (2g/slice)\n\n**Benefits:** Improves gut microbiome, reduces hunger, lowers cholesterol, stabilizes blood sugar.`;
  }

  // TDEE / maintenance
  if (q.includes('tdee') || q.includes('maintenance')) {
    const recentWeights = [...body].sort((a, b) => b.date.localeCompare(a.date)).filter(b => b.weight != null);
    const tdee = estimateTDEE(last30, recentWeights, s.units || 'lbs');
    return `**TDEE (Total Daily Energy Expenditure)** = calories to maintain your weight.\n\n${tdee ? `**Your estimated TDEE: ~${tdee} kcal/day**\n(Calculated from weight change + calorie data over 30 days)\n\nYour current goal: ${calGoal} kcal → ${calGoal < tdee ? `${tdee - calGoal} kcal deficit` : `${calGoal - tdee} kcal surplus`}\n\n` : ''}**Formula: BMR × Activity Factor**\n• Sedentary: ×1.2\n• Light activity: ×1.375\n• Moderate: ×1.55 (3-5 days/week)\n• Very active: ×1.725\n\nTDEE changes as you lose/gain weight. Recheck every 4-6 weeks.`;
  }

  // Water / hydration
  if (q.includes('water') || q.includes('hydration') || q.includes('drink')) {
    const waterGoal = goals.water || 8;
    const today7 = Array.from({ length: 7 }, (_, i) => ago(i)).filter(d => water[d] != null);
    const avgWater = today7.length ? (today7.reduce((s, d) => s + (water[d] || 0), 0) / today7.length).toFixed(1) : null;
    return `${avgWater ? `You're averaging **${avgWater} glasses/day** (goal: ${waterGoal}). ${parseFloat(avgWater) >= waterGoal ? '✅ Well hydrated!' : '📉 Below target.'}\n\n` : ''}**Hydration recommendations:**\n• General: ~8 cups (64 oz / 2L) per day\n• Active: add 12–16 oz per hour of exercise\n• Hot weather: add 16 oz\n\n**Benefits of hydration:**\n• Reduces false hunger (thirst mimics hunger)\n• Improves energy and cognitive function\n• Supports kidney function and metabolism\n\n**Trick:** Drink a full glass before each meal.`;
  }

  // Sleep / recovery
  if (q.includes('sleep') || q.includes('recover') || q.includes('rest')) {
    return `**Sleep and nutrition are tightly linked:**\n\n• Poor sleep ↑ ghrelin (hunger hormone) by 24%\n• Sleep deprivation raises cortisol → muscle breakdown + fat storage\n• 7-9 hours is optimal for body composition\n\n**Nutrition for better sleep:**\n• Avoid large meals 2-3h before bed\n• Limit caffeine after 2pm\n• Magnesium-rich foods: pumpkin seeds, dark chocolate, spinach\n• Tryptophan sources: turkey, dairy, bananas\n\n**Tip:** Log your mood/energy after good vs. bad sleep nights to find your patterns.`;
  }

  // Sodium
  if (q.includes('sodium') || q.includes('salt')) {
    return `You're averaging **${avgSodium}mg** sodium/day (limit: 2300mg).\n\n**High-sodium culprits:**\n• Restaurant meals (1000-3000mg per dish)\n• Processed meats: bacon, deli meats, sausages\n• Canned soups (800-1000mg per cup)\n• Condiments: soy sauce (900mg/tbsp), ketchup\n• Bread and cheese\n\n**Lower-sodium swaps:**\n• Fresh herbs instead of salt\n• Lemon juice to enhance flavor\n• Rinsed canned beans (cuts sodium 40%)\n• "No salt added" canned goods\n\nHigh sodium doesn't cause fat gain but causes water retention — weight can fluctuate 2-4 lbs from sodium alone.`;
  }

  // Default
  return `I'm your nutrition coach — powered by your actual data.\n\nThings I can analyze:\n• **Weekly progress** — calories, protein, consistency\n• **Plateau diagnosis** — why weight stalls and how to fix it\n• **TDEE estimation** — your actual maintenance from data\n• **Macro guidance** — protein, fiber, fat breakdown\n• **Hydration & sodium** — trends and recommendations\n\nWhat would you like to explore?`;
}

// ─── CoachTab ─────────────────────────────────────────────────────────────────

export function CoachTab({ s, dispatch }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${s.profile?.firstName || 'there'}! I'm your nutrition coach. I analyze your actual data — no guesswork. What's on your mind?` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const insights = useMemo(() => generateInsights(s), [s]);

  const send = async (text) => {
    const q = text.trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    Analytics.track('coach_message', { length: q.length });
    await new Promise(r => setTimeout(r, 500));
    const response = generateResponse(q, s);
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
    Haptic.light();
  };

  const handleGoalRevision = (tdee) => {
    dispatch({ type: 'GOALS', g: { cal: tdee } });
    setMessages(prev => [...prev, { role: 'assistant', content: `✅ Calorie goal updated to **${tdee} kcal/day** based on your estimated TDEE. This is your maintenance level — adjust up or down based on your weight goal (+/- 300-500 kcal).` }]);
    Analytics.track('goal_revised', { source: 'coach', tdee });
  };

  const insightColor = (type) => ({
    success: V.accent, warning: V.warn, info: V.accent2,
  }[type] || V.accent2);

  const visibleQuestions = showAllQuestions ? QUICK_QUESTIONS : QUICK_QUESTIONS.slice(0, 3);

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>AI Coach</div>
        <div style={{ fontSize: 10, color: V.text3, padding: '3px 8px', background: `${V.accent}15`, borderRadius: 6, border: `1px solid ${V.accent}30` }}>
          Data-driven insights
        </div>
      </div>

      {/* Insights panel */}
      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Personalized Insights
          </div>
          {insights.map((insight, i) => (
            <Card key={i} style={{ padding: 12, borderLeft: `3px solid ${insightColor(insight.type)}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{insight.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 3 }}>{insight.title}</div>
                  <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>{insight.body}</div>
                  {insight.action && (
                    <button
                      onClick={() => handleGoalRevision(insight.action.tdee)}
                      aria-label={`Apply goal revision: ${insight.action.label}`}
                      style={{
                        marginTop: 8, fontSize: 11, fontWeight: 700, padding: '5px 10px',
                        borderRadius: 8, border: `1px solid ${V.accent}40`, background: `${V.accent}15`,
                        color: V.accent, cursor: 'pointer', fontFamily: V.font,
                      }}
                    >
                      {insight.action.label}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Chat */}
      <Card style={{ padding: 0, overflow: 'hidden' }} role="region" aria-label="Coach chat">
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${V.cardBorder}`, fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Chat with Coach
        </div>

        {/* Messages */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Coach conversation"
          style={{ padding: 12, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%', padding: '9px 13px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? `linear-gradient(135deg,${V.accent},${V.accent2})` : V.card,
                border: msg.role === 'assistant' ? `1px solid ${V.cardBorder}` : 'none',
                fontSize: 13, color: msg.role === 'user' ? '#060a0e' : V.text, lineHeight: 1.55,
                fontWeight: msg.role === 'user' ? 600 : 400,
                whiteSpace: 'pre-line',
              }}>
                {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }} aria-label="Coach is thinking" aria-live="polite">
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: V.card, border: `1px solid ${V.cardBorder}` }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: 3, background: V.text3, animation: `bounce .8s ${j * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {visibleQuestions.map(q => (
            <button key={q} onClick={() => send(q)}
              aria-label={`Ask: ${q}`}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${V.cardBorder}`, background: 'transparent', color: V.text3, cursor: 'pointer', fontFamily: V.font }}>
              {q}
            </button>
          ))}
          <button onClick={() => setShowAllQuestions(p => !p)}
            aria-expanded={showAllQuestions}
            aria-label={showAllQuestions ? 'Show fewer questions' : 'Show more questions'}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${V.accent}30`, background: `${V.accent}10`, color: V.accent, cursor: 'pointer', fontFamily: V.font }}>
            {showAllQuestions ? 'Less' : 'More…'}
          </button>
        </div>

        {/* Input */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask your coach…"
            aria-label="Message to coach"
            style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 14, fontFamily: V.font, outline: 'none', minHeight: 44 }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            aria-label="Send message"
            style={{ width: 44, height: 44, borderRadius: 12, background: !input.trim() ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg,${V.accent},${V.accent2})`, border: 'none', cursor: !input.trim() ? 'default' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: !input.trim() ? V.text3 : '#060a0e' }}>
            ↑
          </button>
        </div>
      </Card>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: .5; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
