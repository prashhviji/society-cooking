"use client";

import { useParams } from "next/navigation";
import { CookingScreen } from "@/components/features/cooking";

/** Cooking mode — SCREENS §9. Outside `(tabs)`, so there is no bottom nav. */
export default function CookingModePage() {
  const params = useParams<{ sessionId: string }>();
  return <CookingScreen sessionId={params?.sessionId ?? ""} />;
}
