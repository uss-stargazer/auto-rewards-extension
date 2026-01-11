import { createMessage, createTabMessage } from "./utils/safeMessages";

export const [openExtensionOptions, onOpenExtensionOptionsRequest] =
  createMessage<void, void>("openExtensionOptions");

export const [getDarkModePreference, onDarkModePreferenceRequest] =
  createTabMessage<void, boolean>("prefersDarkMode");
