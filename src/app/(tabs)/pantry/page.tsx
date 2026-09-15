import type { Metadata } from "next";
import { PantryScreen } from "@/components/features/pantry/PantryScreen";

export const metadata: Metadata = { title: "My Pantry" };

export default function PantryPage() {
  return <PantryScreen />;
}
