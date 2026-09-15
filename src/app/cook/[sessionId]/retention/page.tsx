"use client";

import { useParams } from "next/navigation";
import { RetentionScreen } from "@/components/features/cooking";

/** Nutrient retention — SCREENS §10. */
export default function RetentionPage() {
  const params = useParams<{ sessionId: string }>();
  return <RetentionScreen sessionId={params?.sessionId ?? ""} />;
}
