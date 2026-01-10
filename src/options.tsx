import React from "react";
import { createRoot } from "react-dom/client";
import useTheme from "./hooks/useTheme";
import { darkModeOption } from "./modules/options";

const options = [darkModeOption];

function Options() {
  useTheme();

  return <div></div>;
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);

//https://medium.com/@kirankumal714/best-way-to-handle-form-validation-react-hook-form-and-zod-integration-with-react-select-and-react-1c96c27cf6df
//https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
