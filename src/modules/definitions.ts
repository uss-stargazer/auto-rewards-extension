import { createMessage, createTabMessage } from "./utils/safeMessages";

export const [openExtensionOptions, onOpenExtensionOptionsRequest] =
  createMessage<void, void>("openExtensionOptions");
