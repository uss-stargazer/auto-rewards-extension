import { createTabMessage } from "./utils/safeMessages";

export const [getDarkModePreference, onDarkModePreferenceRequest] =
  createTabMessage<void, boolean>("prefersDarkMode");
