import React, { useState } from 'react';
import { V, Haptic } from '../utils/theme';
import { Card, Btn } from './ui';
import { today } from '../utils/helpers';
import { SuccessToastCtrl } from './ui';
import { Analytics } from '../utils/analytics';

const MOOD_OPTIONS = [
  { val: 5, emoji: '😄', label: 'Great' },
  { val: 4, emoji: '🙂', label: 'Good' },
  { val: 3, emoji: '😐', label: 'Okay' },
  { val: 2, emoji: '😕', label: 'Low' },
  { val: 1, emoji: '😞', label: 'Bad' },
];

const ENERGY_OPTIONS = [
  { val: 5, emoji: '⚡', label: 'High' },
  { val: 4, emoji: '🔋', label: 'Good' },
  { val: 3, emoji: '😴', label: 'Okay' },
  { val: 2, emoji: '🪫', label: 'Low' },
  { val: 1, emoji: '💤', label: 'Drained' },
];

const DIGESTION_OPTIONS = [
  { val: 5, emoji: '✅', label: 'Perfect' },
  { val: 4, emoji: '👍', label: 'Good' },
  { val: 3, emoji: '😐', label: 'Okay' },
  { val: 2, emoji: '😬', label: 'Off' },
  { val: 1, emoji: '❌', label: 'Bad' },
];

function OptionRow({ label, options, selected, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: V.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => (
          <button key={opt.val} onClick={() => onChange(opt.val)}
            style={{ flex: 1, padding: '6px 4px', borderRadius: 10, border: `1px solid ${selected === opt.val ? V.accent : V.cardBorder}`,
              background: selected === opt.val ? `${V.accent}15` : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 20 }}>{opt.emoji}</span>
            <span style={{ fontSize: 9, color: selected === opt.val ? V.accent : V.text3, fontWeight: 600 }}>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MoodLogger({ todayMood, d }) {
  const [mood, setMood] = useState(todayMood?.mood || null);
  const [energy, setEnergy] = useState(todayMood?.energy || null);
  const [digestion, setDigestion] = useState(todayMood?.digestion || null);
  const [saved, setSaved] = useState(!!todayMood?.mood);

  const save = () => {
    if (!mood && !energy && !digestion) return;
    d({ type: 'LOG_MOOD', date: today(), entry: { mood, energy, digestion, savedAt: new Date().toISOString() } });
    Haptic.success();
    SuccessToastCtrl.show('Mood logged');
    setSaved(true);
    Analytics.track('mood_logged', { mood, energy, digestion });
  };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: V.text, marginBottom: 10 }}>How do you feel today?</div>
      <OptionRow label="Mood" options={MOOD_OPTIONS} selected={mood} onChange={m => { setMood(m); setSaved(false); }} />
      <OptionRow label="Energy" options={ENERGY_OPTIONS} selected={energy} onChange={m => { setEnergy(m); setSaved(false); }} />
      <OptionRow label="Digestion" options={DIGESTION_OPTIONS} selected={digestion} onChange={m => { setDigestion(m); setSaved(false); }} />
      {!saved && (mood || energy || digestion) && (
        <Btn full onClick={save} style={{ marginTop: 4 }}>Save Check-in</Btn>
      )}
      {saved && (
        <div style={{ textAlign: 'center', fontSize: 11, color: V.accent, marginTop: 4, fontWeight: 600 }}>✓ Logged for today</div>
      )}
    </Card>
  );
}
