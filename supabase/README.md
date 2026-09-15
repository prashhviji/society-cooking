# Cookwise — Supabase

Supabase is **optional**. With `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
unset the app runs entirely from IndexedDB ("demo mode") and every file here can be ignored.

```
supabase/
  config.toml            minimal CLI config (ports, email OTP)
  migrations/
    0001_init.sql        full schema + RLS + triggers (idempotent)
```

---

## 1. Apply the migration

### Option A — Supabase CLI (recommended)

```bash
npm i -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

To run everything locally instead of against a hosted project:

```bash
supabase start             # Postgres + Auth + Studio + Inbucket via Docker
supabase db reset          # applies migrations/0001_init.sql from scratch
```

`supabase start` prints the local API URL and keys; paste them into `.env.local`.
Email OTP codes for local sign-in land in Inbucket at <http://localhost:54324>.

### Option B — SQL editor

1. Open your project → **SQL Editor** → **New query**.
2. Paste the entire contents of `migrations/0001_init.sql`.
3. Run it.

The script is idempotent (`create … if not exists`, `create or replace`,
`drop policy if exists` before each `create policy`), so re-running it is safe.

---

## 2. Auth settings

The app signs in with a **6-digit email OTP** (`signInWithOtp` → `verifyOtp`).
In the dashboard under **Authentication → Providers → Email**:

- Enable **Email**.
- Turn **Confirm email** off (or on — both work; the OTP is delivered either way).
- Add `http://localhost:3000/auth/callback` (and your production URL) to
  **URL Configuration → Redirect URLs** so the magic-link variant also works.

`0001_init.sql` installs an `on_auth_user_created` trigger that inserts a
`profiles` row (name from `raw_user_meta_data.name`/`full_name`, else the email
local part) and an empty `preference_models` row for every new user.

---

## 3. Seed the shared catalog

`ingredients` and `recipes` are public read-only catalogs; they are written with
the **service role key**, never from the browser. The app exposes a guarded route:

```bash
# .env.local must contain SUPABASE_SERVICE_ROLE_KEY and ADMIN_SEED_TOKEN
curl -X POST http://localhost:3000/api/admin/seed \
  -H "x-admin-token: $ADMIN_SEED_TOKEN"
```

Response:

```json
{ "ok": true, "ingredients": 42, "recipes": 24 }
```

It upserts `INGREDIENTS` and `RECIPES` from `src/lib/data/seed/*` in chunks of
100 (`onConflict: "id"`), so it is safe to re-run after the catalog changes.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Keep it server-side only; never
> prefix it with `NEXT_PUBLIC_`.

---

## 4. Schema overview

| Table | Key | Mirrors | Access |
|---|---|---|---|
| `profiles` | `id` = `auth.users.id` | `UserProfile` | owner only (`auth.uid() = id`) |
| `ingredients` | `id` text slug | `Ingredient` | public read, service-role write |
| `recipes` | `id` text slug | `Recipe` | read when `is_public` or owner; owner writes private rows |
| `pantry_items` | `id` uuid | `PantryItem` | owner only |
| `meal_plans` | `id` uuid, unique `(user_id, week_start)` | `MealPlan` (`meals` jsonb) | owner only |
| `grocery_lists` | `id` uuid | `GroceryList` (`items` jsonb) | owner only |
| `schedule_changes` | `id` uuid | `ScheduleChange` | owner only |
| `cook_sessions` | `id` uuid | `CookSession` (logs jsonb) | owner only |
| `meal_feedback` | `id` uuid | `MealFeedback` | owner only |
| `preference_models` | `user_id` PK | `PreferenceModel` | owner only |

Nested structures (`recipes.ingredients`, `recipes.steps`, `meal_plans.meals`,
`grocery_lists.items`, `cook_sessions.ingredient_logs` / `step_logs` /
`temperature_history` / `retention`, all `nutrition*`) are `jsonb` holding the
**camelCase** shapes straight from `src/lib/types.ts`, so no field mapping is
needed for them. Only top-level columns are snake_case.

RLS is enabled on every table. Indexes exist on `(user_id)`,
`(user_id, expires_at)`, `(user_id, week_start)`, `(user_id, ingredient_id)`,
`(user_id, status)` and `(user_id, recipe_id)`.

---

## 5. Regenerating types

`src/lib/supabase/types.ts` is hand-written to match this migration. If you
prefer generated types:

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

Keep the `Database` export name — the clients are typed with it.
