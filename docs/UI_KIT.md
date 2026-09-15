# Cookwise — UI Kit

Shared presentation primitives in `src/components/ui` and the navigation shell in
`src/components/layout`. Import from the barrels:

```tsx
import { Button, Card, Chip, StatPill, StatPillRow } from "@/components/ui";
import { AppHeader, Page, StickyFooter } from "@/components/layout";
```

Rules of the kit:

- **No business logic.** Components take data and callbacks; stores and engines stay in screens.
- **Tokens only.** Every colour comes from `globals.css` (`bg-surface`, `text-text-2`, `bg-green-100`, …). No raw hex.
- **Mobile first.** Everything works from 360 px to 430 px with no horizontal scroll; touch targets ≥ 44 px.
- **Server-safe by default.** Only components that need hooks are `"use client"`
  (`Input`, `Textarea`, `Select`, `Stepper`, `SegmentedControl`, `Slider`, `Toggle`, `Sheet`,
  `Toast`, `AppHeader`, `BottomNav`). The rest render in server components.
- Live showcase of everything below: **`/dev/ui`**.

A standard screen looks like this:

```tsx
<AppHeader back title="My Pantry" right={<IconButton aria-label="Settings"><Settings size={20} /></IconButton>} />
<Page>
  <SectionHeader title="Expiring soon" caption="3 items" captionTone="orange" actionLabel="See all" actionHref="/expiring" />
  {/* … */}
</Page>
```

---

## `src/components/ui`

### `Button`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "soft" \| "ghost" \| "danger"` | `"primary"` | `soft` = `bg-green-100 text-green-700` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | 36 / 44 / 52 px tall |
| `fullWidth` | `boolean` | – | Bottom CTAs |
| `loading` | `boolean` | – | Swaps `leftIcon` for a spinner, disables the button |
| `leftIcon` / `rightIcon` | `ReactNode` | – | Rendered `aria-hidden` |
| `href` | `string` | – | Renders a `next/link` anchor instead of `<button>` |
| `prefetch` | `boolean` | – | Forwarded to `next/link` |

Pill shaped in every variant, `active:scale-[0.98]`, focus-visible ring. All other
`<button>` props pass through.

```tsx
<Button fullWidth size="lg" rightIcon={<ArrowRight size={18} />}>Start Cooking</Button>
```

### `IconButton`

`variant`: `"plain" | "white" | "primary" | "soft"` · `size`: `32 | 36 | 40 | 44` (default 40) ·
`href` / `prefetch` · **`aria-label` is required**. Children are rendered `aria-hidden`.

```tsx
<IconButton aria-label="Go back" variant="white" onClick={() => router.back()}>
  <ChevronLeft size={22} />
</IconButton>
```

### `Card`

`tone`: `"default" | "green" | "orange"` (tinted = `bg-green-50` / `bg-orange-50` with matching
border) · `padding`: `"none" | "sm" | "md"` (default `md`) · `href` / `prefetch` / `onClick`
(renders a link or button so the whole card is one target).

```tsx
<Card href={`/recipes/${recipe.id}`}>…</Card>
<Card tone="orange" padding="sm">3 items expiring soon</Card>
```

### `Chip`

`tone`: `"green" | "orange" | "amber" | "neutral" | "blue" | "red" | "dark"` ·
`size`: `"sm" | "md"` · `icon` · `selected` + `onClick` for filter rows
(`selected` overrides the tone: `true` → dark pill, `false` → outlined).

```tsx
<Chip tone="green" size="sm">High Protein</Chip>
<Chip selected={filter === "All"} onClick={() => setFilter("All")}>All</Chip>
```

### `StatPill` / `StatPillRow`

`icon`, `value`, `unit`, `caption`. `StatPillRow` lays children out with `gap-2`, equal widths.

```tsx
<StatPillRow>
  <StatPill icon={<Clock size={14} />} value="20" unit="min" />
  <StatPill icon={<Flame size={14} />} value="320" unit="kcal" />
  <StatPill icon={<Dumbbell size={14} />} value="24g" unit="protein" />
</StatPillRow>
```

### `ProgressBar`

`value` 0–100 (clamped) · `height`: `6 | 8` · `tone`: `"green" | "orange" | "amber" | "auto"`
(auto: `< 40` orange, `< 60` amber, else green) · `label` (left caption) · `rightLabel` ·
`aria-label`. The helper `progressTone(value)` is exported for matching text colours.

