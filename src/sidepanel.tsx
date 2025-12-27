import React from "react";
import { createRoot } from "react-dom/client";
import { AARP } from "./AARP";

function Sidepanel() {
  return (
    <div>
      <h1>This is the sidepanel</h1>
      <div id="platforms">
        <AARP />
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Sidepanel />
  </React.StrictMode>
);
