import React, { useReducer, useEffect, useRef } from 'react';
import { V } from './utils/theme';
import { LS } from './utils/storage';
import { CloudSync } from './utils/sync';
import { SessionManager } from './utils/auth';
import { SentryUtil } from './utils/sentry';
import { Analytics } from './utils/analytics';
import { today } from './utils/helpers';
import { reducer, init } from './state/reducer.ts';
import ErrorBoundary from './components/ErrorBoundary';
import { GlobalConfirm, SuccessToast } from './components/ui';
import { Onboarding } from './tabs/Onboarding';
import { HomeTab } from './tabs/HomeTab';
import { LogTab } from './tabs/LogTab';
import { BodyTab } from './tabs/BodyTab';
import { TrendsTab } from './tabs/TrendsTab';
import { CoachTab } from './tabs/CoachTab';
import { SettingsTab } from './tabs/SettingsTab';
import { PlanTab } from './tabs/PlanTab';

const PERSIST_KEYS = [
  { key: 'nl-nutrition', stateKey: 'nutrition' },
  { key: 'nl-body', stateKey: 'body' },
  { key: 'nl-goals', stateKey: 'goals' },
  { key: 'nl-units', stateKey: 'units' },
  { key: 'nl-profile', stateKey: 'profile' },
  { key: 'nl-water', stateKey: 'water' },
  { key: 'nl-mood', stateKey: 'mood' },
  { key: 'nl-recipes', stateKey: 'recipes' },
  { key: 'nl-favorites', stateKey: 'favorites' },
  { key: 'nl-recents', stateKey: 'recents' },
  { key: 'nl-templates', stateKey: 'templates' },
  { key: 'nl-fasting', stateKey: 'fasting' },
];

export default function App() {
  const [s, d] = useReducer(reducer, init);

  // --- Load persisted state ---
  useEffect(() => {
    const p = {};
    PERSIST_KEYS.forEach(({ key, stateKey }) => {
      const val = LS.get(key);
      if (val !== null) p[stateKey] = val;
    });
    p.onboarded = !!LS.get('nl-onboarded');
    d({ type: 'INIT', p });

    if (p.profile?.email) {
      SentryUtil.identify(p.profile.email, `${p.profile.firstName} ${p.profile.lastName}`);
      Analytics.identify(p.profile.email, { name: p.profile.firstName });
    }

    SessionManager.checkAdmin();
  }, []);

  // --- Persist state changes ---
  useEffect(() => {
    if (!s.loaded) return;
    PERSIST_KEYS.forEach(({ key, stateKey }) => {
      if (s[stateKey] !== undefined) LS.set(key, s[stateKey]);
    });
    if (s.onboarded) LS.set('nl-onboarded', true);

    if (s.onboarded && s.profile?.email) CloudSync.debouncedPush(s);
  }, [
    s.nutrition, s.body, s.goals, s.units, s.profile, s.onboarded,
    s.water, s.mood, s.recipes, s.favorites, s.recents, s.templates, s.fasting, s.loaded
  ]);

  // --- Sync on app open ---
  useEffect(() => {
    if (s.loaded && s.onboarded && s.profile?.email) CloudSync.push(s);
  }, [s.loaded, s.onboarded]);

  // --- Track tab views ---
  const prevTab = useRef(null);
  useEffect(() => {
    if (s.tab && s.tab !== prevTab.current) {
      Analytics.page(s.tab);
      prevTab.current = s.tab;
    }
  }, [s.tab]);

  // --- Loading ---
  if (!s.loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: V.bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${V.accent}20`, borderTopColor: V.accent, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
    </div>
  );

  // --- Onboarding ---
  if (!s.onboarded) return (
    <ErrorBoundary>
      <Onboarding d={d} />
      <GlobalConfirm />
      <SuccessToast />
    </ErrorBoundary>
  );

  // --- Main App ---
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'log', label: 'Log', icon: '🍳' },
    { id: 'plan', label: 'Plan', icon: '📅' },
    { id: 'trends', label: 'Trends', icon: '📈' },
    { id: 'settings', label: 'More', icon: '⚙️' },
  ];

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: V.bg }}>
        {/* Main content area */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          <div style={{ padding: '16px 16px 16px', maxWidth: 700, margin: '0 auto' }}>
            {s.tab === 'home' && <HomeTab s={s} d={d} />}
            {s.tab === 'log' && <LogTab s={s} d={d} />}
            {s.tab === 'body' && <BodyTab s={s} d={d} />}
            {s.tab === 'coach' && <CoachTab s={s} d={d} dispatch={d} />}
            {s.tab === 'plan' && <PlanTab s={s} d={d} />}
            {s.tab === 'trends' && <TrendsTab s={s} d={d} />}
            {s.tab === 'settings' && <SettingsTab s={s} d={d} />}
          </div>
        </div>

        {/* Bottom Nav */}
        <nav role="navigation" aria-label="Main navigation"
          style={{ display: 'flex', background: V.navBg, borderTop: `1px solid ${V.cardBorder}`,
            paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => d({ type: 'TAB', tab: t.id })}
              aria-label={t.label} aria-current={s.tab === t.id ? 'page' : undefined}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 4px',
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: V.font,
                color: s.tab === t.id ? V.accent : V.text3, WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 9, fontWeight: s.tab === t.id ? 700 : 500 }}>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
      <GlobalConfirm />
      <SuccessToast />
    </ErrorBoundary>
  );
}
