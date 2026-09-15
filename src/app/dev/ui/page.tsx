"use client";

/**
 * Visual QA page for the Cookwise UI kit — not part of the product flow.
 * Renders every primitive with realistic sample content at phone width.
 */

import {
  ArrowRight,
  Bell,
  Camera,
  ChefHat,
  Clock,
  CookingPot,
  Dumbbell,
  EllipsisVertical,
  Flame,
  Leaf,
  Plus,
  Trash,
} from "lucide-react";
import { useState } from "react";
import { AppHeader, BottomNav, Page, StickyFooter } from "@/components/layout";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Dots,
  EmojiTile,
  EmptyState,
  IconButton,
  Input,
  ListRow,
  ProgressBar,
  SearchInput,
  SectionHeader,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  SkeletonRow,
  Slider,
  Spinner,
  StatPill,
  StatPillRow,
  Stepper,
  Textarea,
  ToastProvider,
  Toggle,
  useToast,
} from "@/components/ui";

const FILTERS = ["All", "Vegetables", "Proteins", "Grains", "Dairy", "Spices"] as const;

const PANTRY = [
  { emoji: "🍅", name: "Tomato", qty: "500 g", expiry: "2 days", tone: "orange" as const },
  { emoji: "🧅", name: "Onion", qty: "1 kg", expiry: "5 days", tone: "green" as const },
  { emoji: "🥚", name: "Eggs", qty: "6 pcs", expiry: "7 days", tone: "green" as const },
  { emoji: "🍚", name: "Rice", qty: "1 kg", expiry: "> 30 days", tone: "neutral" as const },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-2 text-[11px] font-bold tracking-[0.12em] text-text-3 uppercase">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Showcase() {
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [mode, setMode] = useState("scan");
  const [servings, setServings] = useState(2);
  const [spice, setSpice] = useState(2);
  const [sync, setSync] = useState(true);
  const [query, setQuery] = useState("");

  return (
    <>
      <AppHeader
        large
        title="Santhosh ☀️"
        subtitle="Ready to cook something amazing?"
        right={
          <span className="relative inline-flex">
            <IconButton aria-label="Notifications" variant="plain">
              <Bell size={20} />
            </IconButton>
            <Badge dot label="You have expiring items" className="absolute top-1.5 right-1.5" />
          </span>
        }
      />

      <Page>
        <Section title="Buttons">
          <Button fullWidth size="lg" rightIcon={<ArrowRight size={18} />}>
            Start Cooking
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary">Grocery list</Button>
            <Button variant="soft" leftIcon={<Plus size={16} />}>
              Add to Pantry
            </Button>
            <Button variant="ghost" size="sm">
              Skip
            </Button>
            <Button variant="danger" size="sm" leftIcon={<Trash size={14} />}>
              Remove
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button loading>Generating…</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm" href="/dev/ui">
              Link button
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <IconButton aria-label="Back" variant="plain">
              <ChefHat size={20} />
            </IconButton>
            <IconButton aria-label="Favourite" variant="white">
              <Leaf size={20} />
            </IconButton>
            <IconButton aria-label="Open recipe" variant="primary">
              <ArrowRight size={20} />
            </IconButton>
            <IconButton aria-label="More" variant="soft" size={36}>
              <EllipsisVertical size={18} />
            </IconButton>
            <Spinner size={20} label="Loading" />
          </div>
        </Section>

        <Section title="Today's meal card">
          <Card href="/dev/ui">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-2">Today&apos;s Meal</p>
                <Chip tone="green" size="sm" className="mt-1">
                  High Protein
                </Chip>
                <h3 className="mt-1.5 truncate text-[22px] leading-tight font-bold text-text">
                  Egg Bhurji
                </h3>
              </div>
              <div className="relative shrink-0">
                <EmojiTile emoji="🍳" size={88} tone="orange" />
                <span className="absolute -right-2 -bottom-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-fg shadow-card">
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              </div>
            </div>
            <StatPillRow className="mt-3">
              <StatPill icon={<Clock size={14} />} value="20" unit="min" />
              <StatPill icon={<Flame size={14} />} value="320" unit="kcal" />
              <StatPill icon={<Dumbbell size={14} />} value="24g" unit="protein" />
            </StatPillRow>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card tone="green" padding="sm">
              <p className="text-[13px] font-semibold text-green-700">Tinted green</p>
              <p className="mt-0.5 text-xs text-text-2">Uses 2 expiring items</p>
            </Card>
            <Card tone="orange" padding="sm">
              <p className="text-[13px] font-semibold text-orange-600">Tinted orange</p>
              <p className="mt-0.5 text-xs text-text-2">3 items expiring soon</p>
            </Card>
          </div>
        </Section>

        <Section title="Chips">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {FILTERS.map((f) => (
              <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
                {f}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip tone="green">High Protein</Chip>
            <Chip tone="orange">2 days</Chip>
            <Chip tone="amber">3 days</Chip>
            <Chip tone="neutral">&gt; 30 days</Chip>
            <Chip tone="blue">Lunch</Chip>
            <Chip tone="red">Expired</Chip>
            <Chip tone="dark">Active</Chip>
            <Chip tone="green" size="sm" icon={<Leaf size={11} />}>
              Perfect amount!
            </Chip>
          </div>
        </Section>

        <Section title="Section header + rows">
          <Card padding="sm">
            <SectionHeader
              title="Pantry Alerts"
              caption="3 items expiring soon"
              captionTone="orange"
              actionLabel="See all"
              actionHref="/dev/ui"
            />
            {PANTRY.map((p, i) => (
              <ListRow
                key={p.name}
                href="/dev/ui"
                divider={i < PANTRY.length - 1}
                leading={<EmojiTile emoji={p.emoji} size={40} tone="neutral" />}
                title={p.name}
                subtitle={p.qty}
                trailing={
                  <Chip tone={p.tone} size="sm">
                    {p.expiry}
                  </Chip>
                }
              />
            ))}
          </Card>
        </Section>

        <Section title="Progress">
          <Card padding="sm" className="space-y-3">
            <ProgressBar value={45} tone="auto" label="Vitamin C" rightLabel="45%" />
            <ProgressBar value={80} tone="auto" label="Protein" rightLabel="80%" />
            <ProgressBar value={96} tone="auto" label="Iron" rightLabel="96%" />
            <ProgressBar value={74} height={6} tone="green" aria-label="Daily calories" />
            <Dots count={7} active={2} className="pt-1" />
          </Card>
        </Section>

        <Section title="Avatars & tiles">
          <div className="flex flex-wrap items-end gap-3">
            <Avatar name="Santhosh" size={32} />
            <Avatar name="Santhosh" size={40} />
            <Avatar name="Santhosh" size={64} />
            <EmojiTile emoji="🥗" size={40} />
            <EmojiTile emoji="🍛" size={56} tone="orange" />
            <EmojiTile emoji="🥘" size={64} tone="neutral" />
          </div>
        </Section>

        <Section title="Form controls">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search ingredients…"
          />
          <Input label="Your name" placeholder="Santhosh" hint="Shown on your profile" />
          <Input label="Age" defaultValue="twenty" error="Enter a number between 10 and 100" />
          <Select
            label="Storage"
            defaultValue="fridge"
            options={[
              { value: "fridge", label: "Fridge" },
              { value: "freezer", label: "Freezer" },
              { value: "pantry", label: "Pantry" },
            ]}
          />
          <Textarea label="Notes" placeholder="Anything we should remember?" rows={3} />
          <SegmentedControl
            label="Add method"
            value={mode}
            onChange={setMode}
            options={[
              { value: "scan", label: "Scan", icon: <Camera size={14} /> },
              { value: "dock", label: "Dock" },
              { value: "receipt", label: "Receipt" },
              { value: "manual", label: "Manual" },
            ]}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-text-2">Servings</span>
            <Stepper label="Servings" value={servings} onChange={setServings} min={1} max={12} />
          </div>
          <Slider
            label="Spice level"
            value={spice}
            onChange={setSpice}
            min={1}
            max={5}
            valueLabel={`Level ${spice}`}
            minLabel="Mild"
            maxLabel="Very hot"
          />
          <Toggle
            showLabel
            label="Sync with Supabase"
            description="Keeps your plan on every device"
            checked={sync}
            onChange={setSync}
          />
        </Section>

        <Section title="Overlays">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
            <Button
              variant="soft"
              onClick={() =>
                toast({
                  title: "Thanks! We'll adjust your future plans.",
                  description: "Feedback saved for Egg Bhurji",
                  tone: "success",
                })
              }
            >
              Show toast
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                toast({ title: "Tomato expires in 2 days", tone: "warning" })
              }
            >
              Warning toast
            </Button>
          </div>
        </Section>

        <Section title="Loading & empty">
          <Card padding="sm">
            <SkeletonRow />
            <SkeletonRow />
            <Skeleton className="mt-2 h-24 w-full rounded-2xl" />
          </Card>
          <Card padding="none">
            <EmptyState
              emoji="📅"
              title="No plan for this week yet"
              description="Generate a 7-day plan from your pantry, goals and budget."
              actionLabel="Generate my week"
              onAction={() => toast({ title: "Generating your week…" })}
            />
          </Card>
        </Section>

        <Section title="Sticky footer">
          <p className="text-xs text-text-2">
            The bar below is fixed above the bottom nav and reserves its own space.
          </p>
        </Section>

        <StickyFooter withNav>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1">
              Back
            </Button>
            <Button className="flex-[2]" rightIcon={<ArrowRight size={16} />}>
              Next
            </Button>
          </div>
        </StickyFooter>
      </Page>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add or swap a meal"
        description="Dinner · Wed 27 Aug"
        footer={
          <Button fullWidth size="lg" onClick={() => setSheetOpen(false)}>
            Swap meal
          </Button>
        }
      >
        <div className="space-y-1 pb-2">
          <SearchInput placeholder="Search recipes…" containerClassName="mb-2" />
          {[
            { emoji: "🍳", name: "Egg Bhurji", meta: "20 min • 320 kcal" },
            { emoji: "🍛", name: "Chicken Biryani", meta: "55 min • 640 kcal" },
            { emoji: "🥣", name: "Veg Upma", meta: "15 min • 290 kcal" },
            { emoji: "🥗", name: "Sprout Salad", meta: "10 min • 180 kcal" },
          ].map((r, i, arr) => (
            <ListRow
              key={r.name}
              onClick={() => setSheetOpen(false)}
              divider={i < arr.length - 1}
              leading={<EmojiTile emoji={r.emoji} size={40} />}
              title={r.name}
              subtitle={r.meta}
              trailing={<CookingPot size={18} className="text-text-3" aria-hidden="true" />}
            />
          ))}
        </div>
      </Sheet>

      <BottomNav />
    </>
  );
}

export default function DevUiPage() {
  return (
    <ToastProvider>
      <Showcase />
    </ToastProvider>
  );
}
