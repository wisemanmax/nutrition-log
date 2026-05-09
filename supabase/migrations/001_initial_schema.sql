-- NutritionLog — Initial Schema
-- All tables use RLS: every row is owned by auth.uid()

-- ── Extensions ─────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ──────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  first_name    text,
  last_name     text,
  email         text unique,
  height        numeric,           -- inches
  sex           text,              -- 'male' | 'female' | 'other'
  dob           date,
  activity_level text default 'moderate',
  dietary_modes  text[] default '{}',
  allergens      text[] default '{}',
  units          text default 'lbs', -- 'lbs' | 'kg'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table profiles enable row level security;
create policy "profiles: owner only"
  on profiles for all using (auth.uid() = id);

-- ── Goals ─────────────────────────────────────────────────────────────────────
create table if not exists goals (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  cal          integer not null default 2400,
  protein      numeric not null default 180,
  carbs        numeric not null default 250,
  fat          numeric not null default 70,
  fiber        numeric not null default 25,
  water        integer not null default 8,
  macro_cycle_strategy text,   -- 'none' | 'training_rest' | 'custom'
  effective_from date default current_date,
  created_at   timestamptz default now()
);
alter table goals enable row level security;
create policy "goals: owner only"
  on goals for all using (auth.uid() = user_id);

-- ── Foods ─────────────────────────────────────────────────────────────────────
create table if not exists foods (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references profiles(id) on delete cascade,   -- null = global food
  external_id  text,         -- usda-12345 | off-0012345
  source       text,         -- 'usda' | 'off' | 'manual' | 'recipe'
  name         text not null,
  brand        text,
  barcode      text,
  serving_g    numeric default 100,
  serving_unit text default 'g',
  -- Core macros
  kcal         numeric default 0,
  protein      numeric default 0,
  carbs        numeric default 0,
  fat          numeric default 0,
  fiber        numeric default 0,
  sodium       numeric default 0,
  sugar        numeric,
  sat_fat      numeric,
  cholesterol  numeric,
  -- Minerals
  calcium      numeric,
  iron         numeric,
  potassium    numeric,
  magnesium    numeric,
  zinc         numeric,
  phosphorus   numeric,
  selenium     numeric,
  -- Vitamins
  vitamin_a    numeric,
  vitamin_c    numeric,
  vitamin_d    numeric,
  vitamin_e    numeric,
  vitamin_k    numeric,
  vitamin_b12  numeric,
  vitamin_b6   numeric,
  thiamin      numeric,
  riboflavin   numeric,
  niacin       numeric,
  folate       numeric,
  choline      numeric,
  omega3       numeric,
  -- Meta
  allergens    text[] default '{}',
  dietary_modes text[] default '{}',
  image_url    text,
  created_at   timestamptz default now()
);
alter table foods enable row level security;
create policy "foods: global readable, owner writable"
  on foods for select using (user_id is null or auth.uid() = user_id);
create policy "foods: owner insert"
  on foods for insert with check (auth.uid() = user_id);
create policy "foods: owner update"
  on foods for update using (auth.uid() = user_id);
create policy "foods: owner delete"
  on foods for delete using (auth.uid() = user_id);

create index if not exists foods_name_idx   on foods using gin(to_tsvector('english', name));
create index if not exists foods_barcode_idx on foods(barcode) where barcode is not null;

-- ── Meals ─────────────────────────────────────────────────────────────────────
create table if not exists meals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  date          date not null,
  logged_at     timestamptz default now(),
  section       text not null check (section in ('Breakfast','Lunch','Dinner','Snacks')),
  food_id       uuid references foods(id),
  food_name     text not null,    -- denormalized for speed
  qty           numeric not null default 1,
  serving_g     numeric not null default 100,
  -- Computed / denormalized macros (scale applied at log time)
  kcal          numeric default 0,
  protein       numeric default 0,
  carbs         numeric default 0,
  fat           numeric default 0,
  fiber         numeric default 0,
  sodium        numeric default 0
);
alter table meals enable row level security;
create policy "meals: owner only"
  on meals for all using (auth.uid() = user_id);
create index if not exists meals_user_date_idx on meals(user_id, date desc);

-- ── Body logs ─────────────────────────────────────────────────────────────────
create table if not exists body_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  date          date not null,
  weight        numeric,
  body_fat      numeric,
  neck          numeric,
  waist         numeric,
  hip           numeric,
  notes         text,
  photo_url     text,
  measurements  jsonb,             -- extensible extra measurements
  created_at    timestamptz default now(),
  unique (user_id, date)
);
alter table body_logs enable row level security;
create policy "body_logs: owner only"
  on body_logs for all using (auth.uid() = user_id);

-- ── Recipes ───────────────────────────────────────────────────────────────────
create table if not exists recipes (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  description   text,
  servings      integer default 1,
  items         jsonb not null default '[]',   -- array of {food_id, qty, name, ...macros}
  computed_macros jsonb,                       -- {total: {...}, per_serving: {...}}
  source_url    text,
  image_url     text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table recipes enable row level security;
create policy "recipes: owner only"
  on recipes for all using (auth.uid() = owner_id);

-- ── Water logs ────────────────────────────────────────────────────────────────
create table if not exists water_logs (
  user_id  uuid not null references profiles(id) on delete cascade,
  date     date not null,
  glasses  integer not null default 0,
  primary key (user_id, date)
);
alter table water_logs enable row level security;
create policy "water_logs: owner only"
  on water_logs for all using (auth.uid() = user_id);

-- ── Mood logs ─────────────────────────────────────────────────────────────────
create table if not exists mood_logs (
  user_id    uuid not null references profiles(id) on delete cascade,
  date       date not null,
  mood       smallint check (mood between 1 and 5),
  energy     smallint check (energy between 1 and 5),
  digestion  smallint check (digestion between 1 and 5),
  notes      text,
  primary key (user_id, date)
);
alter table mood_logs enable row level security;
create policy "mood_logs: owner only"
  on mood_logs for all using (auth.uid() = user_id);

-- ── Streaks ───────────────────────────────────────────────────────────────────
create table if not exists streaks (
  user_id          uuid primary key references profiles(id) on delete cascade,
  current_streak   integer default 0,
  longest_streak   integer default 0,
  last_logged_date date,
  updated_at       timestamptz default now()
);
alter table streaks enable row level security;
create policy "streaks: owner only"
  on streaks for all using (auth.uid() = user_id);
