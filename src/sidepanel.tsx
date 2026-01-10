import React from "react";
import { createRoot } from "react-dom/client";

import AARP from "./AARP";
import useTheme from "./hooks/useTheme";

const platforms: { name: string; element: React.ReactElement }[] = [AARP];

function Sidepanel() {
  useTheme();

  return (
    <div>
      <div>
        <h1>Sidepanel</h1>
        <div onClick={() => chrome.runtime.openOptionsPage()}>Settings</div>
      </div>

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
