import React, { useState, useRef, useEffect } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn, Sheet } from '../components/ui';
import { Analytics } from '../utils/analytics';
import { today, ago } from '../utils/helpers';

// ─── Insight generator (client-side, no AI cost) ─────────────────────────────

function generateInsights(s) {
  const insights = [];
  const goals = s.goals || {};
  const nutrition = s.nutrition || [];
  const body = s.body || [];

  // Last 7 days nutrition
  const last7 = Array.from({ length: 7 }, (_, i) => ago(i))
    .map(date => nutrition.find(n => n.date === date))
    .filter(Boolean);

  if (last7.length >= 3) {
    const avgProtein = Math.round(last7.reduce((s, d) => s + (d.protein || 0), 0) / last7.length);
    const protGoal = goals.protein || 180;
    if (avgProtein < protGoal * 0.85) {
      insights.push({
        type: 'warning',
        icon: '💪',
        title: 'Low protein this week',
        body: `You've averaged ${avgProtein}g protein over the past ${last7.length} days — ${Math.round(protGoal - avgProtein)}g below your goal. Try adding a protein-rich snack like Greek yogurt, cottage cheese, or a shake.`,
      });
    } else if (avgProtein >= protGoal) {
      insights.push({
        type: 'success',
        icon: '🎯',
        title: 'Protein goal on track',
        body: `Averaging ${avgProtein}g protein/day — right on target. Keep it up!`,
      });
    }

    const avgCal = Math.round(last7.reduce((s, d) => s + (d.cal || 0), 0) / last7.length);
    const calGoal = goals.cal || 2400;
    const deficit = calGoal - avgCal;
    if (deficit > 300) {
      insights.push({
        type: 'info',
        icon: '🔥',
        title: `${Math.abs(deficit)} kcal average deficit`,
        body: `You're in a ${Math.abs(deficit)} kcal/day deficit on average. At this rate, expect ~${(Math.abs(deficit) * 7 / 3500).toFixed(1)} lbs/week of weight loss.`,
      });
    } else if (deficit < -300) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: `${Math.abs(deficit)} kcal average surplus`,
        body: `You're averaging ${Math.abs(deficit)} kcal over your goal. This could lead to ~${(Math.abs(deficit) * 7 / 3500).toFixed(1)} lbs/week of gain if sustained.`,
      });
    }

    const loggedDays = last7.length;
    if (loggedDays < 5) {
      insights.push({
        type: 'info',
        icon: '📝',
        title: 'Logging consistency',
        body: `You've logged ${loggedDays}/7 days this week. Consistent logging is the #1 predictor of success — try to hit 6-7 days.`,
      });
    }
  }

  // Weight trend
  const recentWeights = body.slice(0, 14).filter(b => b.weight != null);
  if (recentWeights.length >= 5) {
    const weights = recentWeights.map(b => b.weight);
    const first = weights[weights.length - 1];
    const last = weights[0];
    const change = last - first;
    if (Math.abs(change) < 0.5 && recentWeights.length >= 10) {
      insights.push({
        type: 'info',
        icon: '📊',
        title: 'Weight plateau detected',
        body: `Your weight has been stable (±0.5${s.units || 'lbs'}) over the past ${recentWeights.length} weigh-ins. Consider adjusting calories by ±200 kcal or changing your exercise pattern.`,
      });
    }
  }

  // Fiber
  if (last7.length >= 3) {
    const avgFiber = Math.round(last7.reduce((s, d) => s + (d.fiber || 0), 0) / last7.length);
    if (avgFiber < 15 && avgFiber > 0) {
      insights.push({
        type: 'warning',
        icon: '🥦',
        title: 'Low fiber intake',
        body: `Averaging only ${avgFiber}g fiber/day (goal: 25g). Add more vegetables, legumes, or whole grains to support digestion and gut health.`,
      });
    }
  }

  // Streak motivation
  const streak = (() => {
    let c = 0, i = 0;
    while (nutrition.some(n => n.date === ago(i))) { c++; i++; }
    return c;
  })();
  if (streak >= 7 && streak % 7 === 0) {
    insights.push({
      type: 'success',
      icon: '🔥',
      title: `${streak}-day streak! Keep going!`,
      body: `You've logged every day for ${streak} consecutive days. Consistency like this is what separates people who hit their goals from those who don't.`,
    });
  }

  return insights.length ? insights : [{
    type: 'info',
    icon: '🌱',
    title: 'Start logging to get insights',
    body: 'Your personal coach insights will appear here once you have a week of data. Log your meals consistently to unlock personalized recommendations.',
  }];
}

// ─── Chat message types ───────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'How am I doing this week?',
  'What should I eat for more protein?',
  'Am I on track for my goals?',
  'What are good high-fiber foods?',
  'How do I calculate my TDEE?',
];

// ─── Simple rule-based chat (Q3 will upgrade to Claude API via Edge Function) ─

