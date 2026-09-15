import type { Metadata } from "next";
import { HomeScreen } from "@/components/features/home/HomeScreen";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <HomeScreen />;
}
