import {
  alertPossibleUserChange,
  onTabLocalStorageRequest,
  USER_STORAGE_KEYS,
} from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) =>
  sendResponse(localStorage.getItem(key))
);

// Add listeners for localStorage to alert the service worker that the user may have changed

window.addEventListener("storage", (event) => {
  if (
    event.storageArea === localStorage &&
    USER_STORAGE_KEYS.includes(event.key!)
  )
    alertPossibleUserChange();
});
