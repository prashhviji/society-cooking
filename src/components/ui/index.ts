/**
 * Cookwise UI kit — shared, presentation-only primitives.
 * See `docs/UI_KIT.md` for props and examples.
 */

export { Avatar, type AvatarProps, type AvatarSize } from "./Avatar";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./Button";
export { Card, type CardPadding, type CardProps, type CardTone } from "./Card";
export { Chip, type ChipProps, type ChipSize, type ChipTone } from "./Chip";
export { Dots, type DotsProps } from "./Dots";
export { EmojiTile, type EmojiTileProps, type EmojiTileSize, type EmojiTileTone } from "./EmojiTile";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Field, controlClasses, controlErrorClasses, type FieldProps } from "./Field";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonSize,
  type IconButtonVariant,
} from "./IconButton";
export { Input, SearchInput, type InputProps, type SearchInputProps } from "./Input";
export { ListRow, type ListRowProps } from "./ListRow";
export {
  ProgressBar,
  progressTone,
  type ProgressBarProps,
  type ProgressTone,
} from "./ProgressBar";
export {
  SectionHeader,
  type SectionCaptionTone,
  type SectionHeaderProps,
} from "./SectionHeader";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { Sheet, type SheetProps } from "./Sheet";
export { Skeleton, SkeletonRow, type SkeletonProps, type SkeletonRowProps } from "./Skeleton";
export { Slider, type SliderProps } from "./Slider";
export { Spinner, type SpinnerProps, type SpinnerSize } from "./Spinner";
export { StatPill, StatPillRow, type StatPillProps, type StatPillRowProps } from "./StatPill";
export { Stepper, type StepperProps } from "./Stepper";
export { Textarea, type TextareaProps } from "./Textarea";
export {
  ToastProvider,
  useToast,
  type ToastOptions,
  type ToastTone,
} from "./Toast";
export { Toggle, type ToggleProps } from "./Toggle";
export { useIsClient } from "./useIsClient";