function generateResponse(question, s) {
  const q = question.toLowerCase();
  const goals = s.goals || {};
  const nutrition = s.nutrition || [];
  const last7 = Array.from({ length: 7 }, (_, i) => ago(i)).map(date => nutrition.find(n => n.date === date)).filter(Boolean);
  const avgCal = last7.length ? Math.round(last7.reduce((s, d) => s + (d.cal || 0), 0) / last7.length) : 0;
  const avgProt = last7.length ? Math.round(last7.reduce((s, d) => s + (d.protein || 0), 0) / last7.length) : 0;

  if (q.includes('protein')) {
    return `You're averaging **${avgProt}g** protein/day vs. your goal of **${goals.protein || 180}g**. ${avgProt < (goals.protein || 180) ? `You're ${(goals.protein || 180) - avgProt}g short on average.` : 'You\'re hitting your goal!'}\n\nHigh-protein options: Greek yogurt (17g/cup), chicken breast (31g/100g), eggs (6g each), cottage cheese (14g/½ cup), tuna (25g/100g), lentils (9g/cup).`;
  }
  if (q.includes('week') || q.includes('doing')) {
    return `Here's your 7-day summary:\n\n• **Calories**: avg ${avgCal} kcal (goal: ${goals.cal || 2400})\n• **Protein**: avg ${avgProt}g (goal: ${goals.protein || 180}g)\n• **Days logged**: ${last7.length}/7\n\n${last7.length >= 6 ? '✅ Excellent consistency!' : last7.length >= 4 ? '⚡ Good start — aim for 6-7 days.' : '📝 Try to log more consistently.'}`;
  }
  if (q.includes('fiber')) {
    return `Good sources of fiber:\n\n• **Vegetables**: broccoli (5g/cup), carrots (3.6g), spinach (4g)\n• **Legumes**: lentils (15.6g/cup), black beans (15g), chickpeas (12.5g)\n• **Fruits**: pears (5.5g), avocado (10g), raspberries (8g/cup)\n• **Grains**: oats (4g/½ cup), quinoa (5g/cup), whole wheat bread (2g/slice)\n\nAim for 25g+ per day for optimal digestive health.`;
  }
  if (q.includes('tdee') || q.includes('maintenance') || q.includes('calories')) {
    return `**TDEE (Total Daily Energy Expenditure)** is your maintenance calorie level.\n\nFormula: BMR × Activity Multiplier\n\n**Activity multipliers:**\n• Sedentary: ×1.2\n• Light activity: ×1.375\n• Moderate: ×1.55\n• Very active: ×1.725\n\nYour current goal is ${goals.cal || 2400} kcal. After 4-6 weeks of tracking, your actual TDEE can be estimated from weight changes vs. intake.`;
  }
  if (q.includes('track') || q.includes('goal')) {
    const calDiff = avgCal - (goals.cal || 2400);
    return `**Goal check:**\n\n• Calories: avg ${avgCal} → ${Math.abs(calDiff)} kcal ${calDiff > 0 ? 'above' : 'below'} goal\n• Protein: avg ${avgProt}g → ${avgProt >= (goals.protein || 180) ? '✅ on target' : `${(goals.protein || 180) - avgProt}g short`}\n\n${avgProt >= (goals.protein || 180) && Math.abs(calDiff) < 300 ? '🎯 You\'re on track!' : 'Keep logging consistently — data is your best tool.'}`;
  }
  return `I'm your nutrition coach. I can help with:\n• Reviewing your weekly progress\n• Protein, fiber, and macro guidance\n• Understanding your calorie targets\n• Goal tracking analysis\n\nWhat would you like to know?`;
}

// ─── CoachTab ─────────────────────────────────────────────────────────────────

export function CoachTab({ s }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${s.profile?.firstName || 'there'}! 👋 I'm your nutrition coach. I can analyze your logs, answer nutrition questions, and help you hit your goals. What's on your mind?` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const insights = generateInsights(s);

  const send = async (text) => {
    const q = text.trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    Analytics.track('coach_message', { length: q.length });

    // Simulate response time
    await new Promise(r => setTimeout(r, 600));
    const response = generateResponse(q, s);
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
    Haptic.light();
  };

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>AI Coach</div>
        <div style={{ fontSize: 10, color: V.text3, padding: '3px 8px', background: `${V.accent}12`, borderRadius: 6, border: `1px solid ${V.accent}25` }}>
          Powered by AI
        </div>
      </div>

      {/* Daily insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>Today's Insights</div>
        {insights.slice(0, 3).map((insight, i) => (
          <Card key={i} style={{ padding: 12, borderLeft: `3px solid ${insight.type === 'success' ? V.accent : insight.type === 'warning' ? V.warn : V.accent2}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{insight.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: V.text, marginBottom: 3 }}>{insight.title}</div>
                <div style={{ fontSize: 11, color: V.text2, lineHeight: 1.5 }}>{insight.body}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chat */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${V.cardBorder}`, fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          Chat with Coach
        </div>

        {/* Messages */}
        <div style={{ padding: 12, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? `linear-gradient(135deg,${V.accent},${V.accent2})` : V.card,
                border: msg.role === 'assistant' ? `1px solid ${V.cardBorder}` : 'none',
                fontSize: 13, color: msg.role === 'user' ? '#060a0e' : V.text, lineHeight: 1.5,
                fontWeight: msg.role === 'user' ? 600 : 400,
                whiteSpace: 'pre-line',
              }}>
                {msg.content.replace(/\*\*(.*?)\*\*/g, '$1')}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: V.card, border: `1px solid ${V.cardBorder}` }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: V.text3, animation: `bounce .8s ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick questions */}
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUICK_QUESTIONS.slice(0, 3).map(q => (
            <button key={q} onClick={() => send(q)}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${V.cardBorder}`, background: 'transparent', color: V.text3, cursor: 'pointer', fontFamily: V.font }}>
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask your coach…"
            style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 14, fontFamily: V.font, outline: 'none', minHeight: 44 }}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            style={{ width: 44, height: 44, borderRadius: 12, background: !input.trim() ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg,${V.accent},${V.accent2})`, border: 'none', cursor: !input.trim() ? 'default' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
