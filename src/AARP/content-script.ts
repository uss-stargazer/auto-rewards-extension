import {
  alertPossibleUserChange,
  onTabLocalStorageRequest,
} from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) => {
  console.log("recieved request for tab local storage entry:", key);
  console.log("got entry value:", localStorage.getItem(key));
  return sendResponse(localStorage.getItem(key));
});

// Add listeners for localStorage or cookie changes to alert the service worker
// (which will then check if user has been updated)

const USER_STORAGE_KEYS = // import from definitions
const USER_COOKIES =

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (changes.keys().some((key) => USER_STORAGE_KEYS.includes(key))) 
    alertPossibleUserChange();
});

chrome.cookies.onChanged.addListener((change) => {
  if (USER_COOKIES.includes(change.cookie.name))
    alertPossibleUserChange();
});
