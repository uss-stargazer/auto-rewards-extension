import * as z from "zod";
import {
  createMessage,
  createTabMessage,
} from "../../modules/utils/safeMessages";

export class NotLoggedInError extends Error {
  name: string = "NotLoggedInError";
  loginUrl: string;

  constructor(message: string, loginUrl: string) {
    super(message);
    this.loginUrl = loginUrl;
  }
}

// Types and schemas -------------------

export interface AarpUser {
  username: string;
  fedId: string;
  accessToken: string;
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
  number,
  AarpActivity[]
>("getAarpActivites");

export const [earnActivityRewards, onEarnRewardsRequest] = createMessage<
  { activity: AarpActivity; openActivityUrl: boolean },
  AarpRewardsResponse | null
>("earnAarpActivityRewards");
