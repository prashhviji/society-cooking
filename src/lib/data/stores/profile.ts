"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ID, UserProfile } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { DEMO_USER_ID, createEmptyProfile } from "../seed/demoUser";
import { persistConfig, trackHydration } from "../storage";

/** Local-only user id used until a Supabase auth user signs in. */
export const demoUserId = DEMO_USER_ID;

export const PROFILE_STORE_KEY = "cookwise:profile";

export interface ProfileState {
  /** `null` until onboarding (or demo seeding) has run. */
  profile: UserProfile | null;
  /** Shallow-merge a patch; creates a blank profile when there is none yet. */
  setProfile(patch: Partial<UserProfile>): void;
  completeOnboarding(): void;
  reset(): void;
  /** `profile.id` or the demo id — every row's `userId`. */
  userId(): ID;
  /** Swap the local demo id for a Supabase auth user id (used by sync.ts). */
  setUserId(id: ID): void;
  /** Convenience for route guards. */
  isOnboarded(): boolean;
}

type ProfilePersisted = Pick<ProfileState, "profile">;

export const useProfileStore = create<ProfileState>()(
  persist<ProfileState, [], [], ProfilePersisted>(
    (set, get) => ({
      profile: null,

      setProfile(patch) {
        const current =
          get().profile ?? createEmptyProfile(patch.id ?? DEMO_USER_ID);
        set({ profile: { ...current, ...patch, updatedAt: nowIso() } });
      },

      completeOnboarding() {
        const current = get().profile ?? createEmptyProfile();
        set({
          profile: {
            ...current,
            onboardingComplete: true,
            updatedAt: nowIso(),
          },
        });
      },

      reset() {
        set({ profile: null });
      },

      userId() {
        return get().profile?.id ?? DEMO_USER_ID;
      },

      setUserId(id) {
        const p = get().profile;
        if (!p || p.id === id) return;
        set({ profile: { ...p, id, updatedAt: nowIso() } });
      },

      isOnboarded() {
        return get().profile?.onboardingComplete === true;
      },
    }),
    persistConfig<ProfileState, ProfilePersisted>(PROFILE_STORE_KEY, {
      partialize: (s) => ({ profile: s.profile }),
    }),
  ),
);

trackHydration(PROFILE_STORE_KEY, useProfileStore);
