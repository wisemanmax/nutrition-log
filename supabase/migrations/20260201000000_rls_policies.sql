-- NutritionLog: Row Level Security Policies
-- All tables are private by default: auth.uid() must match user_id.

-- ─── Enable RLS ───────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.goals          enable row level security;
alter table public.foods          enable row level security;
alter table public.meals          enable row level security;
alter table public.body_logs      enable row level security;
alter table public.recipes        enable row level security;
alter table public.water_logs     enable row level security;
alter table public.mood_logs      enable row level security;
alter table public.fasting_sessions enable row level security;
alter table public.streaks        enable row level security;
alter table public.meal_templates enable row level security;

-- ─── Profiles ─────────────────────────────────────────────────────────────────

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete using (auth.uid() = id);

-- ─── Goals ────────────────────────────────────────────────────────────────────

create policy "Users can manage own goals"
  on public.goals for all using (auth.uid() = user_id);

-- ─── Foods ────────────────────────────────────────────────────────────────────
-- Public foods (user_id = null) are readable by all authenticated users.
-- User-created foods are only accessible to their creator.

create policy "Public foods are readable by all"
  on public.foods for select using (user_id is null or auth.uid() = user_id);

create policy "Users can insert their own foods"
  on public.foods for insert with check (auth.uid() = user_id);

create policy "Users can update their own foods"
  on public.foods for update using (auth.uid() = user_id);

create policy "Users can delete their own foods"
  on public.foods for delete using (auth.uid() = user_id);

-- ─── Meals ────────────────────────────────────────────────────────────────────

create policy "Users can manage own meals"
  on public.meals for all using (auth.uid() = user_id);

-- ─── Body Logs ────────────────────────────────────────────────────────────────

create policy "Users can manage own body logs"
  on public.body_logs for all using (auth.uid() = user_id);

-- ─── Recipes ──────────────────────────────────────────────────────────────────

create policy "Users can manage own recipes"
  on public.recipes for all using (auth.uid() = user_id);

-- ─── Water Logs ───────────────────────────────────────────────────────────────

create policy "Users can manage own water logs"
  on public.water_logs for all using (auth.uid() = user_id);

-- ─── Mood Logs ────────────────────────────────────────────────────────────────

create policy "Users can manage own mood logs"
  on public.mood_logs for all using (auth.uid() = user_id);

-- ─── Fasting Sessions ─────────────────────────────────────────────────────────

create policy "Users can manage own fasting sessions"
  on public.fasting_sessions for all using (auth.uid() = user_id);

-- ─── Streaks ──────────────────────────────────────────────────────────────────

create policy "Users can manage own streaks"
  on public.streaks for all using (auth.uid() = user_id);

-- ─── Meal Templates ───────────────────────────────────────────────────────────

create policy "Users can manage own templates"
  on public.meal_templates for all using (auth.uid() = user_id);
