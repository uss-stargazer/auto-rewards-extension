import * as z from "zod";
import {
  createMessage,
  createTabMessage,
} from "../../modules/utils/safeMessages";

export const SUPPORTED_ACTIVITY_TYPES = ["video"] as const;
export type SupportedActivityType = (typeof SUPPORTED_ACTIVITY_TYPES)[number];

export const ACCESS_TOKEN_STORAGE_KEYS = ["access_token", "acctAccessToken"];
export const USER_STORAGE_KEYS = [
  ...ACCESS_TOKEN_STORAGE_KEYS,
  "user_daily_points_left",
];
export const USER_COOKIES = [
  "games",
  "fedid",
  "aarp_rewards_balance",
  "AARP_SSO_AUTH_EX", // For checking whether user is 'fully' signed in
  "AARP_SSO_AUTH2", // For checking whether user is 'fully' signed in
];

// Types and schemas ------------------------------------------------------------------------------

export interface AarpUser {
  username: string;
  fedId: string;
  accessToken: string;
  mustConfirmPassword: boolean;
}

export interface AarpBalance {
  rewardsBalance?: number;
  dailyPointsLeft?: number;
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
export const ActivitiesListSchema = z.array(ActivitySchema);

export const ActivityStatusResponseSchema = z.object({
  activityList: z.array(
    z.object({
      activityIdentifier: z.uuid(),
      limitHit: z.boolean(),
      Error: z.nullable(z.any()),
      Input: z.nullable(z.any()),
    })
  ),
  userDailyPointsLeft: z.number(),
  exceptionCount: z.number(),
  success: z.boolean(),
});
export type AarpActivityStatuses = {
  activityFinishedStatuses: (boolean | undefined)[]; // A undefined value usually signifies error
  userDailyPointsLeft: number | undefined;
};

export const RewardsResponseSchema = z.object({
  activityCompleted: z.uuid(),
  pointsEarned: z.number(),
  userDailyPointsLeft: z.number(),
  awarded: z.boolean(),
  success: z.boolean(),
});
export type AarpRewardsResponse = z.infer<typeof RewardsResponseSchema>;

// Content script message definitions -------------------------------------------------------------

export const [getTabLocalStorage, onTabLocalStorageGetRequest] =
  createTabMessage<string, string | null>("getTabLocalStorage");

export const [setTabLocalStorage, onTabLocalStorageSetRequest] =
  createTabMessage<{ key: string; value: string }, void>("setTabLocalStorage");

// Service worker message definitions -------------------------------------------------------------

export const [updateAarpTab, onUpdateAarpTabRequest] = createMessage<
  chrome.tabs.UpdateProperties,
  number
>("updateAarpTab");

export const [getUser, onGetUserRequest] = createMessage<
  void,
  { user: AarpUser | null; balance: AarpBalance }
>("getAarpUser");

export const [getActivities, onActivitiesRequest] = createMessage<
  { accessToken: string; maxNActivities: number },
  AarpActivity[]
>("getAarpActivites");

export const [getActivityStatuses, onActivityStatusesRequest] = createMessage<
  {
    activityIds: string[];
    userFedId: string;
    accessToken: string;
  },
  AarpActivityStatuses["activityFinishedStatuses"]
>("getAarpActivityStatuses");

export const [earnActivityRewards, onEarnRewardsRequest] = createMessage<
  {
    activity: { identifier: string; type: string; url: string };
    user: { fedId: string; accessToken: string };
  },
  AarpRewardsResponse | null
>("earnAarpActivityRewards");

// The following is still a service worker message but
// is more a background mechanism, not an AARP function

export const [alertPossibleUserChange, onPossibleUserChangeAlert] =
  createMessage<void, void>("possibleUserChangeAlert");
