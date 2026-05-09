-- NutritionLog: Initial Schema
-- Q1.4 — Supabase Postgres schema
-- All tables are private by default; RLS enables per-user access.

-- ─── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fast trigram food search

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- 1:1 with auth.users. Created on first onboarding completion.

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text,
  last_name    text,
  height       numeric,          -- inches (or cm if units='kg')
  sex          text check (sex in ('male', 'female', 'other')),
  dob          date,
  activity_level text check (activity_level in ('sedentary','light','moderate','very','extra')) default 'moderate',
  dietary_modes  text[]  default '{}',
  allergens      text[]  default '{}',
  units          text    check (units in ('lbs','kg')) default 'lbs',
  timezone       text    default 'America/New_York',
  premium        boolean default false,
  premium_expires_at timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Goals ────────────────────────────────────────────────────────────────────

create table if not exists public.goals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  cal          integer not null default 2400,
  protein      integer not null default 180,
  carbs        integer not null default 250,
  fat          integer not null default 70,
  fiber        integer not null default 25,
  water        integer not null default 8,  -- glasses
  macro_cycle_strategy text default 'fixed', -- fixed | carb_cycle | refeed
  effective_from date not null default current_date,
  created_at   timestamptz default now()
);

create index if not exists goals_user_date_idx on public.goals(user_id, effective_from desc);

-- ─── Foods ────────────────────────────────────────────────────────────────────
-- Shared food database (user-contributed + USDA-cached entries).
-- Rows with user_id = null are public foods.

create table if not exists public.foods (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete set null,
  external_id  text unique,            -- e.g. 'usda-12345', 'off-737628929492'
  name         text not null,
  brand        text,
  barcode      text,
  source       text check (source in ('usda','off','manual','recipe')) default 'manual',
  serving_g    numeric not null default 100,
  serving_unit text    default 'g',
  -- Macros (per serving_g)
  cal          integer not null default 0,
  protein      numeric(6,2) not null default 0,
  carbs        numeric(6,2) not null default 0,
  fat          numeric(6,2) not null default 0,
  fiber        numeric(6,2) not null default 0,
  sodium       integer default 0,
  sugar        numeric(6,2),
  sat_fat      numeric(6,2),
  cholesterol  integer,
  -- Vitamins
  vitamin_a    numeric(8,2),
  vitamin_c    numeric(8,2),
  vitamin_d    numeric(8,2),
  vitamin_e    numeric(8,2),
  vitamin_k    numeric(8,2),
  vitamin_b12  numeric(8,4),
  vitamin_b6   numeric(8,2),
  thiamin      numeric(8,2),
  riboflavin   numeric(8,2),
  niacin       numeric(8,2),
  folate       numeric(8,2),
  -- Minerals
  calcium      integer,
  iron         numeric(8,3),
  magnesium    integer,
  zinc         numeric(8,2),
  potassium    integer,
  phosphorus   integer,
  selenium     numeric(8,2),
  -- Other
  omega3       numeric(8,2),
  choline      numeric(8,2),
  -- Meta
  allergens    text[] default '{}',
  dietary_modes text[] default '{}',
  image_url    text,
  cached_at    timestamptz default now(),
  created_at   timestamptz default now()
);

create index if not exists foods_external_id_idx  on public.foods(external_id);
create index if not exists foods_barcode_idx       on public.foods(barcode) where barcode is not null;
create index if not exists foods_name_trgm_idx     on public.foods using gin(name gin_trgm_ops);
create index if not exists foods_user_idx          on public.foods(user_id) where user_id is not null;

-- ─── Meals ────────────────────────────────────────────────────────────────────
-- One row per food item logged. Denormalized macros for fast aggregation.

