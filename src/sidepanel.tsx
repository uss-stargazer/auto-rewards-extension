import React from "react";
import { createRoot } from "react-dom/client";

import AARP from "./AARP";
import useOptions, { OptionsProvider } from "./hooks/useOptions";
import setTheme from "./modules/setTheme";
import { openExtensionOptions } from "./modules/definitions";

const platforms: { name: string; element: React.ReactElement }[] = [AARP];

function Sidepanel() {
  const { options } = useOptions();

  setTheme(options.darkMode);

  return (
    <div>
      <div>
        <h1>Sidepanel</h1>
        <div onClick={() => openExtensionOptions()}>Settings</div>
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
    <OptionsProvider>
      <Sidepanel />
    </OptionsProvider>
  </React.StrictMode>
);
