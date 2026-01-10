import React from "react";
import { createRoot } from "react-dom/client";
import useOptions from "./hooks/useOptions";
import setTheme from "./modules/setTheme";

function Options() {
  const { options, setOption } = useOptions();

  setTheme(options.darkMode);

  return (
    <div>{Object.entries(options).map(([optionName, value], idx) => {})}</div>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);

//https://medium.com/@kirankumal714/best-way-to-handle-form-validation-react-hook-form-and-zod-integration-with-react-select-and-react-1c96c27cf6df
//https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/
