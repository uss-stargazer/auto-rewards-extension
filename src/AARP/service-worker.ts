import { updateTabAndWaitForLoad } from "../modules/utils";
import {
  ActivitiesListSchema,
  getTabLocalStorage,
  getUser,
  NotLoggedInError,
  onActivitiesRequest,
  onGetUserRequest,
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

onGetUserRequest(async (sendResponse) => {
  const aarpTab = await getAarpTab();
  const username = await chrome.cookies.get({
    name: "game",
    url: "https://secure.aarp.org",
  });
  const userFedId = await chrome.cookies.get({
    name: "fedid",
    url: "https://secure.aarp.org",
  });
  const accessToken = await getTabLocalStorage("access_token", aarpTab.id!);
  return sendResponse(
    (username &&
      userFedId &&
      accessToken && {
        username: username.value,
        fedId: userFedId.value,
        accessToken: accessToken,
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
  const aarpTab = await updateTabAndWaitForLoad((await getAarpTab()).id!, {
    url: REWARDS_URL,
    active: true,
  });
  if (!aarpTab) throw new Error("Error occurred updating AARP tab URL");

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
