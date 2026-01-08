import React from "react";
import { createRoot } from "react-dom/client";

const platforms: { name: string; element: React.ReactElement }[] = [];

function Sidepanel() {
  return (
    <div>
      <h1>Sidepanel</h1>
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
