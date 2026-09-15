import type { Metadata } from "next";
import { ExpiringScreen } from "@/components/features/expiring/ExpiringScreen";

export const metadata: Metadata = { title: "Use Expiring Items" };

export default function ExpiringPage() {
  return <ExpiringScreen />;
}
