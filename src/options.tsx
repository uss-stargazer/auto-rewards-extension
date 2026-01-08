import React from "react";
import { createRoot } from "react-dom/client";

function Options() {
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
