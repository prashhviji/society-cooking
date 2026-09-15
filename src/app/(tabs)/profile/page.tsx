import type { Metadata } from "next";
import { ProfileScreen } from "@/components/features/profile/ProfileScreen";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your diet, goals, kitchen, budget and what Cookwise has learned.",
};

/** `/profile` — profile summary + settings sheet. */
export default function ProfilePage() {
  return <ProfileScreen />;
}
