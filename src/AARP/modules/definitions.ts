import * as z from "zod";
import {
  createMessage,
  createTabMessage,
} from "../../modules/utils/safeMessages";

export const SUPPORTED_ACTIVITY_TYPES = ["video"] as const;
export type SupportedActivityType = (typeof SUPPORTED_ACTIVITY_TYPES)[number];

// Types and schemas ------------------------------------------------------------------------------

export interface AarpUser {
  username: string;
  fedId: string;
  accessToken: string;
  rewardsBalance?: number;
  dailyPointsLeft?: number;
  mustConfirmPassword: boolean;
}

// TODO: look here for styling and cool options (like searching for topics, for example)
const ActivitySchema = z.object({
  identifier: z.uuid(),
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  activityType: z.object({
    identifier: z.string(),
    basePointValue: z.number(),
    name: z.string(),
    visibleOnSite: z.boolean(),
    active: z.nullable(z.boolean()),
  }),
  name: z.string(),
  category: z.string(),
  url: z.union([z.url(), z.string().length(0)]),
  imageUrl: z.union([z.url(), z.string().length(0), z.null()]),
  description: z.nullable(z.string()),
  primaryTopic: z.nullable(z.string()),
  active: z.boolean(),
  deleted: z.nullable(z.boolean()),
  membersOnly: z.boolean(),
});
export type AarpActivity = z.infer<typeof ActivitySchema>;
export type AarpActivityWithStatus = z.infer<typeof ActivitySchema> & {
  isCompleted: boolean;
};
export const ActivitiesListSchema = z.array(ActivitySchema);

export const ActivityStatusResponseSchema = z.object({});
export type AarpActivityStatusResponse = z.infer<
  typeof ActivityStatusResponseSchema
>;

export const RewardsResponseSchema = z.object({
  activityCompleted: z.uuid(),
  pointsEarned: z.number(),
  userDailyPointsLeft: z.number(),
  awarded: z.boolean(),
  success: z.boolean(),
});
export type AarpRewardsResponse = z.infer<typeof RewardsResponseSchema>;

// Content script message definitions -------------------------------------------------------------

export const [getTabLocalStorage, onTabLocalStorageRequest] = createTabMessage<
  string,
  string | null
>("getTabLocalStorage");

// Service worker message definitions -------------------------------------------------------------

export const [updateAarpTab, onUpdateAarpTabRequest] = createMessage<
  chrome.tabs.UpdateProperties,
  number
>("updateAarpTab");

export const [getUser, onGetUserRequest] = createMessage<void, AarpUser | null>(
  "getAarpUser"
);

export const [getActivities, onActivitiesRequest] = createMessage<
  { accessToken: string; maxNActivities: number },
  AarpActivity[]
>("getAarpActivites");

export const [getActivityStatus, onActivityStatusRequest] = createMessage<
  { activityId: string; accessToken: string },
  AarpActivityStatusResponse
>("getAarpActivityStatus");

export const [earnActivityRewards, onEarnRewardsRequest] = createMessage<
  {
    activity: { identifier: string; type: string; url: string };
    openActivityUrl: boolean;
    user: { fedId: string; accessToken: string };
  },
  AarpRewardsResponse | null
>("earnAarpActivityRewards");
