import * as z from "zod";
import { createOption } from "../modules/safeOptions";

const OPTION_NAMES = ["darkMode"] as const;

const darkModeSchema = z.boolean();

// export const darkModeOption = createOption(
//   "dark-mode",
//   window.matchMedia("(prefers-color-scheme: dark)").matches
// );

export type Options = {
  darkMode: z.infer<typeof darkModeSchema>;
};
