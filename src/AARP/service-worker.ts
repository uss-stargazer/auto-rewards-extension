import { devLog, updateTabAndWaitForLoad } from "../modules/utils";
import {
  AarpActivity,
  AarpActivityStatuses,
  AarpBalance,
  AarpRewardsResponse,
  AarpUser,
  ACCESS_TOKEN_STORAGE_KEYS,
  ActivitiesListSchema,
  ActivityStatusResponseSchema,
  getTabLocalStorage,
  onActivitiesRequest,
  onActivityStatusesRequest,
  onEarnRewardsRequest,
  onGetUserRequest,
  onPossibleUserChangeAlert,
  onUpdateAarpTabRequest,
  RewardsResponseSchema,
  setTabLocalStorage,
  SUPPORTED_ACTIVITY_TYPES,
  SupportedActivityType,
  USER_COOKIES,
} from "./modules/definitions";
import { isAarpTab, ORIGIN, queryAarpApi, REWARDS_URL } from "./modules/tools";

// Utilities --------------------------------------------------------------------------------------

const ACTIVITY_LIST_API_URL =
  "https://services.share.aarp.org/applications/loyalty-catalog/activity/listV3";
const ACTIVITY_STATUS_API_URL = (userFedId: string) =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/limit/${userFedId}`;
const ACTIVITY_REWARDS_API_URL = (
  userFedId: string,
  activityId: string
): string =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/${userFedId}/${activityId}`;

async function getAarpTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const aarpTabs = tabs.filter((tab) => isAarpTab(tab.url));
  devLog("getAarpTab", "tabs:", tabs, "| aarp tabs:", aarpTabs);
  if (aarpTabs.length > 0) {
    devLog("getAarpTab", "selected tab:", aarpTabs[0]);
    return aarpTabs[0];
  }
  return new Promise((resolve) => {
    devLog(
      "getAarpTab",
      "well, I can't find an aarp tab, so I'ma just create one"
    );
    chrome.tabs.create({ url: ORIGIN }, (newTab) => {
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

// Message functions ------------------------------------------------------------------------------

async function updateAarpTab(
  update: chrome.tabs.UpdateProperties
): Promise<number> {
  devLog("update aarp tab:", update);
  const aarpTab = await updateTabAndWaitForLoad(
    (
      await getAarpTab()
    ).id!,
    update
  );
  if (!aarpTab)
    throw new Error("Error occurred updating AARP tab or tab was closed");
  return aarpTab.id!;
}

async function getUser(): Promise<{
  user: AarpUser | null;
  balance: AarpBalance;
}> {
  devLog("getUser", "getting user");
  const aarpTab = await getAarpTab();
  const cookies = await USER_COOKIES.reduce<
    Promise<{
      [key: string]: string | null;
    }>
  >(async (cookiesObjPromise, cookieName) => {
    const cookiesObj = await cookiesObjPromise;
    const cookie = await chrome.cookies.get({ name: cookieName, url: ORIGIN });
    cookiesObj[cookieName] = cookie && cookie.value;
    return cookiesObj;
  }, Promise.resolve({}));
  devLog("getUser", "got user cookies:", cookies);

  const accessToken =
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[0], aarpTab.id!)) ??
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[1], aarpTab.id!));
  const dailyPointsLeft = await getTabLocalStorage(
    "user_daily_points_left",
    aarpTab.id!
  );
  devLog("getUser", "got user localstorage:", { accessToken, dailyPointsLeft });

  const user: AarpUser | null =
    (cookies["fedid"] &&
      accessToken && {
        username: cookies["games"] ?? "unknown",
        fedId: cookies["fedid"],
        accessToken: accessToken,
        mustConfirmPassword:
          !cookies["AARP_SSO_AUTH_EX"] || !cookies["AARP_SSO_AUTH2"],
      }) ||
    null;

  const balance = {
    rewardsBalance: cookies["aarp_rewards_balance"]
      ? Number(cookies["aarp_rewards_balance"])
      : undefined,
    dailyPointsLeft: dailyPointsLeft ? Number(dailyPointsLeft) : undefined,
  };

  devLog("getUser", "got user:", { user, balance });

  return {
    user,
    balance,
  };
}

async function getActivities(
  accessToken: string,
  maxNActivities: number
): Promise<AarpActivity[]> {
  devLog("getActivities", "getting activities");

  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL })
  );

  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    accessToken,
    aarpTab.url!,
    ActivitiesListSchema,
    "GET"
  );
  devLog("getActivities", "got API response", activitiesList);

  // We need to filter out outdated/inactive activities as well as activites we can't automate
  const now = new Date();
  const filteredActivitiesList = activitiesList.filter((activity) => {
    if (
      activity.active &&
      (activity.deleted === null || !activity.deleted) &&
      SUPPORTED_ACTIVITY_TYPES.includes(
        activity.activityType.identifier as SupportedActivityType
      )
    ) {
      const dateRange = [
        new Date(activity.startDate),
        new Date(activity.endDate),
      ];
      return dateRange[0] <= now && now <= dateRange[1];
    }
    return false;
  });

  devLog("getActivities", "filtered activities list:", filteredActivitiesList);

  return filteredActivitiesList.slice(0, maxNActivities);
}

