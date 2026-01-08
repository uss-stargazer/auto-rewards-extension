import { onTabLocalStorageRequest } from "./modules/definitions";

onTabLocalStorageRequest(async (sendResponse, key) =>
  sendResponse(localStorage.getItem(key))
);
