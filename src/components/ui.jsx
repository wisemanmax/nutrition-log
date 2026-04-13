import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { V } from '../utils/theme';
import { Icons } from './Icons';

// --- Confirm Dialog ---
let _confirmSetState = null;
export const ConfirmCtrl = {
  show: (msg, detail, onConfirm) => { if (_confirmSetState) _confirmSetState({ msg, detail, onConfirm }); },
  clear: () => { if (_confirmSetState) _confirmSetState(null); },
};
export function GlobalConfirm() {
  const [state, setState] = useState(null);
  useEffect(() => { _confirmSetState = setState; return () => { _confirmSetState = null; }; }, []);
  if (!state) return null;
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9995, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)" }} onClick={() => ConfirmCtrl.clear()} />
      <div role="alertdialog" aria-modal="true" style={{ position: "relative", background: V.sheetBg, borderRadius: 16, padding: 24, maxWidth: 320, width: "100%", border: `1px solid ${V.cardBorder}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: V.text, marginBottom: 6 }}>{state.msg}</div>
        {state.detail && <div style={{ fontSize: 12, color: V.text3, lineHeight: 1.5, marginBottom: 16 }}>{state.detail}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn v="secondary" full onClick={() => ConfirmCtrl.clear()}>Cancel</Btn>
          <Btn full onClick={() => { state.onConfirm(); ConfirmCtrl.clear(); }} s={{ background: V.danger }}>Confirm</Btn>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Success Toast ---
let _toastSet = null;
export const SuccessToastCtrl = {
  show: (msg) => { if (_toastSet) _toastSet(msg); },
};
export function SuccessToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { _toastSet = setMsg; return () => { _toastSet = null; }; }, []);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
      padding: "10px 20px", borderRadius: 12, background: "rgba(74,222,128,0.15)", border: `1px solid ${V.accent}40`,
      fontSize: 13, fontWeight: 600, color: V.accent, backdropFilter: "blur(10px)", animation: "fadeUp .3s ease" }}>
      {msg}
    </div>,
    document.body
  );
}

// --- Button ---
export const Btn = ({ children, onClick, v = "primary", full, s, disabled, ...rest }) => {
  const base = { border: "none", cursor: disabled ? "default" : "pointer", fontFamily: V.font, fontWeight: 700,
    fontSize: 14, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all .15s", opacity: disabled ? 0.4 : 1, WebkitTapHighlightColor: "transparent",
    ...(full ? { width: "100%" } : {}), minHeight: 44 };
  const variants = {
    primary: { background: `linear-gradient(135deg,${V.accent},${V.accent2})`, color: V.bg, padding: "12px 20px", boxShadow: `0 4px 12px ${V.accent}30` },
    secondary: { background: "rgba(255,255,255,0.04)", color: V.text2, padding: "12px 20px", border: `1px solid ${V.cardBorder}` },
    danger: { background: "rgba(255,107,107,0.1)", color: V.danger, padding: "12px 20px", border: `1px solid ${V.danger}30` },
    ghost: { background: "transparent", color: V.accent, padding: "8px 12px" },
    small: { background: `${V.accent}10`, color: V.accent, padding: "6px 12px", fontSize: 11, borderRadius: 8, minHeight: 32 },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[v], ...s }} disabled={disabled} {...rest}>{children}</button>;
};

// --- Card ---
export const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 16, padding: 16, ...style }}>
    {children}
  </div>
);

// --- Field ---
export const Field = ({ label, type = "text", value, onChange, placeholder, unit, min, max, step, autoFocus, inputMode, style: wrapStyle }) => (
  <div style={{ marginBottom: 12, ...wrapStyle }}>
    {label && <div style={{ fontSize: 11, color: V.text3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6, fontWeight: 600 }}>{label}</div>}
    <div style={{ position: "relative" }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        min={min} max={max} step={step} autoFocus={autoFocus} inputMode={inputMode}
        style={{ width: "100%", padding: "12px 14px", paddingRight: unit ? 44 : 14, background: "rgba(255,255,255,0.04)",
          border: `1px solid ${V.cardBorder}`, borderRadius: 12, color: V.text, fontSize: 16, fontFamily: V.mono,
          outline: "none", boxSizing: "border-box", WebkitAppearance: "none", minHeight: 44 }} />
      {unit && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: V.text3 }}>{unit}</span>}
    </div>
  </div>
);

// --- Progress ---
export const Progress = ({ val, max, color = V.accent, h = 6 }) => (
  <div style={{ width: "100%", height: h, background: "rgba(255,255,255,0.05)", borderRadius: h, overflow: "hidden" }}>
    <div style={{ width: `${max > 0 ? Math.min(100, (val / max) * 100) : 0}%`, height: "100%",
      background: max > 0 && val > max ? V.danger : `linear-gradient(90deg,${color},${color}bb)`, borderRadius: h, transition: "width .4s ease" }} />
  </div>
);

// --- Sheet ---
export const Sheet = ({ title, onClose, children, footer }) => {
  const isDesktop = window.innerWidth >= 768;
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9990,
      background: isDesktop ? "rgba(0,0,0,0.6)" : V.sheetBg,
      display: "flex", flexDirection: "column",
      ...(isDesktop ? { alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" } : {}),
    }}
      role="dialog" aria-modal="true" aria-label={title}
      {...(isDesktop ? { onClick: (e) => { if (e.target === e.currentTarget) onClose(); } } : {})}>
      <div style={{
        display: "flex", flexDirection: "column",
        ...(isDesktop ? { maxWidth: 700, width: "100%", maxHeight: "85vh", borderRadius: 20, overflow: "hidden",
          background: V.sheetBg, border: `1px solid ${V.cardBorder}`, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" } :
          { flex: 1, minHeight: 0, overflow: "hidden" }),
      }}>
        <div className="sheet-head" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          paddingLeft: 16, paddingRight: 16, paddingBottom: 12, borderBottom: `1px solid ${V.cardBorder}`, background: V.sheetBg, zIndex: 2,
          ...(isDesktop ? { paddingTop: 16 } : {}),
        }}>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
            cursor: "pointer", padding: "8px 4px", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>
            {Icons.chevLeft({ size: 20, color: V.accent })}
            <span style={{ fontSize: 14, color: V.accent, fontWeight: 600 }}>Back</span>
          </button>
          <h3 style={{ margin: 0, fontSize: 16, color: V.text, fontFamily: V.font, fontWeight: 700, flex: 1, textAlign: "center", paddingRight: 50 }}>{title}</h3>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: 20 }}>
          {children}
        </div>
        {footer && <div className="sheet-footer" style={{ background: V.sheetBg }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

// --- Chip ---
export const Chip = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{ padding: "7px 14px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600,
    fontFamily: V.font, cursor: "pointer", WebkitTapHighlightColor: "transparent", transition: "all .15s",
    background: active ? `${color || V.accent}18` : "rgba(255,255,255,0.04)",
    color: active ? (color || V.accent) : V.text3 }}>
    {label}
  </button>
);

// --- Stat ---
export const Stat = ({ label, value, color, sub }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 20, fontWeight: 800, color: color || V.text, fontFamily: V.mono }}>{value}</div>
    <div style={{ fontSize: 9, color: V.text3, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
    {sub && <div style={{ fontSize: 9, color: V.text3 }}>{sub}</div>}
  </div>
);