```tsx
<ProgressBar value={45} tone="auto" label="Vitamin C" rightLabel="45%" />
```

### `Avatar`

`name` (initial + alt text) · `src` (local path) · `size`: `32 | 40 | 64 | 88`.
Falls back to a `bg-primary-soft` initial tile.

### `EmojiTile`

`emoji` · `imageUrl` (local only — renders `<img className="object-cover">`) · `alt` ·
`size`: `40 | 56 | 64 | 88 | "full"` · `tone`: `"green" | "orange" | "neutral"` ·
`emojiClassName`. `rounded-xl` gradient tile.

```tsx
<EmojiTile emoji={recipe.emoji} imageUrl={recipe.imageUrl} size={88} tone="orange" />
```

### `ListRow`

`leading`, `title`, `subtitle`, `trailing`, `href` / `onClick`, `divider`, `aria-label`.
60 px min height; renders a link/button when navigable.

```tsx
<ListRow
  href={`/pantry/${item.id}`}
  divider
  leading={<EmojiTile emoji="🍅" size={40} tone="neutral" />}
  title="Tomato"
  subtitle="500 g"
  trailing={<Chip tone="orange" size="sm">2 days</Chip>}
/>
```

### `SectionHeader`

`title` · `caption` + `captionTone` (`"muted" | "orange" | "green" | "amber"`) ·
`actionLabel` + `actionHref` **or** `onAction` · `right` (extra node).

```tsx
<SectionHeader title="Pantry Alerts" caption="3 items expiring soon" captionTone="orange"
  actionLabel="See all" actionHref="/expiring" />
```

### `Input`, `SearchInput`, `Textarea`, `Select`, `Field`

All share the 48 px `rounded-xl bg-surface border-border` chrome with a
`focus:ring-2 focus:ring-primary/30` ring and accept `label`, `hint`, `error`
(`error` wins over `hint` and reddens the border), plus `containerClassName`.

- `Input` — also `leftIcon`, `rightSlot`. Forwards a ref to the `<input>`.
- `SearchInput` — `Input` with the `Search` icon and a clear (×) button; extra `onClear`.
  Works controlled (`value` + `onChange` + `onClear`) or uncontrolled.
- `Textarea` — `rows` (default 4), resizes vertically.
- `Select` — native select; pass `options: {value,label,disabled?}[]` and/or `<option>` children,
  plus `placeholder`.
- `Field` — the bare label/hint/error wrapper, plus `controlClasses` and `controlErrorClasses`
  for building one-off controls that must match.

```tsx
<Input label="Your name" placeholder="Santhosh" hint="Shown on your profile" />
<SearchInput value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} />
```

### `Stepper`

`value`, `onChange`, `min`, `max`, `step`, `unit`, `label` (**required**, used as the group's
accessible name), `showLabel`, `disabled`.

```tsx
<Stepper label="Servings" value={servings} onChange={setServings} min={1} max={12} />
```

### `SegmentedControl`

Generic over the value type. `options: { value, label, icon?, disabled? }[]`, `value`,
`onChange`, `label` (group name), `size`: `"sm" | "md"`. `bg-surface-2` track, white selected pill,
`role="radiogroup"`.

```tsx
<SegmentedControl label="Spice" value={spice} onChange={setSpice}
  options={[{ value: "too_mild", label: "Too mild" }, { value: "just_right", label: "Just right" }, { value: "too_hot", label: "Too hot" }]} />
```

### `Slider`

`value`, `onChange`, `min` (1), `max` (5), `step`, `label`, `valueLabel`, `minLabel`, `maxLabel`,
`disabled`. Native range input with `accent-primary`.

### `Toggle`

`checked`, `onChange`, `label` (**required** accessible name), `showLabel`, `description`,
`disabled`. `role="switch"`.

### `Sheet`

Bottom-sheet modal portalled to `document.body`.

| Prop | Type | Notes |
|---|---|---|
| `open` | `boolean` | Controlled |
| `onClose` | `() => void` | Backdrop click, × and Escape |
| `title` / `description` | `ReactNode` | Heading block |
| `footer` | `ReactNode` | Pinned action area under the scroll body |
| `hideClose` | `boolean` | Hide the × button |

