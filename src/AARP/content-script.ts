import { onTabLocalStorageRequest } from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) => {
  console.log("recieved request for tab local storage entry:", key);
  console.log("got entry value:", localStorage.getItem(key));
  return sendResponse(localStorage.getItem(key));
});

// Make it so that on every aarp page load, it sends an updated user variable to service worker so
// or on tab update, get user and somehow send to index.tsx
