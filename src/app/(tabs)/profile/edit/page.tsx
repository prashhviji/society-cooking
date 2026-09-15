import type { Metadata } from "next";
import { ProfileEditForm } from "@/components/features/profile/ProfileEditForm";

export const metadata: Metadata = {
  title: "Edit Profile",
  description: "Update your diet, goals, kitchen, taste, budget and priorities.",
};

/** `/profile/edit` — the onboarding steps as a tabbed form. */
export default function ProfileEditPage() {
  return <ProfileEditForm />;
}
