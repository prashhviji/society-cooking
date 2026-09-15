import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader, Page } from "@/components/layout";
import { Skeleton } from "@/components/ui";
import { AddToPantryScreen } from "@/components/features/pantry/AddToPantryScreen";

export const metadata: Metadata = { title: "Add to Pantry" };

function Fallback() {
  return (
    <>
      <AppHeader back title="Add to Pantry" />
      <Page>
        <div className="space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="h-11 rounded-full" />
        </div>
      </Page>
    </>
  );
}

export default function AddToPantryPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <AddToPantryScreen />
    </Suspense>
  );
}
