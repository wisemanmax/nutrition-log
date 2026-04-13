import React, { useState, useMemo } from 'react';
import { V, Haptic } from '../utils/theme';
import { LS } from '../utils/storage';
import { Card, Btn, Progress, Stat } from '../components/ui';
import { Icons } from '../components/Icons';
import { today, ago } from '../utils/helpers';

// --- Macro Ring ---
function MacroRing({ value, goal, color, label }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <svg width={54} height={54} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={27} cy={27} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
        <circle cx={27} cy={27} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" style={{ transition: "stroke-dashoffset .5s" }} />
      </svg>
      <div style={{ marginTop: -40, display: "flex", flexDirection: "column", alignItems: "center", height: 40, justifyContent: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color, fontFamily: V.mono }}>{value}</div>
        <div style={{ fontSize: 7, color: V.text3 }}>/{goal}</div>
      </div>
      <div style={{ fontSize: 8, color: V.text3, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// --- Nutrition streak ---
function useNutritionStreak(nutrition) {
  return useMemo(() => {
    let c = 0, i = 0;
    while (nutrition.some(n => n.date === ago(i))) { c++; i++; }
    return c;
  }, [nutrition]);
}

export function HomeTab({ s, d }) {
  const streak = useNutritionStreak(s.nutrition);
  const td = today();
  const todayN = s.nutrition.find(n => n.date === td);
  const tCal = todayN?.cal || 0, tProt = todayN?.protein || 0, tCarbs = todayN?.carbs || 0, tFat = todayN?.fat || 0;
  const calGoal = s.goals?.cal || 2400, protGoal = s.goals?.protein || 180;
  const calRemaining = calGoal - tCal;
  const todayMeals = Array.isArray(todayN?.meals) ? todayN.meals : [];

  const [waterCount, setWaterCount] = useState(() => parseInt(LS.get("nl-water-" + today())) || 0);

  const name = s.profile?.firstName || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Greeting */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: V.text }}>{greeting}{name ? `, ${name}` : ""}</div>
          <div style={{ fontSize: 12, color: V.text3, marginTop: 2 }}>
            {streak > 0 ? <span style={{ color: V.accent }}>&#x1F525; {streak}-day streak</span> : "Start logging today"}
          </div>
        </div>
        <div>{Icons.leaf({ size: 24, color: V.accent })}</div>
      </div>

      {/* Calorie Budget Card */}
      <Card style={{ padding: 16, background: `linear-gradient(135deg,${V.accent}10,${V.accent2}08)`, border: `1px solid ${V.accent}20` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Calories Remaining</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: calRemaining >= 0 ? V.accent : V.danger, fontFamily: V.mono, lineHeight: 1 }}>
              {Math.abs(calRemaining)}
            </div>
            <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>
              {calRemaining >= 0 ? "left today" : "over budget"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: V.text3 }}>logged</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: V.warn, fontFamily: V.mono }}>{tCal}</div>
            <div style={{ fontSize: 10, color: V.text3 }}>/ {calGoal}</div>
          </div>
        </div>
        <Progress val={tCal} max={calGoal} color={tCal > calGoal ? V.danger : V.accent} h={8} />
      </Card>

      {/* Macro rings */}
      {tCal > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <MacroRing value={tProt} goal={s.goals?.protein || 180} color={V.accent} label="Protein" />
            <MacroRing value={tCarbs} goal={s.goals?.carbs || 250} color={V.accent2} label="Carbs" />
            <MacroRing value={tFat} goal={s.goals?.fat || 70} color={V.warn} label="Fat" />
          </div>
        </Card>
      )}

      {/* Quick log button */}
      <Btn full onClick={() => d({ type: "TAB", tab: "log" })}>
        {Icons.plus({ size: 16, color: "#060a0e" })} Log Today's Nutrition
      </Btn>

      {/* Today's meals preview */}
      {todayMeals.some(m => (m.items || []).length > 0) && (
        <Card style={{ padding: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Today's Meals</div>
          {todayMeals.filter(m => (m.items || []).length > 0).map((meal, i) => {
            const mCal = (meal.items || []).reduce((s, it) => s + it.cal, 0);
            const mProt = (meal.items || []).reduce((s, it) => s + it.protein, 0);
            return (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{meal.name}</div>
                  <div style={{ fontSize: 10, color: V.text3 }}>{(meal.items || []).length} items</div>
                </div>
                <div style={{ textAlign: "right", fontFamily: V.mono }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: V.warn }}>{mCal}</div>
                  <div style={{ fontSize: 10, color: V.accent }}>{mProt}P</div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Water tracker */}
      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Icons.droplet({ size: 16, color: V.accent2 })}
            <span style={{ fontSize: 13, fontWeight: 700, color: V.text }}>Water</span>
            <span style={{ fontSize: 10, color: waterCount >= 8 ? V.accent : V.text3, fontWeight: 600 }}>{waterCount >= 8 ? "Goal hit!" : ""}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => { if (waterCount > 0) { const n = waterCount - 1; setWaterCount(n); LS.set("nl-water-" + td, n); } }}
              style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${V.cardBorder}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: V.text3 }}>-</button>
            <div style={{ minWidth: 54, textAlign: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: V.accent2, fontFamily: V.mono }}>{waterCount}</span>
              <span style={{ fontSize: 10, color: V.text3 }}>/8</span>
            </div>
            <button onClick={() => { Haptic.light(); const n = waterCount + 1; setWaterCount(n); LS.set("nl-water-" + td, n); }}
              style={{ width: 32, height: 32, borderRadius: 8, background: `${V.accent2}15`, border: `1px solid ${V.accent2}25`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: V.accent2, fontWeight: 700 }}>+</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 20, borderRadius: 4, background: i < waterCount ? `${V.accent2}60` : "rgba(255,255,255,0.04)", transition: "background .2s" }} />
          ))}
        </div>
      </Card>

      {/* 7-day adherence */}
      {s.nutrition.length > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.text }}>7-Day Adherence</div>
            <div style={{ fontSize: 9, color: V.text3 }}>Calories & Protein</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const day = ago(6 - i);
              const n = s.nutrition.find(x => x.date === day);
              const calOk = n && s.goals?.cal ? n.cal >= s.goals.cal * 0.85 : false;
              const protOk = n && s.goals?.protein ? n.protein >= s.goals.protein * 0.9 : false;
              const both = calOk && protOk; const either = calOk || protOk; const isToday = day === today();
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                  <div style={{ width: "100%", height: 28, borderRadius: 5, border: isToday ? `1px solid ${V.accent}40` : "none",
                    background: both ? "linear-gradient(180deg,#22c55e,#16a34a)" : either ? "linear-gradient(180deg,#f59e0b,#d97706)" : n ? "rgba(244,63,94,0.25)" : "rgba(255,255,255,0.04)" }} />
                  <div style={{ fontSize: 7, color: isToday ? V.accent : V.text3, fontWeight: isToday ? 700 : 400 }}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(day + "T12:00:00").getDay()]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            {[{ c: "#22c55e", l: "Both" }, { c: "#f59e0b", l: "Partial" }, { c: "rgba(244,63,94,0.4)", l: "Missed" }].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} /><span style={{ fontSize: 7, color: V.text3 }}>{x.l}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {s.nutrition.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: V.text3 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#x1F957;</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: V.text2, marginBottom: 6 }}>Nothing logged yet</div>
          <div style={{ fontSize: 13 }}>Tap Log above to track your first meal</div>
        </div>
      )}
    </div>
  );
}
