import * as z from "zod";
import { createOption } from "../modules/safeOptions";

export const darkModeOption = createOption(
  z.boolean(),
  "dark-mode",
  window.matchMedia("(prefers-color-scheme: dark)").matches
);
