"use client";

import { useParams } from "next/navigation";
import { FeedbackScreen } from "@/components/features/cooking";

/** Meal feedback — SCREENS §11. */
export default function FeedbackPage() {
  const params = useParams<{ sessionId: string }>();
  return <FeedbackScreen sessionId={params?.sessionId ?? ""} />;
}
