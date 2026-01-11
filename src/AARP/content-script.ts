import { devLog } from "../modules/utils";
import {
  alertPossibleUserChange,
  USER_STORAGE_KEYS,
  onTabLocalStorageGetRequest,
  onTabLocalStorageSetRequest,
} from "./modules/definitions";

onTabLocalStorageGetRequest(async (sendResponse, key) => {
  const value = localStorage.getItem(key);
  devLog("onTabLocalStorageGetRequest", "getting", key, ":", value);
  return sendResponse(value);
});

onTabLocalStorageSetRequest(async (sendResponse, { key, value }) => {
  devLog("onTabLocalStorageSetRequest", "setting", key, ":", value);
  localStorage.setItem(key, value);
  return sendResponse();
});

// Add listeners for localStorage to alert the service worker that the user may have changed

window.addEventListener("storage", (event) => {
  if (
    event.storageArea === localStorage &&
    USER_STORAGE_KEYS.includes(event.key!)
  ) {
    devLog("aarpStorageListener", "recieved possible change storage:", event);
    alertPossibleUserChange();
  }
});
