-- ---------------------------------------------------------------------------
-- Cookwise — initial schema
--
-- Mirrors src/lib/types.ts. Column names are snake_case; nested arrays and
-- objects (recipe ingredients/steps, plan meals, grocery items, cook logs,
-- nutrition) are stored as jsonb using exactly the camelCase shapes from
-- types.ts so the client can round-trip them without a mapper.
--
-- The file is idempotent: it can be re-applied safely.
-- Apply with `supabase db push` or by pasting it into the SQL editor.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (UserProfile)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  age integer,
  city text,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm numeric,
  weight_kg numeric,
  avatar_url text,

  diet text not null default 'vegetarian'
    check (diet in ('vegetarian', 'non_vegetarian', 'vegan', 'eggetarian', 'pescatarian')),
  allergies text[] not null default '{}',
  restrictions text[] not null default '{}',

  goal text not null default 'balanced'
    check (goal in ('muscle_gain', 'weight_loss', 'maintenance', 'improve_energy', 'balanced')),
  daily_calorie_target integer not null default 2000,
  protein_target_g integer not null default 60,

  equipment text[] not null default '{}',

  favorite_foods text[] not null default '{}',
  disliked_ingredients text[] not null default '{}',
  cuisines text[] not null default '{}',
  spice_level smallint not null default 3 check (spice_level between 1 and 5),

  budget_monthly integer not null default 0,
  currency text not null default 'INR',

  skill text not null default 'beginner'
    check (skill in ('beginner', 'intermediate', 'advanced')),
  time_availability text not null default 'medium'
    check (time_availability in ('low', 'medium', 'high', 'varies')),
  priorities text[] not null default '{}',
  servings_default integer not null default 2,

  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ingredients  (Ingredient — shared catalog, slug ids)
-- ---------------------------------------------------------------------------

