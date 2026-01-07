import { updateTabAndWaitForLoad } from "../modules/utils";
import {
  AarpActivity,
  AarpActivityStatuses,
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
  SUPPORTED_ACTIVITY_TYPES,
  SupportedActivityType,
  USER_COOKIES,
} from "./modules/definitions";
import { isAarpTab, ORIGIN, queryAarpApi, REWARDS_URL } from "./modules/tools";

console.log("hello from service worker");

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
  console.log("[background, getAarpTab] getting aarp tab");
  const tabs = await chrome.tabs.query({ currentWindow: true });
  console.log("[background, getAarpTab] all current tabs:", tabs);
  const aarpTabs = tabs.filter((tab) => isAarpTab(tab.url));
  console.log("[background, getAarpTab] all current aarp tabs:", aarpTabs);
  if (aarpTabs.length > 0) return aarpTabs[0];
  console.log(
    "[background, getAarpTab] couldn't find active aarp tab so imma create a new one"
  );
  return new Promise((resolve) => {
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
  console.log("[background, updateAarpTab] updating aarp tab", update);
  const aarpTab = await updateTabAndWaitForLoad(
    (
      await getAarpTab()
    ).id!,
    update
  );
  if (!aarpTab) throw new Error("Error occurred updating AARP tab");
  return aarpTab.id!;
}

async function getUser(): Promise<{
  user: AarpUser | null;
  rewardsBalance?: number;
}> {
  console.log("[background, getUser] getting user object");
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
  console.log("[background, getUser] got cookies:", cookies);

  const accessToken =
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[0], aarpTab.id!)) ??
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[1], aarpTab.id!));

  console.log("[background, getUser] got access token:", accessToken);

  const user =
    (cookies["fedid"] &&
      accessToken && {
        username: cookies["games"] ?? "unknown",
        fedId: cookies["fedid"],
        accessToken: accessToken,
        userMustConfirmPassword:
          !cookies["AARP_SSO_AUTH_EX"] || !cookies["AARP_SSO_AUTH2"],
      }) ||
    null;

  console.log("[background, getUser] got user:", user);
  return {
    user,
    rewardsBalance:
      (cookies["aarp_rewards_balance"] &&
        Number(cookies["aarp_rewards_balance"])) ||
      undefined,
  };
}

async function getActivities(
  accessToken: string,
  maxNActivities: number
): Promise<AarpActivity[]> {
  console.log("[background, getActivities] getting activities list");

  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL })
  );
  console.log(
    "[background, getActivities] got aarp tab with rewards url:",
    REWARDS_URL
  );

  console.log(
    "[background, getActivities] about to query api for activity list"
  );
  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    accessToken,
    aarpTab.url!,
    ActivitiesListSchema,
    "GET"
  );

  console.log(
    "[background, getActivities] raw activities list:",
    activitiesList
  );

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
  console.log(
    "[background, getActivities] filtered activities list:",
    filteredActivitiesList
  );

  return filteredActivitiesList.slice(0, maxNActivities);
}

async function getActivityStatuses(
  activityIds: string[],
  userFedId: string,
  accessToken: string
): Promise<AarpActivityStatuses> {
  if (activityIds.length === 0)
    return { activityFinishedStatuses: [], userDailyPointsLeft: undefined };

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

  return { activityFinishedStatuses, userDailyPointsLeft };
}

async function earnActivityRewards(
  activity: { identifier: string; type: string; url: string },
  user: { fedId: string; accessToken: string }
): Promise<AarpRewardsResponse | null> {
  console.log("earn activity rewards for", activity.identifier);

  if (
    !SUPPORTED_ACTIVITY_TYPES.includes(activity.type as SupportedActivityType)
  )
    return null;

  const rewardsResponse = await queryAarpApi(
    ACTIVITY_REWARDS_API_URL(user.fedId, activity.identifier),
    {},
    user.accessToken,
    activity.url,
    RewardsResponseSchema
  );

  // Write aarp_rewards_balance manually (cookie listener below already
  // listens for this so no need to manually send balance update)
  const previousBalance = await chrome.cookies.get({
    url: ORIGIN,
    name: "aarp_rewards_balance",
  });
  const newBalance =
    (previousBalance ? Number(previousBalance.value) : 0) +
    rewardsResponse.pointsEarned;
  await chrome.cookies.set({
    url: ORIGIN,
    name: "aarp_rewards_balance",
    value: newBalance.toString(),
  });
  console.log(
    "[service worker] aarp_rewards_balance cookie set to:",
    newBalance.toString()
  );

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
  console.log("Side panel connected:", port.name);
  if (port.name === "sidepanel-port") {
    sidepanelPort = port;

    // Optional: Handle port disconnection (e.g., when the side panel is closed)
    sidepanelPort.onDisconnect.addListener(function () {
      console.log("Side panel disconnected");
      sidepanelPort = null;
    });
  }
});

// When user actually changes a lot of little changes happen in a short period so instead of fetching user and sending to
// sidepanel for each, set a timeout that waits a little after each request before finally executing when it slows.
const USER_UPDATE_BUFFER_MS = 1000;
let sendUserUpdateTimeout: NodeJS.Timeout | null = null;

function onPossibleUserChange() {
  console.log("[background, userChangeAlert] got possible user change alert");
  if (sendUserUpdateTimeout) clearTimeout(sendUserUpdateTimeout);
  sendUserUpdateTimeout = setTimeout(async () => {
    if (sidepanelPort) {
      const user = await getUser();
      console.log(
        "[background, userChangeAlert] got current user",
        user,
        "and sending update"
      );
      sidepanelPort.postMessage(user);
    }
  }, USER_UPDATE_BUFFER_MS);
}

onPossibleUserChangeAlert(async (sendResponse) =>
  sendResponse(onPossibleUserChange())
);

chrome.cookies.onChanged.addListener((change) => {
  console.log("[background, cookie listener] got cookie change", change);
  if (USER_COOKIES.includes(change.cookie.name)) {
    console.log(
      "[background, cookie listener] identified cookie change",
      change.cookie.name,
      "as possible user change and sent alert"
    );
    onPossibleUserChange();
  }
});
