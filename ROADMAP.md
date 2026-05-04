# Nutrition-Log: 12-Month Enterprise-Grade Roadmap

## Context

`nutrition-log` (deployed at https://nutrition.ironlog.space) is a client-side React 18 + Vite PWA with encrypted localStorage and an external sync backend at `api.ironlog.space`. The **Home**, **Settings**, and **Onboarding** tabs are functional, but **Log**, **Body**, and **Trends** are stubs. There are no tests, no TypeScript, and no real food database.

The goal is a 12-month roadmap to evolve this into a best-in-class consumer nutrition app — comparable to MyFitnessPal/Cronometer but with a smarter intelligence layer and offline-first reliability.

- **Audience**: Consumers (everyday users)
- **Tech foundation**: Full modernization (TypeScript, Supabase, native mobile, comprehensive testing)
- **Timeline**: 12 months (focused, 4 quarters)

---

## Foundational Principles

1. **Offline-first stays sacred.** Every feature must work without network. Sync = eventual consistency, not a hard dependency.
2. **Privacy by default.** Encrypted-at-rest, user-owned data, exportable, deletable. No third-party tracking SDKs in client.
3. **Ship to existing users without breakage.** Live data migration must be reversible until the cutover is verified.
4. **Measurable impact.** Every feature ships with an analytics event and a hypothesis. PostHog from Q1 onward.
5. **One codebase.** PWA → Capacitor wrap to iOS/Android. No native rewrite.

---

## Q1 (Months 1–3): Foundation + Core MVP

**Theme**: Make the app actually usable for daily logging, on a foundation that can scale.

### 1.1 TypeScript migration (Week 1, parallel)
- Add `tsconfig.json` with `allowJs: true`, `strict: false` initially
- Rename `.jsx` → `.tsx` incrementally; type the `state/reducer.js` action union first (highest leverage)
- Critical files: `src/state/reducer.js`, `src/utils/storage.js`, `src/utils/sync.js`, `src/utils/auth.js`, `src/components/ui.jsx`
- Don't block features on strict mode purity — graduate strictness file-by-file

### 1.2 Build the missing tabs against current localStorage shape (Weeks 1–6)
- **Log tab**: meal entry with sections (Breakfast/Lunch/Dinner/Snacks), per-item macro display, edit/delete, copy from yesterday
- **Body tab**: weight, body-fat %, neck/waist/hip measurements, photo capture (stored locally as base64 for now), trend sparklines
- **Trends tab**: 7d/30d/90d/1y views using Recharts — calories, macros, weight, adherence rate, streak history
- Reuse: `src/components/ui.jsx` (Btn, Card, Field, Sheet, Progress), `theme.js` (V tokens)
- Reuse: state pattern in `src/state/reducer.js` — add `ADD_MEAL`, `EDIT_MEAL`, `DELETE_MEAL`, `LOG_BODY`, `ADD_PHOTO` actions
- **Critical**: Lock data shapes only after using them in real UI. Don't migrate to Postgres yet.

### 1.3 Food database integration (Weeks 4–8)
- **Primary**: USDA FoodData Central API (free, ~1.4M items)
- **Fallback/UPC**: Open Food Facts (free, community-maintained, includes barcodes)
- Cache hits in IndexedDB (use `idb` package) — fast offline lookup of recently-viewed foods
- Search UI: debounced typeahead with macro preview, serving size selector
- New file: `src/utils/foodDb.ts` — unified search/cache layer

### 1.4 Supabase backend (Weeks 7–11)
- Schema (lock AFTER tabs ship in 1.2 with proven shapes):
  - `profiles` (1:1 with auth.users) — height, sex, dob, activity_level, dietary_modes (array)
  - `goals` — calories, protein, carbs, fat, fiber, water; macro_cycle_strategy, period
  - `foods` — id, name, brand, barcode, serving_g, kcal, protein, carbs, fat, fiber, sodium, sugar, **plus 20+ micronutrient cols** (locked in here cheaply)
  - `meals` — date, time, section, food_id, qty, computed_macros (denormalized for speed)
  - `body_logs` — date, weight, bodyfat, measurements (jsonb), photo_url
  - `recipes` — owner_id, name, items (jsonb), servings, computed_macros
  - `streaks`, `water_logs`, `mood_logs`
- **RLS**: every table policied to `auth.uid()` only. Private by default.
- **Migration path**: dual-write for 4 weeks (localStorage + Supabase), then read-from-Supabase, then decommission `api.ironlog.space` sync endpoints.
- Reuse: existing PIN/email auth model maps to Supabase magic-link + custom claim for legacy PIN if user has one.

### 1.5 Testing infrastructure (Week 2 onward, continuous)
- **Vitest**: unit tests for `reducer.ts`, `storage.ts` (encrypt/decrypt round-trip), `foodDb.ts`, sync conflict resolution
- **Playwright**: E2E with `context.setOffline(true)` to verify writes queue and replay
- **MSW**: mock Supabase + USDA + Open Food Facts — never hit real APIs in CI
- **Migration test suite**: load known v1 localStorage blobs, assert post-migration shape — runs on every PR
- GitHub Actions: lint + typecheck + unit + Playwright on every PR; deploy preview to Vercel/Pages

### 1.6 Platform infra (Week 3, parallel)
- **Feature flags**: `src/utils/flags.ts` — simple JSON config + remote override via Supabase row
- **Analytics**: PostHog (self-hostable, EU region) — wraps Sentry-style API; events in `src/utils/analytics.ts`
- **Capacitor spike**: stand up `ios/` and `android/` shells now so App Store pipeline + TestFlight are learned before Q3 health features need them. No public release yet.

**Q1 exit criteria**: Daily-active user can log every meal of the day in <30s, see weekly trends, weigh in, and survive going offline for a flight.

---

## Q2 (Months 4–6): Smart Logging + Schema Maturity

**Theme**: Reduce logging friction to near-zero. Lock the schema with everything users will eventually want.

### 2.1 Barcode scanning (Weeks 12–14)
- `@zxing/browser` for PWA, native barcode plugin for Capacitor
- Scan → Open Food Facts lookup → confirm portion → log in 1 tap
- Telemetry: scan success rate, time-to-log

### 2.2 Recipe builder + URL import (Weeks 13–16)
- Manual recipe builder (already covered by `recipes` table)
- URL import: Cheerio-style HTML parsing of Schema.org `Recipe` JSON-LD via Supabase Edge Function (CORS, server-side)
- AI-assisted ingredient parsing fallback (Claude Haiku) when JSON-LD is missing

### 2.3 Quick-add system (Weeks 14–17)
- Recents, favorites, frequents (computed nightly)
- Meal templates ("My usual breakfast")
- Copy-from-day picker
- Voice quick-log: Web Speech API → Claude Haiku for parse → preview → confirm. Defer if signal-to-effort low.

### 2.4 Allergen + dietary-mode filtering (Weeks 15–17)
- Cheap because schema was designed for it in Q1
- Dietary modes: vegetarian, vegan, keto, paleo, mediterranean, low-FODMAP, gluten-free, halal, kosher
- Allergen warnings: peanut, tree-nut, dairy, egg, soy, wheat, fish, shellfish, sesame
- Filter food search; flag offending foods inline
- Profile setting drives both

### 2.5 Micronutrient tracking (Weeks 16–18)
- Already in schema. Build the UI: vitamins (A, B-complex, C, D, E, K), minerals (Fe, Ca, Mg, Zn, K, Na, Se), fiber, sugar, sat fat, cholesterol
- Daily reference intake bars on Trends tab
- Weekly deficiency report card

### 2.6 Capacitor production release (Weeks 17–22)
- iOS App Store + Google Play submission
- Push notifications (meal-time reminders, streak protection nudges)
- Use existing PWA bundle as web view — no logic duplication
- App Store Connect setup, screenshots, ASO

### 2.7 Intermittent fasting timer (Week 19, small)
- Highly requested by users in this category. Tiny build: a timer with eating-window presets (16:8, 18:6, 20:4, OMAD)
- Integrates with notifications

**Q2 exit criteria**: User logs entire day via scan + favorites in <2 minutes. App is in App Store + Play Store. Schema is frozen — no more breaking changes for the year.

---

## Q3 (Months 7–9): Intelligence + Health Ecosystem + Premium

**Theme**: Make the app smart, connected to wearables, and monetizable.

### 3.1 AI nutrition coach (Weeks 24–28)
- Claude Sonnet 4.6 with prompt caching (system prompt + user history cached)
- RAG over user's last 90 days: meals, weights, goals, adherence
- Conversational chat surface in a new "Coach" tab
- Daily auto-generated insight on Home: "You've been low on protein 4 of last 7 days — try X"
- Proactive nudges: plateau detection, goal progress, micronutrient gaps
- All inferences run server-side (Supabase Edge Function) so the API key never ships to client

### 3.2 AI photo meal recognition (Weeks 26–30)
- **Now grounded** by Q2's food DB: vision model → candidate matches → user confirms
- Claude Vision → returns best-effort items with portions
- UI shows match confidence; user always confirms before logging
- Important: never silently log AI guesses — trust is fragile

### 3.3 Apple Health + Google Fit sync (Weeks 28–32)
- Capacitor HealthKit plugin (iOS), HealthConnect plugin (Android)
- Two-way: write meals/water/weight, read steps/active-energy/heart-rate
- Adjust calorie targets dynamically based on activity (opt-in)

### 3.4 Wearables — Oura first (Weeks 30–33)
- Oura is highest-signal for nutrition correlation (sleep + readiness + HRV)
- OAuth via Supabase Edge Function
- Show sleep quality alongside diet adherence on Trends — surface correlations
- Defer Garmin / Fitbit / Whoop to post-launch unless one becomes a clear ask

### 3.5 Predictive analytics (Weeks 31–34)
- Weight projection: 90-day forecast based on current intake/output trend
- Plateau detection: alert at 2+ weeks of weight stall with diagnostic
- Goal-revision suggestions: "Your maintenance is closer to 2,180 kcal based on 6 weeks of data"
- All client-side math (no AI cost), surfaced via the Coach

### 3.6 Premium tier launch (Weeks 32–36)
- **Free**: full logging, Trends, basic insights, food DB, barcode, dietary filters
- **Premium ($7.99/mo or $59/yr)**: AI coach, photo recognition, Apple Health/Oura sync, predictive analytics, recipe URL import, micronutrient deep-dives, unlimited progress photos
- Stripe via Supabase + RevenueCat for App Store / Play Store IAP
- 14-day free trial, no credit card required for first 7 days

**Q3 exit criteria**: 5%+ of MAU on premium. AI coach has measurable retention lift (≥10% D30). At least one wearable integration in production.

---

## Q4 (Months 10–12): Apple Watch + Polish + Differentiators

**Theme**: Become indispensable. Ship the features that make users tell their friends.

### 4.1 Apple Watch + Wear OS apps (Weeks 36–42)
- Glanceable: calories remaining, water tally, next meal nudge
- Quick-log water and favorite meals from the wrist
- Complications for at-a-glance progress
- Integrates with HealthKit data already syncing in Q3

### 4.2 Restaurant menu DB (Weeks 38–41)
- Nutritionix API (paid, ~1M restaurant items) or Spoonacular
- Search by restaurant chain → menu → nutrition
- Geofenced suggestion: "You're at Chipotle — log a meal?" (opt-in, on-device geofence)

### 4.3 Meal planning + AI grocery list (Weeks 40–44)
- 7-day meal plan generation (Claude Sonnet) honoring goals + dietary modes + allergens + budget
- Auto-generated grocery list, sorted by store section
- Optional: deep-link to Instacart/Amazon Fresh (no-code, just URL builders)

### 4.4 Progress photos timeline (Weeks 42–44)
- Side-by-side comparison view
- Auto-aligned (face/torso center) using a small on-device ML model (TensorFlow.js or MediaPipe)
- Privacy guarantee: photos never leave device unencrypted; opt-in cloud backup

### 4.5 Mood + symptom logging (Weeks 43–45)
- 1-tap mood (1–5), 1-tap energy, 1-tap digestion
- Surface correlations on Trends: "You report better energy on days you hit your fiber goal"
- Foundation for future symptom-triggered diet adjustments

### 4.6 Accessibility — WCAG 2.1 AA (Weeks 44–46)
- Full audit with axe-core in CI
- Keyboard nav for every flow, screen reader labels (`aria-*`), 4.5:1 contrast verified, focus rings
- Reduced-motion support
- Critical for App Store accessibility marketing + healthcare adjacency later

### 4.7 Internationalization (Weeks 45–48)
- Extract strings via `react-intl` or `lingui`
- Launch: English, Spanish, French
- USDA-FDC has English-only food names — couple to a translation layer for top-1000 foods first
- Cultural food databases as a fast-follow (e.g., MEXFOODS for Latin American)

### 4.8 Reliability hardening (continuous, all of Q4)
- Sync conflict resolution: vector clocks per-row, last-write-wins on simple fields, merge for arrays (meals)
- IndexedDB cache eviction strategy (LRU, 50MB cap)
- Sentry alert tuning, Core Web Vitals budget enforced in CI
- Performance budget: <200ms for meal-add, <100ms for tab switch, <2s cold start

**Q4 exit criteria**: Watch app live, restaurant lookup converts >20% of users, App Store rating ≥4.6, churn <5%/mo.

---

## Critical Files to Modify

### Existing (to be evolved)
- `src/state/reducer.js` → `reducer.ts`: extend with meal/body/photo/water/recipe actions; type the action union
- `src/utils/storage.js` → `storage.ts`: add IndexedDB layer behind same API; keep encryption
- `src/utils/sync.js` → `sync.ts`: dual-write phase to Supabase, then cutover; keep wire format compatible
- `src/utils/auth.js` → `auth.ts`: bridge legacy PIN sessions to Supabase JWT during migration
- `src/components/ui.jsx` → `ui.tsx`: typed; extend with `Modal`, `Sheet`, `Toast`, `Search`, `BarcodeButton`
- `src/tabs/HomeTab.jsx`: add coach insight slot, water tile, fasting timer
- `src/tabs/Onboarding.jsx`: add dietary modes, allergens, activity level questions
- `src/tabs/SettingsTab.jsx`: add premium upgrade, wearables connect, language, accessibility settings
- `vite.config.js`: TS support, env var hygiene, PWA plugin upgrade
- `index.html`: drop Babel-standalone if any remnants, ensure manifest + meta tags current

### New
- `src/tabs/LogTab.tsx` — meal logging (Q1)
- `src/tabs/BodyTab.tsx` — measurements, photos (Q1)
- `src/tabs/TrendsTab.tsx` — Recharts dashboards (Q1)
- `src/tabs/CoachTab.tsx` — AI chat + insights (Q3)
- `src/utils/foodDb.ts` — USDA + OFF unified search (Q1)
- `src/utils/flags.ts` — feature flags (Q1)
- `src/utils/analytics.ts` — PostHog wrapper (Q1)
- `src/utils/healthkit.ts` — Apple Health bridge (Q3)
- `src/utils/predictions.ts` — projections, plateau detection (Q3)
- `supabase/migrations/*.sql` — schema versioned migrations
- `supabase/functions/*` — Edge Functions: AI coach, recipe-url-import, OAuth callbacks
- `e2e/*.spec.ts` — Playwright suites
- `src/test/*.test.ts` — Vitest unit suites
- `.github/workflows/ci.yml` — lint + typecheck + test + build matrix

---

## Reusable Patterns (don't reinvent)

- **Encryption**: `src/utils/storage.js` AES-256-GCM + PBKDF2 — keep, extend to IndexedDB
- **Theme tokens**: `src/utils/theme.js` `V` object — extend, don't replace
- **UI primitives**: `src/components/ui.jsx` `Btn`, `Card`, `Field`, `Sheet`, `Progress`, `GlobalConfirm`, `SuccessToast` — backbone of new tabs
- **Reducer pattern**: extend `src/state/reducer.js` action types — don't introduce Redux/Zustand
- **PWA shell**: `public/manifest.json`, `sw.js` — extend with new caches, keep offline-first
- **Sentry hook**: `src/utils/sentry.js` — wrap PostHog through the same init pattern

---

## Verification Strategy

### Per-feature
- **Unit**: every utility (foodDb, predictions, sync, storage) has Vitest tests with ≥80% line coverage
- **Component**: tab-level tests via Vitest + React Testing Library for state transitions
- **E2E**: Playwright covers golden paths: signup → log meal → view trends → go offline → log → reconnect → sync; barcode scan; AI photo recognition (mocked); premium purchase (test mode)
- **Migration**: snapshot tests of v1 localStorage → v2 Supabase row shapes

### Per-quarter gates
- **Q1**: 100 internal beta users daily-logging for 2 weeks; <1% sync errors; offline → online round-trip works
- **Q2**: TestFlight + Play Internal Testing with 500 users; barcode success rate >85%; allergen filter unit-tested against poisoned datasets
- **Q3**: AI coach evaluated against 50 hand-graded test conversations (helpfulness, factual accuracy, refusal of medical advice); HealthKit round-trip verified on physical iPhone
- **Q4**: Watch app passes Apple's HIG review; axe-core 0 violations on every tab; i18n translations reviewed by native speakers

### Production observability
- PostHog funnels for: signup → onboarding complete → first meal logged → 7-day retention → 30-day retention
- Sentry release-tagged so regressions are bisectable
- Core Web Vitals dashboard; weekly review
- Supabase row-count + RLS-violation alerts (Slack)

### Manual QA before each release
- Run through onboarding on a fresh device (iOS, Android, desktop PWA)
- Log a full day on the slowest target device (older iPhone SE)
- Verify offline → online sync in airplane mode
- Confirm premium upgrade + downgrade paths

---

## What's Explicitly Deferred (post-12-month)

- Coach/dietitian dashboards (B2B2C) — only if consumer base reaches 100k MAU
- Healthcare/HIPAA tier — separate compliance project
- Continuous Glucose Monitor (CGM) integration — needs FDA-aware framing
- Garmin / Fitbit / Whoop wearable integrations — Oura proves the pattern first
- Multi-language food databases beyond top-1000 translation
- Web-based recipe community / social features
- Genetic / blood-panel personalization

These belong in a Year 2 roadmap once the core product proves retention.
