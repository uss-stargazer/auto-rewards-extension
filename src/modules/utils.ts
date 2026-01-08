/**
 * Converts both parameters to strings and compares those.
 * Don't use if the items contain more complex things like functions or DOM nodes.
 */
export function simpleDeepCompare(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function updateTabAndWaitForLoad(
  tabId: number,
  update: chrome.tabs.UpdateProperties
): Promise<chrome.tabs.Tab | undefined> {
  const updatedTab = await chrome.tabs.update(tabId, update);
  if (!updatedTab) return undefined;
  return new Promise((resolve) => {
    const listener = (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tabId === updatedTab.id && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(tab);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