Drag handle bar, `max-h-[85dvh]` scrollable body, body scroll lock while open, constrained to
`--app-max-width` and centred. The panel stays mounted and animates with a transform +
visibility transition, so render expensive children conditionally if that matters.

```tsx
<Sheet open={open} onClose={() => setOpen(false)} title="Add or swap a meal"
  footer={<Button fullWidth size="lg">Swap meal</Button>}>
  …
</Sheet>
```

### `ToastProvider` / `useToast`

Wrap the screen (or the app) in `<ToastProvider>`, then:

```tsx
const { toast, dismiss } = useToast();
toast({ title: "Thanks! We'll adjust your future plans.", tone: "success" });
```

`toast({ title, description?, tone?, duration? })` → id. `tone`: `"default" | "success" |
"warning" | "error"`; auto-dismisses after 3 s (override with `duration`), tap to dismiss.
At most three stack at the top, inside the app shell width.

### `Skeleton` / `SkeletonRow`

`<Skeleton className="h-4 w-32" />` — pulsing `bg-surface-2` block.
`<SkeletonRow leading subtitle />` — matches a `ListRow`. Use while stores rehydrate.

### `EmptyState`

`emoji` (or an icon node), `title`, `description`, `actionLabel` + `actionHref` / `onAction`,
`children`.

```tsx
<EmptyState emoji="📅" title="No plan for this week yet"
  description="Generate a 7-day plan from your pantry, goals and budget."
  actionLabel="Generate my week" onAction={generate} />
```

### `Badge`

`count` (or `dot`), `max` (default 9 → `"9+"`), `tone`: `"red" | "primary" | "orange"`, `label`
(screen-reader text). Position it with `className`.

```tsx
<span className="relative inline-flex">
  <IconButton aria-label="Notifications"><Bell size={20} /></IconButton>
  <Badge dot label="You have expiring items" className="absolute top-1.5 right-1.5" />
</span>
```

### `Dots`

`count`, `active` (zero-based), `label`. Active dot is a short primary bar.

### `Spinner`

`size`: `14 | 16 | 20 | 24 | 32`, `label` (omit inside a button). Inherits `currentColor`.

### `useIsClient`

`useSyncExternalStore` helper returning `false` during SSR / hydration. Use it to guard
`createPortal` or any browser-only render.

---

## `src/components/layout`

### `AppHeader`

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | 17 px semibold, or 26 px bold with `large` |
| `subtitle` | `ReactNode` | Muted second line |
| `back` | `boolean \| string` | `true` → `router.back()`; a string → link to that href |
| `right` | `ReactNode` | Action slot (usually an `IconButton`) |
| `large` | `boolean` | 26 px left-aligned page title (Home, Profile) |
| `transparent` | `boolean` | No background/blur, absolutely positioned over a hero; the back button switches to the white circle variant |
| `align` | `"left" \| "center"` | Overrides the default (centred when `back` is set) |
| `children` | `ReactNode` | Extra sticky content under the title row (day strips, tab rows) |

Sticky with `bg-bg/90 backdrop-blur-md` plus safe-area top padding.

### `Page`

Wraps screen content in `.page` (16 px gutters + bottom-nav clearance) and `fade-up`.
`noNav` → `.page--no-nav`, `noAnimate` to skip the mount animation, `className` to extend.
Renders a `<main>`.

### `BottomNav`

No props (optional `className`). Five tabs — Home `/home`, Plan `/plan`, Cook `/cook`,
Pantry `/pantry`, Profile `/profile` — with lucide `Home, CalendarDays, ChefHat,
ShoppingBasket, User`. Active when `pathname === href || pathname.startsWith(href + "/")`:
`text-primary` icon + label with a dot above; inactive `text-text-3`. Fixed, `var(--nav-height)`
tall, white, top hairline, safe-area padding, constrained to `--app-max-width` and centred.
Rendered once by `src/app/(tabs)/layout.tsx` — screens do not include it.

Also exported: `NAV_TABS` (the tab list) and `isTabActive(pathname, href)`.

### `StickyFooter`

Bottom action bar. `withNav` raises it above the `BottomNav` (use inside `(tabs)`),
`noSpacer` drops the in-flow spacer it renders to keep content clear of the bar.

```tsx
<StickyFooter>
  <Button fullWidth size="lg" rightIcon={<ArrowRight size={18} />}>Start Cooking</Button>
</StickyFooter>
```
