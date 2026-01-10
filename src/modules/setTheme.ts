export default function setTheme(darkMode: boolean) {
  const root = document.body;
  const currentlyDarkMode = root.classList.contains("dark-theme");
  if (darkMode && !currentlyDarkMode) root.classList.add("dark-theme");
  else if (!darkMode && currentlyDarkMode) root.classList.remove("dark-theme");
}
