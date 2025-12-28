import React from "react";
import { createRoot } from "react-dom/client";
import aarp from "./AARP";

const platforms = [aarp];

function Sidepanel() {
  return (
    <div>
      <h1>This is the sidepanel udpated (DO STYLING)</h1>
      <div id="platforms">
        {platforms.map((platform, idx) => (
          <div key={idx}>
            <p>{platform.name}</p>
            <div>{platform.element}</div>
          </div>
        ))}
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
