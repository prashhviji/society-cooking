import type { ComponentType } from "react";
import type { StepProps } from "./common";
import { StepAbout } from "./StepAbout";
import { StepBudget } from "./StepBudget";
import { StepDiet } from "./StepDiet";
import { StepGoals } from "./StepGoals";
import { StepKitchen } from "./StepKitchen";
import { StepPriorities } from "./StepPriorities";
import { StepTaste } from "./StepTaste";

export {
  ChipToggleGroup,
  OptionCard,
  RemovableChip,
  StepSection,
  numberOrUndefined,
  toggleValue,
  type StepProps,
} from "./common";
export { StepAbout } from "./StepAbout";
export { StepBudget } from "./StepBudget";
export { StepDiet } from "./StepDiet";
export { StepGoals } from "./StepGoals";
export { StepKitchen } from "./StepKitchen";
export { StepPriorities } from "./StepPriorities";
export { StepTaste } from "./StepTaste";

/** Step number (1-7) → the component that renders it. */
export const STEP_COMPONENTS: Record<number, ComponentType<StepProps>> = {
  1: StepAbout,
  2: StepDiet,
  3: StepGoals,
  4: StepKitchen,
  5: StepTaste,
  6: StepBudget,
  7: StepPriorities,
};
