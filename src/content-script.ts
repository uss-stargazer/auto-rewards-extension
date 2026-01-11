import { onDarkModePreferenceRequest } from "./modules/definitions";
import { devLog } from "./modules/utils";

devLog("content script for EVERYTHING");

onDarkModePreferenceRequest(async (sendResponse) => {
  devLog("onDarkModePreferenceRequest", "got");
  const value = window.matchMedia("(prefers-color-scheme: dark)").matches;
  devLog("onDarkModePreferenceRequest", "prefers:", value);
  return value;
});
