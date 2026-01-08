import {
  createMessage,
  createTabMessage,
} from "../../modules/utils/safeMessages";

// Types and schemas -------------------

export interface AarpUser {
  username: string;
  fedId: string;
  accessToken: string;
}

// Content script message definitions -------------------

export const [getTabLocalStorage, onTabLocalStorageRequest] = createTabMessage<
  string,
  string | null
>("getTabLocalStorage");

// Service worker message definitions -------------------

export const [getUser, onGetUserRequest] = createMessage<void, AarpUser | null>(
  "getAarpUser"
);
