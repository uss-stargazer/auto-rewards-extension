import { updateTabAndWaitForLoad } from "../modules/utils";
import {
  ActivitiesListSchema,
  getTabLocalStorage,
  getUser,
  NotLoggedInError,
  onActivitiesRequest,
  onEarnRewardsRequest,
  onGetUserRequest,
  onUpdateAarpTabRequest,
  RewardsResponseSchema,
  updateAarpTab,
} from "./modules/definitions";
import {
  isAarpTab,
  LOGIN_URL,
  ORIGIN,
  queryAarpApi,
  REWARDS_URL,
} from "./modules/tools";

const ACTIVITY_LIST_API_URL =
  "https://services.share.aarp.org/applications/loyalty-catalog/activity/listV3";
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

onUpdateAarpTabRequest(async (sendResponse, update) => {
  const aarpTab = await updateTabAndWaitForLoad(
    (
      await getAarpTab()
    ).id!,
    update
  );
  if (!aarpTab) throw new Error("Error occurred updating AARP tab");
  return sendResponse(aarpTab.id!);
});

onGetUserRequest(async (sendResponse) => {
  const aarpTab = await getAarpTab();
  const cookies = await ["games", "fedid", "aarp_rewards_balance"].reduce<
    Promise<{
      [key: string]: string | null;
    }>
  >(async (cookiesObjPromise, cookieName) => {
    const cookiesObj = await cookiesObjPromise;
    const cookie = await chrome.cookies.get({ name: cookieName, url: ORIGIN });
    cookiesObj[cookieName] = cookie && cookie.value;
    return cookiesObj;
  }, Promise.resolve({}));
  const accessToken = await getTabLocalStorage("access_token", aarpTab.id!);
  const dailyPointsLeft = await getTabLocalStorage(
    "user_daily_points_left",
    aarpTab.id!
  );

  return sendResponse(
    (cookies["games"] &&
      cookies["fedid"] &&
      accessToken && {
        username: cookies["games"],
        fedId: cookies["fedid"],
        accessToken: accessToken,
        rewardsBalance:
          (cookies["aarp_rewards_balance"] &&
            Number(cookies["aarp_rewards_balance"])) ||
          undefined,
        dailyPointsLeft: dailyPointsLeft ? Number(dailyPointsLeft) : undefined,
      }) ||
      null
  );
});

onActivitiesRequest(async (sendResponse, maxNActivities) => {
  const user = await getUser();
  if (!user)
    throw new NotLoggedInError(
      "You must be logged into AARP to get activities",
      LOGIN_URL
    );

  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL, active: true })
  );

  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    user.accessToken,
    aarpTab.url!,
    ActivitiesListSchema
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

  return sendResponse(filteredActivitiesList.slice(0, maxNActivities));
});

/**
 * This is the main function for getting the activity rewards. Some AARP server somewhere
 * gives rewards to an account when a single POST request is sent to it with the proper
 * authentication, so we're just gonna send it so we don't have to do the activity.
 */
onEarnRewardsRequest(async (sendResponse, { activity, openActivityUrl }) => {
  const user = await getUser();
  if (!user)
    throw new NotLoggedInError(
      "You must be signed into AARP to earn video rewards",
      LOGIN_URL
    );

  if (!SUPPORTED_ACTIVITY_TYPES.includes(activity.activityType.identifier))
    return sendResponse(null);
  if (openActivityUrl) await updateAarpTab({ url: activity.url, active: true });

  return sendResponse(
    await queryAarpApi(
      ACTIVITY_REWARDS_API_URL(user.fedId, activity.identifier),
      {},
      user.accessToken,
      activity.url,
      RewardsResponseSchema
    )
  );
});
