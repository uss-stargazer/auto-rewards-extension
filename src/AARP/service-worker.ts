import { getTabLocalStorage, onGetUserRequest } from "./modules/definitions";
import { isAarpTab, ORIGIN } from "./modules/tools";

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
