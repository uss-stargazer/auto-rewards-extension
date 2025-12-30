import { updateTabAndWaitForLoad } from "../modules/utils";
import {
  AarpActivity,
  AarpActivityStatusResponse,
  AarpRewardsResponse,
  AarpUser,
  ActivitiesListSchema,
  ActivityStatusResponseSchema,
  getTabLocalStorage,
  NotLoggedInError,
  onActivitiesRequest,
  onActivityStatusRequest,
  onEarnRewardsRequest,
  onGetUserRequest,
  onUpdateAarpTabRequest,
  RewardsResponseSchema,
} from "./modules/definitions";
import {
  isAarpTab,
  LOGIN_URL,
  ORIGIN,
  queryAarpApi,
  REWARDS_URL,
} from "./modules/tools";

console.log("hello from service worker");

const SUPPORTED_ACTIVITY_TYPES = ["video"];
const ACTIVITY_LIST_API_URL =
  "https://services.share.aarp.org/applications/loyalty-catalog/activity/listV3";
const ACTIVITY_REWARDS_API_URL = (
  userFedId: string,
  activityId: string
): string =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/${userFedId}/${activityId}`;

async function getAarpTab(): Promise<chrome.tabs.Tab> {
  console.log("getting aarp tab");
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("\tall current tabs:", tabs);
  const aarpTabs = tabs.filter((tab) => isAarpTab(tab.url));
  console.log("\tall current aarp tabs:", aarpTabs);
  if (aarpTabs.length > 0) return aarpTabs[0];
  console.log("\tcouldn't find active aarp tab so imma create a new one");
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
  console.log("updating aarp tab", update);
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
  console.log("getting user object");
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
  console.log("\tgot cookies:", cookies);

  const accessToken =
    (await getTabLocalStorage("access_token", aarpTab.id!)) ??
    (await getTabLocalStorage("acctAccessToken", aarpTab.id!));

  console.log("\tgot access token:", accessToken);

  const user =
    (cookies["fedid"] &&
      accessToken && {
        username: cookies["games"] ?? "unknown",
        fedId: cookies["fedid"],
        accessToken: accessToken,
        rewardsBalance:
          (cookies["aarp_rewards_balance"] &&
            Number(cookies["aarp_rewards_balance"])) ||
          undefined,
        userMustConfirmPassword:
          !cookies["AARP_SSO_AUTH_EX"] || !cookies["AARP_SSO_AUTH2"],
      }) ||
    null;

  console.log("\tgot user:", user);
  return user;
}

async function getActivities(maxNActivities: number): Promise<AarpActivity[]> {
  console.log("getting activities list");
  await getAarpTab();
  console.log("\tgot aarp tab");

  const user = await getUser();
  if (!user)
    throw new NotLoggedInError(
      "You must be logged into AARP to get activities",
      LOGIN_URL
    );
  console.log("\tgot user for activities request");

  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL, active: true })
  );
  console.log("\tgot aarp tab with rewards url:", REWARDS_URL);

  console.log("\tabout to query api for activity list");
  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    user.accessToken,
    aarpTab.url!,
    ActivitiesListSchema,
    "GET"
  );

  console.log("\traw activities list:", activitiesList);

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
  console.log("\tfiltered activities list:", filteredActivitiesList);

  return filteredActivitiesList.slice(0, maxNActivities);
}

async function getActivityStatus(
  activityId: string
): Promise<AarpActivityStatusResponse> {
  const user = await getUser();
  if (!user)
    throw new NotLoggedInError(
      "You must be logged into AARP to get activity statusi",
      LOGIN_URL
    );

  return await queryAarpApi(
    "___________________________________",
    undefined,
    user.accessToken,
    REWARDS_URL,
    ActivityStatusResponseSchema
  );
}

async function earnActivityRewards(
  activity: AarpActivity,
  openActivityUrl: boolean
): Promise<AarpRewardsResponse | null> {
  console.log("earn activity rewards for", activity.identifier);
  const user = await getUser();
  if (!user)
    throw new NotLoggedInError(
      "You must be signed into AARP to earn video rewards",
      LOGIN_URL
    );

  if (!SUPPORTED_ACTIVITY_TYPES.includes(activity.activityType.identifier))
    return null;
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

onActivitiesRequest(async (sendResponse, maxNActivities) =>
  sendResponse(await getActivities(maxNActivities))
);

onActivityStatusRequest(async (sendResponse, activityId) =>
  sendResponse(await getActivityStatus(activityId))
);

onEarnRewardsRequest(async (sendResponse, { activity, openActivityUrl }) =>
  sendResponse(await earnActivityRewards(activity, openActivityUrl))
);
