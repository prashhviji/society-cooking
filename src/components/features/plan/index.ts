/** Feature components for the Weekly Plan, Grocery and Adapt screens. */

export { AdaptChooser, ADAPT_CHOICES, type AdaptChooserProps } from "./AdaptChooser";
export { DayStrip, type DayStripProps } from "./DayStrip";
export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  GroceryGroup,
  categoryOf,
  groupByCategory,
  type GroceryGroupProps,
} from "./GroceryGroup";
export { MealActionsSheet, type MealActionsSheetProps } from "./MealActionsSheet";
export { MealCard, type MealCardProps } from "./MealCard";
export { PlanDiffList, type PlanDiffListProps } from "./PlanDiffList";
export { RecipePickerSheet, type RecipePickerSheetProps } from "./RecipePickerSheet";
export { WeekSummary, weekTotals, type WeekSummaryProps, type WeekTotals } from "./WeekSummary";
export { WeekSwitcher, weekRangeLabel, type WeekSwitcherProps } from "./WeekSwitcher";
