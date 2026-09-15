import { BottomNav } from "@/components/layout";

/** Every route in this group renders above the persistent 5-tab bar. */
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
