import { AarpActivity } from "./definitions";

export interface ActivitiesFilter {
  numberDisplayed: number;
  phrases?: string[];
  topics?: string[];
}

export function applyActivitiesFilter(
  activities: AarpActivity[],
  filter: ActivitiesFilter
): number[] {
  return Array.from({ length: filter.numberDisplayed }, (_, idx) => idx);
}
