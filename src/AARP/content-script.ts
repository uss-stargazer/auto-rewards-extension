import {
  ACCESS_TOKEN_STORAGE_KEYS,
  alertPossibleUserChange,
  onTabLocalStorageRequest,
  USER_COOKIES,
} from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) => {
  console.log("recieved request for tab local storage entry:", key);
  console.log("got entry value:", localStorage.getItem(key));
  return sendResponse(localStorage.getItem(key));
});

// Add listeners for localStorage or cookie changes to alert the service worker
// (which will then check if user has been updated)

chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log("[AARP content] got", areaName, "storage changes", changes);
  if (
    areaName === "local" &&
    Object.keys(changes).some((key) => ACCESS_TOKEN_STORAGE_KEYS.includes(key))
  ) {
    console.log(
      "[AARP content] identified local storage changes as possible user change and sent alert"
    );
    alertPossibleUserChange();
  }
});

chrome.cookies.onChanged.addListener((change) => {
  console.log("[AARP content] got cookie change", change);
  if (USER_COOKIES.includes(change.cookie.name)) {
    console.log(
      "[AARP content] identified cookie change",
      change.cookie.name,
      "as possible user change and sent alert"
    );
    alertPossibleUserChange();
  }
});
