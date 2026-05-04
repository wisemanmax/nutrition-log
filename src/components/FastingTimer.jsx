import React, { useState, useEffect } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn, Sheet } from './ui';
import { Analytics } from '../utils/analytics';

const PRESETS = [
  { label: '16:8', windowHours: 16, eatHours: 8 },
  { label: '18:6', windowHours: 18, eatHours: 6 },
  { label: '20:4', windowHours: 20, eatHours: 4 },
  { label: 'OMAD', windowHours: 23, eatHours: 1 },
];

function pad(n) { return String(n).padStart(2, '0'); }

function formatDuration(ms) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function CircleTimer({ pct, color, children }) {
  const r = 70, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>
      <svg width={180} height={180} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={90} cy={90} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <circle cx={90} cy={90} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export function FastingTimer({ fasting, d }) {
  const [now, setNow] = useState(Date.now());
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!fasting) {
    return (
      <Card style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: V.text }}>Intermittent Fasting</div>
            <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>No active fast</div>
          </div>
          <Btn v="small" onClick={() => setShowPresets(true)}>Start Fast</Btn>
        </div>

        {showPresets && (
          <Sheet title="Start Fasting" onClose={() => setShowPresets(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRESETS.map(preset => (
                <button key={preset.label} onClick={() => {
                  d({ type: 'START_FAST', windowHours: preset.windowHours });
                  setShowPresets(false);
                  Haptic.success();
                  Analytics.track('fast_started', { preset: preset.label });
                }}
                  style={{ background: V.card, border: `1px solid ${V.cardBorder}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>{preset.label}</div>
                    <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>{preset.windowHours}h fast · {preset.eatHours}h eating window</div>
                  </div>
                  <span style={{ fontSize: 20 }}>▶</span>
                </button>
              ))}
            </div>
          </Sheet>
        )}
      </Card>
    );
  }

  const startedAt = new Date(fasting.startedAt).getTime();
  const windowMs = fasting.windowHours * 3600 * 1000;
  const elapsed = now - startedAt;
  const remaining = Math.max(0, windowMs - elapsed);
  const pct = Math.min(1, elapsed / windowMs);
  const isComplete = elapsed >= windowMs;
  const preset = PRESETS.find(p => p.windowHours === fasting.windowHours);

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: V.text }}>
            {preset?.label || `${fasting.windowHours}:${24 - fasting.windowHours}`} Fast
          </div>
          <div style={{ fontSize: 10, color: isComplete ? V.accent : V.text3 }}>
            {isComplete ? '✓ Fast complete!' : 'In progress'}
          </div>
        </div>
        <Btn v="danger" onClick={() => {
          d({ type: 'STOP_FAST' });
          Haptic.medium();
          Analytics.track('fast_stopped', { elapsed: Math.round(elapsed / 60000) });
        }} style={{ fontSize: 11, minHeight: 32, padding: '6px 12px' }}>
          End Fast
        </Btn>
      </div>

      <CircleTimer pct={pct} color={isComplete ? V.accent : V.accent2}>
        <div style={{ fontSize: 11, color: V.text3, fontWeight: 600 }}>{isComplete ? 'Done!' : 'Remaining'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: isComplete ? V.accent : V.text, fontFamily: V.mono }}>
          {formatDuration(remaining)}
        </div>
        <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>{Math.round(pct * 100)}% complete</div>
      </CircleTimer>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 11, color: V.text3 }}>
        <div>Started: <span style={{ color: V.text }}>{new Date(fasting.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div>Elapsed: <span style={{ color: V.text, fontFamily: V.mono }}>{formatDuration(elapsed)}</span></div>
      </div>
    </Card>
  );
}
