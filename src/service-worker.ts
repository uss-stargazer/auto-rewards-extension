import { onOpenExtensionOptionsRequest } from "./modules/definitions";

if (chrome.sidePanel)
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

onOpenExtensionOptionsRequest(async (sendResponse) =>
  sendResponse(await chrome.runtime.openOptionsPage()),
);
