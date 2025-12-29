import React from "react";
import { createContext, PropsWithChildren } from "react";

export type Theme = "light" | "dark";

export const ThemeContext = createContext<Theme>("light");

export default function ThemeProvider({
  theme,
  children,
}: PropsWithChildren<{ theme: Theme }>) {
  return (
    <ThemeContext.Provider value={theme}>
      <style media={`${theme}.css`}></style>
      {children}
    </ThemeContext.Provider>
  );
}
