import { useEffect } from "react";
import { getThemeOption, onThemeOption, Theme } from "../modules/options";

export default function useTheme() {
  const root = document.documentElement;

  const updateTheme = (theme: Theme) => {
    if (theme === "dark") root.classList.add("dark-theme");
    else root.classList.remove("dark-theme");
  };

  useEffect(() => {
    getThemeOption().then(updateTheme); // Initial
    return onThemeOption(updateTheme);
  }, []);
}
