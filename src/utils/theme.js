import { LS } from './storage';

export const DARK_THEME = {
  bg: "#060a0e", card: "rgba(255,255,255,0.03)", cardBorder: "rgba(255,255,255,0.07)",
  accent: "#4ade80", accent2: "#22d3ee", warn: "#fb923c", danger: "#f43f5e", purple: "#a78bfa", gold: "#fbbf24",
  text: "#e2e8f0", text2: "#94a3b8", text3: "#475569",
  font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  sheetBg: "linear-gradient(180deg,#0f172a,#060a0e)", navBg: "rgba(6,10,14,0.96)", mode: "dark",
};
export const LIGHT_THEME = {
  bg: "#f8fafc", card: "rgba(0,0,0,0.03)", cardBorder: "rgba(0,0,0,0.08)",
  accent: "#16a34a", accent2: "#0891b2", warn: "#ea580c", danger: "#dc2626", purple: "#7c3aed", gold: "#d97706",
  text: "#0f172a", text2: "#475569", text3: "#94a3b8",
  font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  sheetBg: "linear-gradient(180deg,#ffffff,#f1f5f9)", navBg: "rgba(248,250,252,0.96)", mode: "light",
};
export const V = { ...(LS.get("nl-theme") === "light" ? LIGHT_THEME : DARK_THEME) };
export const setTheme = (mode) => {
  const t = mode === "light" ? LIGHT_THEME : DARK_THEME;
  Object.assign(V, t);
  LS.set("nl-theme", mode);
  document.body.style.background = V.bg;
  document.body.style.color = V.text;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", V.bg);
};

export const Haptic = {
  light: () => { try { navigator.vibrate?.(10); } catch (e) {} },
  medium: () => { try { navigator.vibrate?.(25); } catch (e) {} },
  heavy: () => { try { navigator.vibrate?.([30, 20, 50]); } catch (e) {} },
  success: () => { try { navigator.vibrate?.([10, 30, 10, 30, 50]); } catch (e) {} },
};
