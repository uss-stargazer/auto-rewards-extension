import { useState } from "react";

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

export type UseStateReturn<S> = [S, React.Dispatch<React.SetStateAction<S>>];
type TypeFromUseStateReturn<T> = T extends UseStateReturn<infer S> ? S : never;

// Creates object for states for each key
export function createStatesObject<T extends { [key: string]: any }>(
  defaultValues: T
): {
  [K in keyof T]: UseStateReturn<T[K]>;
} {
  const states = {} as any;
  for (const key in defaultValues) states[key] = useState(defaultValues[key]);
  return states;
}

export function parseStatesObject<
  T extends { [key: string]: UseStateReturn<any> }
>(
  statesObject: T
): {
  [K in keyof T]: TypeFromUseStateReturn<T[K]>;
} {
  const props = {} as any;
  for (const key in statesObject) props[key] = statesObject[key][0];
  return props;
}
