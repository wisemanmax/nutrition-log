-- NutritionLog: Daily aggregate view + helper functions
-- These replace manual aggregation in the app; used by the AI coach edge function.

-- ─── Daily nutrition summary view ─────────────────────────────────────────────

create or replace view public.daily_nutrition as
select
  user_id,
  date,
  sum(cal)     as cal,
  sum(protein) as protein,
  sum(carbs)   as carbs,
  sum(fat)     as fat,
  sum(fiber)   as fiber,
  sum(sodium)  as sodium,
  count(*)     as item_count
from public.meals
group by user_id, date;

-- ─── Streak maintenance function ──────────────────────────────────────────────
-- Called via trigger or scheduled job whenever a meal is logged.

create or replace function public.update_streak(p_user_id uuid, p_date date)
returns void language plpgsql security definer as $$
declare
  v_last   date;
  v_curr   integer;
  v_long   integer;
begin
  select last_log_date, current, longest
    into v_last, v_curr, v_long
    from public.streaks
   where user_id = p_user_id;

  if not found then
    insert into public.streaks(user_id, current, longest, last_log_date)
    values (p_user_id, 1, 1, p_date);
    return;
  end if;

  -- Same day: no change
  if v_last = p_date then return; end if;

  -- Consecutive day: extend streak
  if v_last = p_date - 1 then
    v_curr := v_curr + 1;
  else
    -- Gap: reset
    v_curr := 1;
  end if;

  v_long := greatest(v_long, v_curr);

  update public.streaks
     set current = v_curr, longest = v_long, last_log_date = p_date, updated_at = now()
   where user_id = p_user_id;
end;
$$;

-- Trigger: update streak whenever a meal is inserted
create or replace function public.meal_streak_trigger()
returns trigger language plpgsql security definer as $$
begin
  perform public.update_streak(new.user_id, new.date);
  return new;
end;
$$;

drop trigger if exists meal_streak_update on public.meals;
create trigger meal_streak_update
  after insert on public.meals
  for each row execute function public.meal_streak_trigger();

-- ─── 7-day micronutrient summary ──────────────────────────────────────────────
-- Used by AI coach for weekly deficiency briefing.

create or replace function public.weekly_micro_avg(p_user_id uuid)
returns table (
  nutrient text,
  avg_val  numeric
) language sql stable security definer as $$
  select
    unnest(array['fiber','sodium','vitamin_c','vitamin_d','vitamin_b12','calcium','iron']) as nutrient,
    unnest(array[
      avg(m.fiber),
      avg(m.sodium),
      avg(m.vitamin_c),
      avg(m.vitamin_d),
      avg(m.vitamin_b12),
      avg(m.calcium::numeric),
      avg(m.iron)
    ]) as avg_val
  from public.meals m
  where m.user_id = p_user_id
    and m.date >= current_date - 7;
$$;
