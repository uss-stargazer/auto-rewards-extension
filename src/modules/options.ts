import * as z from "zod";
import { createOption } from "../modules/safeOptions";

const themeSchema = z.enum(["light", "dark"]);
export type Theme = z.infer<typeof themeSchema>;
export const [setThemeOption, getThemeOption, onThemeOption] = createOption(
  themeSchema,
  "theme",
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);
