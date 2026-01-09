import React from "react";
import { createRoot } from "react-dom/client";
import useTheme from "./hooks/useTheme";

function Options() {
  useTheme();

  return (
    <div>
      <h1>Options</h1>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
