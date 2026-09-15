"use client";

import { Bell } from "lucide-react";
import { useMemo } from "react";
import { AppHeader, Page } from "@/components/layout";
import { Badge, IconButton, Skeleton } from "@/components/ui";
import {
  dailyIntake,
  expiringSummary,
  goalLabel,
  nextMealToday,
  todaysMeals,
} from "@/lib/data/selectors";
import { useHydrated } from "@/lib/data/storage";
import {
  useCookStore,
  usePantryStore,
  usePlanStore,
  useProfileStore,
  useRecipeStore,
} from "@/lib/data/stores";
import { greeting, toISODate } from "@/lib/utils";
import { timeEmoji } from "./labels";
import { PantryAlertsCard } from "./PantryAlertsCard";
import { QuickActions } from "./QuickActions";
import { StayOnTrackCard } from "./StayOnTrackCard";
import { TodaysMealSection } from "./TodaysMeal";

/** Window used by the Home alerts and the bell badge. */
const EXPIRING_DAYS = 3;

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[188px] rounded-2xl" />
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[142px] rounded-2xl" />
      <Skeleton className="h-[136px] rounded-2xl" />
    </div>
  );
}

/**
 * Home (`/home`) — greeting, the next meal to cook, quick actions, pantry
 * alerts and today's calorie progress. SCREENS.md §3.
 */
export function HomeScreen() {
  const hydrated = useHydrated();
  const profile = useProfileStore((s) => s.profile);
  const pantry = usePantryStore((s) => s.items);
  const recipes = useRecipeStore((s) => s.recipes);
  const sessions = useCookStore((s) => s.sessions);
  const plan = usePlanStore((s) => s.currentPlan());

  const today = toISODate();
  const expiring = useMemo(
    () => expiringSummary(pantry, EXPIRING_DAYS),
    [pantry],
  );
  const meal = useMemo(() => nextMealToday(plan, today), [plan, today]);
  const hasMealsToday = useMemo(
    () => todaysMeals(plan, today).length > 0,
    [plan, today],
  );
  const recipe = useMemo(
    () => (meal ? recipes.find((r) => r.id === meal.recipeId) : undefined),
    [meal, recipes],
  );
  const intake = useMemo(
    () => dailyIntake(sessions, recipes, today),
    [sessions, recipes, today],
  );

  const name = profile?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <AppHeader
        large
        title={
          hydrated ? (
            <>
              <span className="block text-[13px] leading-tight font-semibold text-primary">
                {greeting()},
              </span>
              <span className="block truncate">
                {name} <span aria-hidden="true">{timeEmoji()}</span>
              </span>
            </>
          ) : (
            <span aria-hidden="true" className="block py-1">
              <span className="mb-1.5 block h-3 w-24 animate-pulse rounded-lg bg-surface-2" />
              <span className="block h-6 w-36 animate-pulse rounded-lg bg-surface-2" />
            </span>
          )
        }
        subtitle={hydrated ? "Ready to cook something amazing?" : undefined}
        right={
          <span className="relative inline-flex">
            <IconButton aria-label="Expiring items" href="/expiring">
              <Bell size={20} />
            </IconButton>
            {hydrated && expiring.count > 0 && (
              <Badge
                dot
                label={`${expiring.count} items expiring soon`}
                className="pointer-events-none absolute top-1.5 right-1.5"
              />
            )}
          </span>
        }
      />

      <Page>
        {!hydrated ? (
          <HomeSkeleton />
        ) : (
          <div className="space-y-5">
            <TodaysMealSection
              meal={meal}
              recipe={recipe}
              hasMealsToday={hasMealsToday}
            />
            <QuickActions />
            <PantryAlertsCard summary={expiring} />
            <StayOnTrackCard
              goal={goalLabel(profile)}
              intake={intake}
              profile={profile}
            />
          </div>
        )}
      </Page>
    </>
  );
}
