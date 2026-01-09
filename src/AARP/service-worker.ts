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

// Utilities --------------------------------------------------------------------------------------

const ACTIVITY_LIST_API_URL =
  "https://services.share.aarp.org/applications/loyalty-catalog/activity/listV3";
const ACTIVITY_STATUS_API_URL = (userFedId: string) =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/limit/${userFedId}`;
const ACTIVITY_REWARDS_API_URL = (
  userFedId: string,
  activityId: string,
): string =>
  `https://services.share.aarp.org/applications/loyalty-catalog/activity/usergroup/member/user/${userFedId}/${activityId}`;

async function getAarpTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const aarpTabs = tabs.filter((tab) => isAarpTab(tab.url));
  if (aarpTabs.length > 0) return aarpTabs[0];
  return new Promise((resolve) => {
    chrome.tabs.create({ url: ORIGIN }, (newTab) => {
      const listener = (
        tabId: number,
        changeInfo: chrome.tabs.OnUpdatedInfo,
        tab: chrome.tabs.Tab,
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
  update: chrome.tabs.UpdateProperties,
): Promise<number> {
  const aarpTab = await updateTabAndWaitForLoad(
    (
      await getAarpTab()
    ).id!,
    update,
  );
  if (!aarpTab) throw new Error("Error occurred updating AARP tab");
  return aarpTab.id!;
}

async function getUser(): Promise<AarpUser | null> {
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

  const accessToken =
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[0], aarpTab.id!)) ??
    (await getTabLocalStorage(ACCESS_TOKEN_STORAGE_KEYS[1], aarpTab.id!));
  const dailyPointsLeft = await getTabLocalStorage(
    "user_daily_points_left",
    aarpTab.id!,
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
  maxNActivities: number,
): Promise<AarpActivity[]> {
  // Navigate to the rewards dashboard to make it look more normal instead of just
  // sending a bunch of API calls. Plus the tab was already created in getUser.
  const aarpTab = await chrome.tabs.get(
    await updateAarpTab({ url: REWARDS_URL }),
  );

  const activitiesList = await queryAarpApi(
    ACTIVITY_LIST_API_URL,
    undefined,
    accessToken,
    aarpTab.url!,
    ActivitiesListSchema,
    "GET",
  );

  // We need to filter out outdated/inactive activities as well as activites we can't automate
  const now = new Date();
  const filteredActivitiesList = activitiesList.filter((activity) => {
    if (
      activity.active &&
      (activity.deleted === null || !activity.deleted) &&
      SUPPORTED_ACTIVITY_TYPES.includes(
        activity.activityType.identifier as SupportedActivityType,
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

  return filteredActivitiesList.slice(0, maxNActivities);
}

async function getActivityStatuses(
  activityIds: string[],
  userFedId: string,
  accessToken: string,
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
      ActivityStatusResponseSchema,
    );

    activityFinishedStatuses.push(
      ...activityStatusesResponse.activityList.map((statusResponse) =>
        statusResponse.Error === null && statusResponse.Input === null
          ? statusResponse.limitHit
          : undefined,
      ),
    );
    userDailyPointsLeft = activityStatusesResponse.userDailyPointsLeft;
  }

  return { activityFinishedStatuses, userDailyPointsLeft };
}

async function earnActivityRewards(
  activity: { identifier: string; type: string; url: string },
  openActivityUrl: boolean,
  user: { fedId: string; accessToken: string },
): Promise<AarpRewardsResponse | null> {
  if (
    !SUPPORTED_ACTIVITY_TYPES.includes(activity.type as SupportedActivityType)
  )
    return null;

  if (openActivityUrl) await updateAarpTab({ url: activity.url });

  return await queryAarpApi(
    ACTIVITY_REWARDS_API_URL(user.fedId, activity.identifier),
    {},
    user.accessToken,
    activity.url,
    RewardsResponseSchema,
  );
}

// Register functional message listeners ----------------------------------------------------------

onUpdateAarpTabRequest(async (sendResponse, update) =>
  sendResponse(await updateAarpTab(update)),
);

onGetUserRequest(async (sendResponse) => sendResponse(await getUser()));

onActivitiesRequest(async (sendResponse, { accessToken, maxNActivities }) =>
  sendResponse(await getActivities(accessToken, maxNActivities)),
);

onActivityStatusesRequest(
  async (sendResponse, { activityIds, userFedId, accessToken }) =>
    sendResponse(
      await getActivityStatuses(activityIds, userFedId, accessToken),
    ),
);

onEarnRewardsRequest(
  async (sendResponse, { activity, openActivityUrl, user }) =>
    sendResponse(await earnActivityRewards(activity, openActivityUrl, user)),
);

// Register message listeners involving side panel and content commmunication ---------------------

let sidepanelPort: chrome.runtime.Port | null = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "sidepanel-port") {
    sidepanelPort = port;
    sidepanelPort.onDisconnect.addListener(() => {
      sidepanelPort = null;
    });
  }
});

// When user actually changes a lot of little changes happen in a short period so instead of fetching user and sending to
// sidepanel for each, set a timeout that waits a little after each request before finally executing when it slows.
const USER_UPDATE_BUFFER_MS = 1000;
let sendUserUpdateTimeout: NodeJS.Timeout | null = null;

function onPossibleUserChange() {
  if (sendUserUpdateTimeout) clearTimeout(sendUserUpdateTimeout);
  sendUserUpdateTimeout = setTimeout(async () => {
    if (sidepanelPort) sidepanelPort.postMessage(await getUser());
  }, USER_UPDATE_BUFFER_MS);
}

onPossibleUserChangeAlert(async (sendResponse) =>
  sendResponse(onPossibleUserChange()),
);

chrome.cookies.onChanged.addListener((change) => {
  if (USER_COOKIES.includes(change.cookie.name)) onPossibleUserChange();
});
