import { onDarkModePreferenceRequest } from "./modules/definitions";

onDarkModePreferenceRequest(async (sendResponse) =>
  sendResponse(window.matchMedia("(prefers-color-scheme: dark)").matches)
);
