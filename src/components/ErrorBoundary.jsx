import React from 'react';
import { V } from '../utils/theme';

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e, info) {
    console.error("NutritionLog Error:", e, info);
    if (typeof Sentry !== "undefined") Sentry.captureException(e, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.err) return React.createElement("div", {
      style: { padding: 40, textAlign: "center", background: V.bg, color: V.text, minHeight: "100vh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: V.font }
    },
      React.createElement("div", { style: { fontSize: 48 } }, "\u26a0\ufe0f"),
      React.createElement("div", { style: { fontSize: 18, fontWeight: 700 } }, "Something went wrong"),
      React.createElement("div", { style: { fontSize: 12, color: V.text3, maxWidth: 300 } }, this.state.err?.message || "Unknown error"),
      React.createElement("button", {
        onClick: () => window.location.reload(),
        style: { padding: "12px 24px", borderRadius: 10, background: V.accent, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: V.bg }
      }, "Reload App"),
      React.createElement("button", {
        onClick: () => {
          try {
            const keys = ["nl-nutrition", "nl-body", "nl-goals", "nl-units", "nl-profile"];
            const data = {};
            keys.forEach(k => { try { const v = localStorage.getItem(k); if (v) data[k.replace("nl-", "")] = JSON.parse(v); } catch (e) {} });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `nutritionlog-emergency-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
            URL.revokeObjectURL(url);
          } catch (e) { alert("Export failed: " + e.message); }
        },
        style: { padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `1px solid ${V.cardBorder}`, cursor: "pointer", fontSize: 11, color: V.text3 }
      }, "Emergency Data Export")
    );
    return this.props.children;
  }
}

export default ErrorBoundary;
