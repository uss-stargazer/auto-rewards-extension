import {
  alertPossibleUserChange,
  USER_STORAGE_KEYS,
  onTabLocalStorageGetRequest,
  onTabLocalStorageSetRequest,
} from "./modules/definitions";

onTabLocalStorageGetRequest(async (sendResponse, key) =>
  sendResponse(localStorage.getItem(key))
);

onTabLocalStorageSetRequest(async (sendResponse, { key, value }) => {
  localStorage.setItem(key, value);
  return sendResponse();
});

// Add listeners for localStorage to alert the service worker that the user may have changed

window.addEventListener("storage", (event) => {
  if (
    event.storageArea === localStorage &&
    USER_STORAGE_KEYS.includes(event.key!)
  )
    alertPossibleUserChange();
});
