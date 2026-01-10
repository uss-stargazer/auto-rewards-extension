import { useEffect, useState } from "react";
import { darkModeOption } from "../modules/options";

export default function useTheme(): "light" | "dark" {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const body = document.body;
  const updateTheme = (darkMode: boolean) => {
    if (darkMode) body.classList.add("dark-theme");
    else body.classList.remove("dark-theme");
    setDarkMode(darkMode);
  };

  useEffect(() => {
    darkModeOption.get().then(updateTheme); // Initial
    return darkModeOption.onUpdate(updateTheme);
  }, []);

  return darkMode ? "dark" : "light";
}
