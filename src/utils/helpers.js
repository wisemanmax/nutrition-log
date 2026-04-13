// --- Helpers ---
export const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 11));
export const today = () => new Date().toISOString().split("T")[0];
export const thisMonth = () => today().slice(0, 7);
export const monthAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().split("T")[0].slice(0, 7); };
export const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; };
export const fmtShort = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const fmtFull = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const fmtDate = (d) => {
  if (d === today()) return "Today";
  if (d === ago(1)) return "Yesterday";
  return fmtShort(d);
};

export const fmtMoney = (n, dec = 2) => {
  if (n == null || isNaN(n)) return "$0.00";
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

export const fmtShortMoney = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1e6) return "$" + (abs / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (abs / 1e3).toFixed(1) + "k";
  return "$" + abs.toFixed(0);
};

export const mShort = (m) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][parseInt(m.split("-")[1]) - 1] || m;

// Floating-point safe arithmetic
export const safeAdd = (a, b) => Math.round((a + b) * 100) / 100;
export const safeSub = (a, b) => Math.round((a - b) * 100) / 100;
export const safeSum = (arr) => arr.reduce((s, v) => safeAdd(s, v), 0);

// Validation
export const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

// Shared recharts config
export const chartCfg = {
  grid: { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.06)" },
  axis: { tick: { fill: "rgba(255,255,255,0.4)", fontSize: 10 }, axisLine: false, tickLine: false },
  tip: { contentStyle: { background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12, color: "#fff" }, itemStyle: { color: "#fff" } },
};

// --- Unit conversion helpers (NutritionLog) ---
export const wUnit = (u) => u === "kg" ? "kg" : "lbs";
export const dUnit = (u) => u === "kg" ? "cm" : "in";
export const toKg = (lbs) => Math.round(lbs * 0.453592 * 10) / 10;
export const toLbs = (kg) => Math.round(kg * 2.20462 * 10) / 10;
