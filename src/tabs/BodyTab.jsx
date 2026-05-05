import React, { useState, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { V, Haptic } from '../utils/theme';
import { Card, Btn, Field, Sheet, Progress } from '../components/ui';
import { Icons } from '../components/Icons';
import { today, ago, fmtShort, fmtDate, toKg, toLbs } from '../utils/helpers';
import { ConfirmCtrl, SuccessToastCtrl } from '../components/ui';
import { Analytics } from '../utils/analytics';

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color, height = 50 }) {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Log Body Sheet ───────────────────────────────────────────────────────────

function LogBodySheet({ existing, units, onSave, onClose }) {
  const [weight, setWeight] = useState(String(existing?.weight || ''));
  const [bodyFat, setBodyFat] = useState(String(existing?.bodyFat || ''));
  const [neck, setNeck] = useState(String(existing?.neck || ''));
  const [waist, setWaist] = useState(String(existing?.waist || ''));
  const [hip, setHip] = useState(String(existing?.hip || ''));
  const [notes, setNotes] = useState(existing?.notes || '');

  const wU = units === 'kg' ? 'kg' : 'lbs';
  const dU = units === 'kg' ? 'cm' : 'in';

  const save = () => {
    if (!weight && !bodyFat && !neck && !waist && !hip) return;
    onSave({
      weight: parseFloat(weight) || null,
      bodyFat: parseFloat(bodyFat) || null,
      neck: parseFloat(neck) || null,
      waist: parseFloat(waist) || null,
      hip: parseFloat(hip) || null,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Sheet title={existing ? 'Edit Entry' : 'Log Body'} onClose={onClose}
      footer={<div style={{ padding: 16 }}><Btn full onClick={save}>Save Entry</Btn></div>}>
      <Field label={`Weight (${wU})`} type="number" value={weight} onChange={setWeight} inputMode="decimal" unit={wU} autoFocus />
      <Field label="Body Fat %" type="number" value={bodyFat} onChange={setBodyFat} inputMode="decimal" unit="%" />
      <div style={{ fontSize: 11, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, marginTop: 4 }}>
        Measurements ({dU})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <Field label="Neck" type="number" value={neck} onChange={setNeck} inputMode="decimal" />
        <Field label="Waist" type="number" value={waist} onChange={setWaist} inputMode="decimal" />
        <Field label="Hip" type="number" value={hip} onChange={setHip} inputMode="decimal" />
      </div>
      <Field label="Notes" value={notes} onChange={setNotes} placeholder="Optional notes…" />
    </Sheet>
  );
}

// ─── Photo capture ─────────────────────────────────────────────────────────────

function PhotoSection({ date, photoUrl, onPhotoSaved }) {
  const fileRef = useRef(null);

  const capturePhoto = () => fileRef.current?.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onPhotoSaved(ev.target.result);
      SuccessToastCtrl.show('Photo saved');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div style={{ marginTop: 8 }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} aria-hidden="true" />
      {photoUrl ? (
        <div style={{ position: 'relative' }}>
          <img src={photoUrl} alt="Progress photo" style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 280 }} />
          <button onClick={capturePhoto} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
            Retake
          </button>
        </div>
      ) : (
        <button onClick={capturePhoto} aria-label="Add progress photo"
          style={{ width: '100%', minHeight: 120, border: `2px dashed ${V.cardBorder}`, borderRadius: 12, background: 'transparent', color: V.text3, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ fontSize: 28 }} aria-hidden="true">📷</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Add Progress Photo</span>
          <span style={{ fontSize: 10 }}>Stored locally on device</span>
        </button>
      )}
    </div>
  );
}

// ─── Photo Timeline Comparison ────────────────────────────────────────────────

