-- RLS helper functions & updated_at triggers

-- Auto-update updated_at on any table that has it
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

create trigger update_recipes_updated_at
  before update on recipes
  for each row execute procedure update_updated_at_column();

-- Aggregate helper: total macros for a user on a given date
create or replace function daily_totals(p_user_id uuid, p_date date)
returns table (
  kcal    numeric,
  protein numeric,
  carbs   numeric,
  fat     numeric,
  fiber   numeric,
  sodium  numeric
)
language sql security definer as $$
  select
    coalesce(sum(m.kcal), 0)    as kcal,
    coalesce(sum(m.protein), 0) as protein,
    coalesce(sum(m.carbs), 0)   as carbs,
    coalesce(sum(m.fat), 0)     as fat,
    coalesce(sum(m.fiber), 0)   as fiber,
    coalesce(sum(m.sodium), 0)  as sodium
  from meals m
  where m.user_id = p_user_id
    and m.date = p_date;
$$;
