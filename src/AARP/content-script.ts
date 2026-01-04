import {
  ACCESS_TOKEN_STORAGE_KEYS,
  alertPossibleUserChange,
  onTabLocalStorageRequest,
} from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) => {
  console.log("recieved request for tab local storage entry:", key);
  console.log("got entry value:", localStorage.getItem(key));
  return sendResponse(localStorage.getItem(key));
});

// Add listeners for localStorage to alert the service worker that the user may have changed

window.addEventListener("storage", (event) => {
  console.log(
    "[content, storage listener] got",
    event.storageArea,
    "storage changes",
    event.key
  );
  if (
    event.storageArea === localStorage &&
    ACCESS_TOKEN_STORAGE_KEYS.includes(event.key!)
  ) {
    console.log(
      "[content, storage listener] identified local storage changes as possible user change and sent alert"
    );
    alertPossibleUserChange();
  }
});