create table if not exists public.ingredients (
  id text primary key,
  name text not null,
  category text not null
    check (category in ('vegetables', 'fruits', 'proteins', 'grains', 'dairy',
                        'legumes', 'spices', 'oils', 'nuts', 'other')),
  emoji text not null default '🥣',
  image_url text,
  default_unit text not null default 'g' check (default_unit in ('g', 'ml', 'pcs')),
  grams_per_piece numeric,
  shelf_life_days integer not null default 7,
  storage text not null default 'pantry' check (storage in ('fridge', 'freezer', 'pantry')),
  cost_per_kg numeric not null default 0,
  nutrition jsonb not null default '{}'::jsonb,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recipes  (Recipe — public catalog + user/AI created)
-- ---------------------------------------------------------------------------

create table if not exists public.recipes (
  id text primary key,
  name text not null,
  description text not null default '',
  cuisine text not null default '',
  meal_types text[] not null default '{}',
  tags text[] not null default '{}',
  emoji text not null default '🍽️',
  image_url text,
  servings integer not null default 2,
  prep_time_min integer not null default 0,
  cook_time_min integer not null default 0,
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard')),
  spice_level smallint not null default 3 check (spice_level between 1 and 5),
  diets text[] not null default '{}',
  equipment text[] not null default '{}',
  primary_method text not null default 'saute',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  nutrition_per_serving jsonb not null default '{}'::jsonb,
  cost_per_serving numeric not null default 0,
  is_public boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pantry_items  (PantryItem)
-- ---------------------------------------------------------------------------

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id text not null,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'g' check (unit in ('g', 'ml', 'pcs')),
  added_at timestamptz not null default now(),
  expires_at date,
  source text not null default 'manual'
    check (source in ('manual', 'scan', 'sensor', 'receipt', 'grocery')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- meal_plans  (MealPlan; meals = PlannedMeal[])
-- ---------------------------------------------------------------------------

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  meals jsonb not null default '[]'::jsonb,
  generated_by text not null default 'heuristic' check (generated_by in ('heuristic', 'gemini')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_plans_user_week_unique unique (user_id, week_start)
);

-- ---------------------------------------------------------------------------
-- grocery_lists  (GroceryList; items = GroceryItem[])
-- ---------------------------------------------------------------------------

create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.meal_plans (id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- schedule_changes  (ScheduleChange)
-- ---------------------------------------------------------------------------

create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
    check (type in ('less_time', 'guests', 'eating_out', 'mood_change', 'skip_meal')),
  date date not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  available_minutes integer,
  guest_count integer,
  mood_tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- cook_sessions  (CookSession)
-- ---------------------------------------------------------------------------

create table if not exists public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  planned_meal_id uuid,
  servings integer not null default 2,
  status text not null default 'verifying'
    check (status in ('verifying', 'cooking', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  ingredient_logs jsonb not null default '[]'::jsonb,
  step_logs jsonb not null default '[]'::jsonb,
  temperature_history jsonb not null default '[]'::jsonb,
  retention jsonb,
  pantry_deducted boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- meal_feedback  (MealFeedback)
-- ---------------------------------------------------------------------------

create table if not exists public.meal_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.cook_sessions (id) on delete set null,
  recipe_id text not null,
  rating smallint not null check (rating between 1 and 5),
  taste smallint not null check (taste between 1 and 5),
  spice text not null check (spice in ('too_mild', 'just_right', 'too_hot')),
  texture text not null check (texture in ('too_soft', 'perfect', 'too_hard')),
  quantity text not null check (quantity in ('too_little', 'just_right', 'too_much')),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- preference_models  (PreferenceModel — one row per user)
-- ---------------------------------------------------------------------------

create table if not exists public.preference_models (
  user_id uuid primary key references auth.users (id) on delete cascade,
  recipe_scores jsonb not null default '{}'::jsonb,
  ingredient_affinity jsonb not null default '{}'::jsonb,
  cuisine_affinity jsonb not null default '{}'::jsonb,
  tag_affinity jsonb not null default '{}'::jsonb,
  spice_adjust numeric not null default 0,
  portion_adjust numeric not null default 1,
  feedback_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists ingredients_category_idx on public.ingredients (category);
create index if not exists recipes_public_idx on public.recipes (is_public);
create index if not exists recipes_created_by_idx on public.recipes (created_by);

create index if not exists pantry_items_user_idx on public.pantry_items (user_id);
create index if not exists pantry_items_user_expiry_idx on public.pantry_items (user_id, expires_at);
create index if not exists pantry_items_user_ingredient_idx on public.pantry_items (user_id, ingredient_id);

create index if not exists meal_plans_user_idx on public.meal_plans (user_id);
create index if not exists meal_plans_user_week_idx on public.meal_plans (user_id, week_start);

create index if not exists grocery_lists_user_idx on public.grocery_lists (user_id);
create index if not exists grocery_lists_plan_idx on public.grocery_lists (plan_id);

create index if not exists schedule_changes_user_idx on public.schedule_changes (user_id);
create index if not exists schedule_changes_user_date_idx on public.schedule_changes (user_id, date);

create index if not exists cook_sessions_user_idx on public.cook_sessions (user_id);
create index if not exists cook_sessions_user_status_idx on public.cook_sessions (user_id, status);

create index if not exists meal_feedback_user_idx on public.meal_feedback (user_id);
create index if not exists meal_feedback_user_recipe_idx on public.meal_feedback (user_id, recipe_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'ingredients', 'recipes', 'pantry_items', 'meal_plans',
    'grocery_lists', 'cook_sessions', 'preference_models'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- New user -> profile row
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, onboarding_complete)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Cook'
    ),
    false
  )
  on conflict (id) do nothing;

  insert into public.preference_models (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.ingredients       enable row level security;
alter table public.recipes           enable row level security;
alter table public.pantry_items      enable row level security;
alter table public.meal_plans        enable row level security;
alter table public.grocery_lists     enable row level security;
alter table public.schedule_changes  enable row level security;
alter table public.cook_sessions     enable row level security;
alter table public.meal_feedback     enable row level security;
alter table public.preference_models enable row level security;

-- profiles: owner only (id = auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- ingredients: readable by everyone, writable only by the service role
-- (the service role bypasses RLS, so no write policy is defined at all).
drop policy if exists "ingredients_read_all" on public.ingredients;
create policy "ingredients_read_all" on public.ingredients
  for select to anon, authenticated using (true);

-- recipes: public rows readable by everyone; private rows owner-only.
drop policy if exists "recipes_read_public" on public.recipes;
create policy "recipes_read_public" on public.recipes
  for select to anon, authenticated
  using (is_public or auth.uid() = created_by);

drop policy if exists "recipes_insert_own" on public.recipes;
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (auth.uid() = created_by and is_public = false);

drop policy if exists "recipes_update_own" on public.recipes;
create policy "recipes_update_own" on public.recipes
  for update to authenticated
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "recipes_delete_own" on public.recipes;
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (auth.uid() = created_by);

-- Owner-only policies for every user table (auth.uid() = user_id).
do $$
declare
  t text;
begin
  foreach t in array array[
    'pantry_items', 'meal_plans', 'grocery_lists', 'schedule_changes',
    'cook_sessions', 'meal_feedback', 'preference_models'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (auth.uid() = user_id)', t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (auth.uid() = user_id)', t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (RLS still applies on top of these).
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.ingredients, public.recipes to anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.pantry_items, public.meal_plans, public.grocery_lists,
  public.schedule_changes, public.cook_sessions, public.meal_feedback,
  public.preference_models
  to authenticated;
grant insert, update, delete on public.recipes to authenticated;