create table if not exists public.meals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  section      text not null check (section in ('Breakfast','Lunch','Dinner','Snacks')),
  food_id      uuid references public.foods(id) on delete set null,
  food_name    text not null,           -- denormalized for resilience
  food_brand   text,
  qty          numeric not null default 100,  -- grams used
  unit         text default 'g',
  -- Denormalized macros at time of logging
  cal          integer not null default 0,
  protein      numeric(6,2) not null default 0,
  carbs        numeric(6,2) not null default 0,
  fat          numeric(6,2) not null default 0,
  fiber        numeric(6,2) not null default 0,
  sodium       integer default 0,
  -- Extended macros
  sugar        numeric(6,2),
  sat_fat      numeric(6,2),
  vitamin_c    numeric(8,2),
  vitamin_d    numeric(8,2),
  vitamin_b12  numeric(8,4),
  iron         numeric(8,3),
  calcium      integer,
  logged_at    timestamptz default now(),
  created_at   timestamptz default now()
);

create index if not exists meals_user_date_idx on public.meals(user_id, date desc);
create index if not exists meals_date_idx      on public.meals(date);

-- ─── Body Logs ────────────────────────────────────────────────────────────────

create table if not exists public.body_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null,
  weight       numeric,      -- lbs or kg depending on profile.units
  body_fat     numeric,      -- percentage
  measurements jsonb,        -- { neck, waist, hip, chest, thigh, arm, calf }
  notes        text,
  photo_url    text,         -- signed Supabase Storage URL (encrypted at rest)
  created_at   timestamptz default now(),
  unique(user_id, date)     -- one entry per day
);

create index if not exists body_logs_user_date_idx on public.body_logs(user_id, date desc);

-- ─── Recipes ──────────────────────────────────────────────────────────────────

create table if not exists public.recipes (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  servings     integer not null default 1,
  items        jsonb not null default '[]',   -- [{food_id, food_name, qty, unit, macros}]
  macros_total  jsonb,                         -- computed on save
  macros_per_serving jsonb,
  source_url   text,    -- Q2.2 recipe URL import
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists recipes_user_idx on public.recipes(user_id);

-- ─── Water Logs ───────────────────────────────────────────────────────────────

create table if not exists public.water_logs (
  user_id  uuid not null references auth.users(id) on delete cascade,
  date     date not null,
  glasses  integer not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

-- ─── Mood Logs ────────────────────────────────────────────────────────────────

create table if not exists public.mood_logs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  mood       smallint check (mood between 1 and 5),
  energy     smallint check (energy between 1 and 5),
  digestion  smallint check (digestion between 1 and 5),
  notes      text,
  updated_at timestamptz default now(),
  primary key (user_id, date)
);

-- ─── Fasting Sessions ─────────────────────────────────────────────────────────

create table if not exists public.fasting_sessions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  started_at   timestamptz not null,
  ended_at     timestamptz,
  window_hours integer not null default 16,
  created_at   timestamptz default now()
);

create index if not exists fasting_user_idx on public.fasting_sessions(user_id, started_at desc);

-- ─── Streaks ──────────────────────────────────────────────────────────────────

create table if not exists public.streaks (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  current      integer not null default 0,
  longest      integer not null default 0,
  last_log_date date,
  updated_at   timestamptz default now()
);

-- ─── Meal Templates ───────────────────────────────────────────────────────────

create table if not exists public.meal_templates (
  id        uuid primary key default uuid_generate_v4(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  meals     jsonb not null default '[]',  -- same shape as nutrition.meals
  created_at timestamptz default now()
);

create index if not exists templates_user_idx on public.meal_templates(user_id);

-- ─── Updated-at trigger (shared function) ─────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at     before update on public.profiles      for each row execute function public.set_updated_at();
create trigger goals_updated_at        before update on public.goals          for each row execute function public.set_updated_at();
create trigger recipes_updated_at      before update on public.recipes        for each row execute function public.set_updated_at();
create trigger water_updated_at        before update on public.water_logs     for each row execute function public.set_updated_at();
create trigger mood_updated_at         before update on public.mood_logs      for each row execute function public.set_updated_at();
