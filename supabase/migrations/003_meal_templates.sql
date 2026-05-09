-- Meal templates table (Q2 quick-add system)

create table if not exists meal_templates (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  name       text not null,
  meals      jsonb not null default '[]',   -- [{name, items: [{...food_item}]}]
  created_at timestamptz default now()
);
alter table meal_templates enable row level security;
create policy "meal_templates: owner only"
  on meal_templates for all using (auth.uid() = owner_id);

-- Favorites (food item ids)
create table if not exists favorites (
  user_id  uuid not null references profiles(id) on delete cascade,
  food_id  text not null,   -- matches FoodItem.id from client
  added_at timestamptz default now(),
  primary key (user_id, food_id)
);
alter table favorites enable row level security;
create policy "favorites: owner only"
  on favorites for all using (auth.uid() = user_id);

-- Fasting sessions
create table if not exists fasting_sessions (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references profiles(id) on delete cascade,
  started_at     timestamptz not null,
  ended_at       timestamptz,
  window_hours   smallint not null default 16,
  completed      boolean generated always as (ended_at is not null) stored
);
alter table fasting_sessions enable row level security;
create policy "fasting_sessions: owner only"
  on fasting_sessions for all using (auth.uid() = user_id);