async function getActivityStatuses(
  activityIds: string[],
  userFedId: string,
  accessToken: string
): Promise<AarpActivityStatuses["activityFinishedStatuses"]> {
  if (activityIds.length === 0) return [];
  devLog("getActivityStatuses", "getting activity statuses");

  const aarpTab = await getAarpTab();

  const activityFinishedStatuses: (boolean | undefined)[] = [];
  let userDailyPointsLeft = 0;

  // Activity statuses can only be gotten 10 at a time
  for (let i = 0; i < activityIds.length; i += 10) {
    const activityList = activityIds.slice(i, i + 10).map((id) => {
      return { activityIdentifier: id };
    });

    const activityStatusesResponse = await queryAarpApi(
      ACTIVITY_STATUS_API_URL(userFedId),
      { activityList: activityList },
      accessToken,
      REWARDS_URL,
      ActivityStatusResponseSchema
    );

    activityFinishedStatuses.push(
      ...activityStatusesResponse.activityList.map((statusResponse) =>
        statusResponse.Error === null && statusResponse.Input === null
          ? statusResponse.limitHit
          : undefined
      )
    );
    userDailyPointsLeft = activityStatusesResponse.userDailyPointsLeft;
  }
  devLog(
    "getActivityStatuses",
    "got finished statuses:",
    activityFinishedStatuses
  );

  devLog("getActivityStatuses", "setting user daily points left localstorage");
  setTabLocalStorage(
    { key: "user_daily_points_left", value: userDailyPointsLeft.toString() },
    aarpTab.id!
  );

  return activityFinishedStatuses;
}

async function earnActivityRewards(
  activity: { identifier: string; type: string; url: string },
  user: { fedId: string; accessToken: string }
): Promise<AarpRewardsResponse | null> {
  if (
    !SUPPORTED_ACTIVITY_TYPES.includes(activity.type as SupportedActivityType)
  )
    return null;

  devLog("earnActivityRewards", "earning activity rewards:", activity);

  const rewardsResponse = await queryAarpApi(
    ACTIVITY_REWARDS_API_URL(user.fedId, activity.identifier),
    {},
    user.accessToken,
    activity.url,
    RewardsResponseSchema
  );
  devLog("earnActivityRewards", "got response", rewardsResponse);

  // Write aarp_rewards_balance manually (cookie listener below already
  // listens for this so no need to manually send balance update)
  const balanceCookie = {
    url: ORIGIN,
    name: "aarp_rewards_balance",
  };
  const previousBalance = await chrome.cookies.get({ ...balanceCookie });
  const newBalance =
    (previousBalance ? Number(previousBalance.value) : 0) +
    rewardsResponse.pointsEarned;
  if (previousBalance?.value !== newBalance.toString()) {
    devLog("earnActivityRewards", "setting balance cookie");
    await chrome.cookies.remove({ ...balanceCookie });
    await chrome.cookies.set({
      ...balanceCookie,
      value: newBalance.toString(),
    });
  }

  return rewardsResponse;
}

// Register functional message listeners ----------------------------------------------------------

onUpdateAarpTabRequest(async (sendResponse, update) =>
  sendResponse(await updateAarpTab(update))
);

onGetUserRequest(async (sendResponse) => sendResponse(await getUser()));

onActivitiesRequest(async (sendResponse, { accessToken, maxNActivities }) =>
  sendResponse(await getActivities(accessToken, maxNActivities))
);

onActivityStatusesRequest(
  async (sendResponse, { activityIds, userFedId, accessToken }) =>
    sendResponse(await getActivityStatuses(activityIds, userFedId, accessToken))
);

onEarnRewardsRequest(async (sendResponse, { activity, user }) =>
  sendResponse(await earnActivityRewards(activity, user))
);

// Register message listeners involving side panel and content commmunication ---------------------

let sidepanelPort: chrome.runtime.Port | null = null;

chrome.runtime.onConnect.addListener(function (port) {
  devLog("sidepanelPortListener", "Side panel connected:", port.name);
  if (port.name === "sidepanel-port") {
    sidepanelPort = port;

    // Optional: Handle port disconnection (e.g., when the side panel is closed)
    sidepanelPort.onDisconnect.addListener(function () {
      devLog("sidepanelPortListener", "Side panel disconnected");
      sidepanelPort = null;
    });
  }
});

// When user actually changes a lot of little changes happen in a short period so instead of fetching user and sending to
// sidepanel for each, set a timeout that waits a little after each request before finally executing when it slows.
const USER_UPDATE_BUFFER_MS = 1000;
let sendUserUpdateTimeout: NodeJS.Timeout | null = null;

function onPossibleUserChange() {
  devLog("onPossibleUserChange", "recieved alert");
  if (sendUserUpdateTimeout) clearTimeout(sendUserUpdateTimeout);
  sendUserUpdateTimeout = setTimeout(async () => {
    if (sidepanelPort) {
      devLog("onPossibleUserChange", "getting user");
      const { user, balance } = await getUser();
      devLog("onPossibleUserChange", "sending user to sidepanel");
      sidepanelPort.postMessage({ user, balance });
    }
  }, USER_UPDATE_BUFFER_MS);
}

onPossibleUserChangeAlert(async (sendResponse) =>
  sendResponse(onPossibleUserChange())
);

chrome.cookies.onChanged.addListener((change) => {
  if (USER_COOKIES.includes(change.cookie.name)) {
    devLog("aarpCookieListener", "recieved possible change cookie:", change);
    onPossibleUserChange();
  }
});
