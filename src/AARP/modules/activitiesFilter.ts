import { AarpActivity } from "./definitions";

export interface ActivitiesFilter {
  phrases?: string[];
  topics?: string[];
}

export function applyActivitiesFilter(
  activities: AarpActivity[],
  filter: ActivitiesFilter
): number[] {
  return activities.map((_, idx) => idx);
}