function PhotoTimeline({ body }) {
  const photos = useMemo(() =>
    body.filter(b => b.photoUrl).slice(0, 20),
    [body]
  );
  const [leftIdx, setLeftIdx] = useState(0);
  const [rightIdx, setRightIdx] = useState(Math.max(0, photos.length - 1));

  if (photos.length < 2) {
    return (
      <Card style={{ padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 6 }}>Progress Photos</div>
        <div style={{ textAlign: 'center', padding: '20px 0', color: V.text3, fontSize: 12 }}>
          Log photos on at least 2 different days to compare progress
        </div>
      </Card>
    );
  }

  const left = photos[leftIdx];
  const right = photos[rightIdx];

  return (
    <Card style={{ padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>Progress Comparison</div>

      {/* Side-by-side photos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <img src={left.photoUrl} alt={`Progress photo from ${fmtDate(left.date)}`}
            style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '3/4' }} />
          <div style={{ textAlign: 'center', fontSize: 10, color: V.text3, marginTop: 4 }}>{fmtDate(left.date)}</div>
          {left.weight && <div style={{ textAlign: 'center', fontSize: 10, color: V.accent }}>{left.weight} {left.units || 'lbs'}</div>}
        </div>
        <div>
          <img src={right.photoUrl} alt={`Progress photo from ${fmtDate(right.date)}`}
            style={{ width: '100%', borderRadius: 8, objectFit: 'cover', aspectRatio: '3/4' }} />
          <div style={{ textAlign: 'center', fontSize: 10, color: V.text3, marginTop: 4 }}>{fmtDate(right.date)}</div>
          {right.weight && <div style={{ textAlign: 'center', fontSize: 10, color: V.accent }}>{right.weight} {right.units || 'lbs'}</div>}
        </div>
      </div>

      {/* Date selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Before', idx: leftIdx, setIdx: setLeftIdx },
          { label: 'After', idx: rightIdx, setIdx: setRightIdx },
        ].map(({ label, idx, setIdx }) => (
          <div key={label}>
            <div style={{ fontSize: 9, color: V.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>{label}</div>
            <select value={idx} onChange={e => setIdx(Number(e.target.value))} aria-label={`${label} photo date`}
              style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${V.cardBorder}`, borderRadius: 8, color: V.text, fontSize: 11 }}>
              {photos.map((p, i) => (
                <option key={i} value={i}>{fmtDate(p.date)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Weight change between selected */}
      {left.weight && right.weight && (() => {
        const change = right.weight - left.weight;
        const color = change < 0 ? V.accent : change === 0 ? V.text2 : V.danger;
        return (
          <div style={{ textAlign: 'center', marginTop: 10, padding: '8px 12px', background: `${color}08`, borderRadius: 8, border: `1px solid ${color}20` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)} lbs
            </span>
            <span style={{ fontSize: 10, color: V.text3, marginLeft: 6 }}>weight change</span>
          </div>
        );
      })()}
    </Card>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, unit, prev, color, sparkData }) {
  const change = prev != null && value != null ? (value - prev) : null;
  const changeStr = change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}` : null;

  return (
    <Card style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 9, color: V.text3, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: color || V.text, fontFamily: V.mono }}>
            {value != null ? value : '—'}
            {value != null && <span style={{ fontSize: 12, fontWeight: 600, color: V.text3, marginLeft: 3 }}>{unit}</span>}
          </div>
          {changeStr && (
            <div style={{ fontSize: 10, color: change < 0 ? V.accent : V.danger, marginTop: 1 }}>
              {changeStr} {unit} vs prev
            </div>
          )}
        </div>
        {sparkData && sparkData.length >= 2 && (
          <div style={{ width: 80, height: 40 }} aria-hidden="true">
            <Sparkline data={sparkData} color={color || V.accent} height={40} />
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── BodyTab ──────────────────────────────────────────────────────────────────

export function BodyTab({ s, d }) {
  const [showLog, setShowLog] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [activeView, setActiveView] = useState('today'); // today | timeline | history
  const units = s.units || 'lbs';

  const body = s.body || [];
  const todayEntry = body.find(b => b.date === today());
  const recentEntries = body.slice(0, 30);

  const weightData = useMemo(() =>
    recentEntries.filter(b => b.weight != null).reverse().map(b => ({ date: b.date, val: b.weight })),
    [recentEntries]
  );

  const bfData = useMemo(() =>
    recentEntries.filter(b => b.bodyFat != null).reverse().map(b => ({ date: b.date, val: b.bodyFat })),
    [recentEntries]
  );

  const prevWeight = body.find(b => b.date !== today() && b.weight != null)?.weight;
  const prevBf = body.find(b => b.date !== today() && b.bodyFat != null)?.bodyFat;

  const saveEntry = (entry) => {
    d({ type: 'LOG_BODY', entry: { ...entry, date: today() } });
    Haptic.success();
    SuccessToastCtrl.show('Body stats saved');
    Analytics.track('body_logged', {});
  };

  const deleteEntry = (id) => {
    ConfirmCtrl.show('Delete Entry?', 'This will remove this body log entry.', () => {
      d({ type: 'DEL_B', id });
    });
  };

  const hasPhotos = body.some(b => b.photoUrl);

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: V.text }}>Body</div>
        <Btn onClick={() => setShowLog(true)} aria-label="Log today's body stats">{Icons.plus({ size: 14, color: '#060a0e' })} Log Today</Btn>
      </div>

      {/* View tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 6 }}>
        {[['today', 'Today'], ['timeline', '📸 Photos'], ['history', 'History']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={activeView === id} onClick={() => setActiveView(id)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: `1px solid ${activeView === id ? V.accent : V.cardBorder}`,
              background: activeView === id ? `${V.accent}12` : 'transparent', color: activeView === id ? V.accent : V.text3,
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: V.font,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Today view */}
      {activeView === 'today' && (
        <>
          {todayEntry ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MetricCard label="Weight" value={todayEntry.weight} unit={units} prev={prevWeight}
                  color={V.accent} sparkData={weightData} />
                <MetricCard label="Body Fat" value={todayEntry.bodyFat} unit="%" prev={prevBf}
                  color={V.accent2} sparkData={bfData} />
              </div>

              {(todayEntry.neck || todayEntry.waist || todayEntry.hip) && (
                <Card style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Measurements</div>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {[
                      { label: 'Neck', val: todayEntry.neck },
                      { label: 'Waist', val: todayEntry.waist },
                      { label: 'Hip', val: todayEntry.hip },
                    ].map(m => (
                      <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: V.text, fontFamily: V.mono }}>{m.val ?? '—'}</div>
                        <div style={{ fontSize: 9, color: V.text3, textTransform: 'uppercase' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* BMI */}
              {todayEntry.weight && s.profile?.height && (() => {
                const heightIn = parseFloat(s.profile.height);
                if (!heightIn) return null;
                const weightLbs = units === 'kg' ? toLbs(todayEntry.weight) : todayEntry.weight;
                const bmi = (weightLbs * 703) / (heightIn * heightIn);
                const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
                const bmiColor = bmi < 18.5 ? V.accent2 : bmi < 25 ? V.accent : bmi < 30 ? V.warn : V.danger;
                return (
                  <Card style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: V.text3, fontWeight: 700, textTransform: 'uppercase' }}>BMI</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: bmiColor, fontFamily: V.mono }}>{bmi.toFixed(1)}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: bmiColor, padding: '4px 10px', background: `${bmiColor}15`, borderRadius: 8 }}>{cat}</div>
                  </Card>
                );
              })()}

              {/* Lean mass / body composition */}
              {todayEntry.weight && todayEntry.bodyFat && (() => {
                const bf = todayEntry.bodyFat / 100;
                const lean = todayEntry.weight * (1 - bf);
                const fat = todayEntry.weight * bf;
                return (
                  <Card style={{ padding: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Body Composition</div>
                    <div style={{ display: 'flex', gap: 0 }}>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: V.accent, fontFamily: V.mono }}>{lean.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: V.text3 }}>LEAN {units}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: V.warn, fontFamily: V.mono }}>{fat.toFixed(1)}</div>
                        <div style={{ fontSize: 9, color: V.text3 }}>FAT {units}</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: V.accent2, fontFamily: V.mono }}>{todayEntry.bodyFat}%</div>
                        <div style={{ fontSize: 9, color: V.text3 }}>BF%</div>
                      </div>
                    </div>
                  </Card>
                );
              })()}

              {/* Progress photo */}
              <Card style={{ padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: V.text3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Progress Photo</div>
                <PhotoSection
                  date={today()}
                  photoUrl={todayEntry.photoUrl}
                  onPhotoSaved={(photoUrl) => d({ type: 'ADD_PHOTO', date: today(), photoUrl })}
                />
              </Card>

              <Btn v="secondary" full onClick={() => setEditEntry(todayEntry)}>
                ✏️ Edit Today's Entry
              </Btn>
            </>
          ) : (
            <Card style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: V.text2, marginBottom: 6 }}>No entry for today</div>
              <div style={{ fontSize: 12, color: V.text3, marginBottom: 16 }}>Track your weight and measurements to see trends</div>
              <Btn onClick={() => setShowLog(true)}>{Icons.plus({ size: 14, color: '#060a0e' })} Log Body Stats</Btn>
            </Card>
          )}

          {/* Weight chart (30 days) */}
          {weightData.length >= 2 && (
            <Card style={{ padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 8 }}>Weight Trend (30d)</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weightData}>
                  <XAxis dataKey="date" tickFormatter={d => fmtShort(d)} tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: V.text3, fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: `1px solid ${V.cardBorder}`, borderRadius: 8, fontSize: 11, color: V.text }}
                    formatter={(v) => [`${v} ${units}`, 'Weight']}
                    labelFormatter={(l) => fmtShort(l)}
                  />
                  <Line type="monotone" dataKey="val" stroke={V.accent} strokeWidth={2} dot={{ fill: V.accent, r: 2 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* Photo timeline view */}
      {activeView === 'timeline' && (
        hasPhotos ? <PhotoTimeline body={body} /> : (
          <Card style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: V.text2, marginBottom: 6 }}>No photos yet</div>
            <div style={{ fontSize: 12, color: V.text3, marginBottom: 16 }}>Add progress photos when logging body stats</div>
            <Btn onClick={() => setShowLog(true)}>Log with Photo</Btn>
          </Card>
        )
      )}

      {/* History view */}
      {activeView === 'history' && (
        body.length > 0 ? (
          <Card style={{ padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: V.text, marginBottom: 10 }}>All Entries</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {body.map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  {entry.photoUrl && (
                    <img src={entry.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', marginRight: 10, flexShrink: 0 }} aria-hidden="true" />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>{fmtDate(entry.date)}</div>
                    <div style={{ fontSize: 10, color: V.text3, marginTop: 1 }}>
                      {entry.weight != null && `${entry.weight} ${units}`}
                      {entry.bodyFat != null && ` · ${entry.bodyFat}% BF`}
                      {entry.waist != null && ` · ${entry.waist}" waist`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditEntry(entry)} aria-label={`Edit entry from ${fmtDate(entry.date)}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.text3, padding: 4, fontSize: 13 }}>✏️</button>
                    <button onClick={() => deleteEntry(entry.id)} aria-label={`Delete entry from ${fmtDate(entry.date)}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: V.danger, padding: 4, fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: V.text3 }}>No body entries yet. Start logging to build your history.</div>
          </Card>
        )
      )}

      {/* Log sheet */}
      {showLog && (
        <LogBodySheet units={units} onSave={saveEntry} onClose={() => setShowLog(false)} />
      )}
      {editEntry && (
        <LogBodySheet existing={editEntry} units={units}
          onSave={(data) => { d({ type: 'LOG_BODY', entry: { ...data, date: editEntry.date } }); SuccessToastCtrl.show('Entry updated'); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}
