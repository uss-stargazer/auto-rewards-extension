import { updateTabAndWaitForLoad } from "../modules/utils";
import {
  AarpActivity,
  AarpActivityStatusResponse,
  AarpRewardsResponse,
  AarpUser,
  ActivitiesListSchema,
  ActivityStatusResponseSchema,
  getTabLocalStorage,
  onActivitiesRequest,
  onActivityStatusRequest,
  onEarnRewardsRequest,
  onGetUserRequest,
  onUpdateAarpTabRequest,
  RewardsResponseSchema,
} from "./modules/definitions";
import { isAarpTab, ORIGIN, queryAarpApi, REWARDS_URL } from "./modules/tools";

const ACTIVITY_LIST_API_URL =
  "https://services.share.aarp.org/applications/loyalty-catalog/activity/listV3";
const ACTIVITY_STATUS_API_URL = "[PLACEHOLDER]";
const ACTIVITY_REWARDS_API_URL = (
  userFedId: string,
  activityId: string
): string =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/${userFedId}/${activityId}`;

const SUPPORTED_ACTIVITY_TYPES = ["video"];

async function getAarpTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const aarpTabs = tabs.filter((tab) => isAarpTab(tab.url));
  if (aarpTabs.length > 0) return aarpTabs[0];
  return new Promise((resolve) => {
    chrome.tabs.create({ url: ORIGIN, active: true }, (newTab) => {
      const listener = (
        tabId: number,
        changeInfo: chrome.tabs.OnUpdatedInfo,
        tab: chrome.tabs.Tab
      ) => {
        if (tabId === newTab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(tab);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

async function updateAarpTab(
  update: chrome.tabs.UpdateProperties
): Promise<number> {
  const aarpTab = await updateTabAndWaitForLoad(
    (
      await getAarpTab()
    ).id!,
    update
  );
  if (!aarpTab) throw new Error("Error occurred updating AARP tab");
  return aarpTab.id!;
}

async function getUser(): Promise<AarpUser | null> {
  const aarpTab = await getAarpTab();
  const cookies = await [
    "games",
    "fedid",
    "aarp_rewards_balance",
    "AARP_SSO_AUTH_EX", // For checking whether user is 'fully' signed in
    "AARP_SSO_AUTH2", // For checking whether user is 'fully' signed in
  ].reduce<
    Promise<{
      [key: string]: string | null;
    }>
  >(async (cookiesObjPromise, cookieName) => {
    const cookiesObj = await cookiesObjPromise;
    const cookie = await chrome.cookies.get({ name: cookieName, url: ORIGIN });
    cookiesObj[cookieName] = cookie && cookie.value;
    return cookiesObj;
  }, Promise.resolve({}));

  const accessToken =
    (await getTabLocalStorage("access_token", aarpTab.id!)) ??
    (await getTabLocalStorage("acctAccessToken", aarpTab.id!));
  const dailyPointsLeft = await getTabLocalStorage(
    "user_daily_points_left",
    aarpTab.id!
  );

  const user: AarpUser | null =
    (cookies["fedid"] &&
      accessToken && {
        username: cookies["games"] ?? "unknown",
        fedId: cookies["fedid"],
        accessToken: accessToken,
        rewardsBalance:
          (cookies["aarp_rewards_balance"] &&
            Number(cookies["aarp_rewards_balance"])) ||
          undefined,
        dailyPointsLeft: dailyPointsLeft ? Number(dailyPointsLeft) : undefined,
        mustConfirmPassword:
          !cookies["AARP_SSO_AUTH_EX"] || !cookies["AARP_SSO_AUTH2"],
      }) ||
    null;

  return user;
}

async function getActivities(
  accessToken: string,
  maxNActivities: number
): Promise<AarpActivity[]> {
  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL, active: true })
  );

  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    accessToken,
    aarpTab.url!,
    ActivitiesListSchema,
    "GET"
  );

  // We need to filter out outdated/inactive activities as well as activites we can't automate
  const now = new Date();
  const filteredActivitiesList = activitiesList.filter((activity) => {
    if (
      activity.active &&
      (activity.deleted === null || !activity.deleted) &&
      SUPPORTED_ACTIVITY_TYPES.includes(activity.activityType.identifier)
    ) {
      const dateRange = [
        new Date(activity.startDate),
        new Date(activity.endDate),
      ];
      return dateRange[0] <= now && now <= dateRange[1];
    }
    return false;
  });

  return filteredActivitiesList.slice(0, maxNActivities);
}

async function getActivityStatus(
  activityId: string,
  accessToken: string
): Promise<AarpActivityStatusResponse> {
  return await queryAarpApi(
    ACTIVITY_STATUS_API_URL,
    undefined,
    accessToken,
    REWARDS_URL,
    ActivityStatusResponseSchema
  );
}

async function earnActivityRewards(
  activity: { identifier: string; type: string; url: string },
  openActivityUrl: boolean,
  user: { fedId: string; accessToken: string }
): Promise<AarpRewardsResponse | null> {
  if (!SUPPORTED_ACTIVITY_TYPES.includes(activity.type)) return null;
  if (openActivityUrl) await updateAarpTab({ url: activity.url, active: true });

  return await queryAarpApi(
    ACTIVITY_REWARDS_API_URL(user.fedId, activity.identifier),
    {},
    user.accessToken,
    activity.url,
    RewardsResponseSchema
  );
}

// Register message listeners -----------------------------------------------

onUpdateAarpTabRequest(async (sendResponse, update) =>
  sendResponse(await updateAarpTab(update))
);

onGetUserRequest(async (sendResponse) => sendResponse(await getUser()));

onActivitiesRequest(async (sendResponse, { accessToken, maxNActivities }) =>
  sendResponse(await getActivities(accessToken, maxNActivities))
);

onActivityStatusRequest(async (sendResponse, { activityId, accessToken }) =>
  sendResponse(await getActivityStatus(activityId, accessToken))
);

onEarnRewardsRequest(
  async (sendResponse, { activity, openActivityUrl, user }) =>
    sendResponse(await earnActivityRewards(activity, openActivityUrl, user))
);
