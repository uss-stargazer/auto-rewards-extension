import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import AARP from "./AARP";
import useOptions, { OptionsProvider } from "./hooks/useOptions";
import setTheme from "./modules/setTheme";
import { openExtensionOptions } from "./modules/definitions";

const platforms: { name: string; element: React.ReactElement }[] = [AARP];

function Sidepanel() {
  const { options } = useOptions();
  const [activePlatformIdx, setActivePlatformIdx] = useState<number>(-1);

  setTheme(options.darkMode);

  return (
    <div>
      <div>
        <h1>Sidepanel</h1>
        <div onClick={() => openExtensionOptions()}>Settings</div>
      </div>

      <div id="platforms">
        {platforms.map((platform, idx) => (
          <div key={platform.name}>
            <div
              onClick={() => {
                if (activePlatformIdx === idx) setActivePlatformIdx(-1);
                else setActivePlatformIdx(idx);
              }}
            >
              <p>{platform.name}</p>
            </div>
            {idx === activePlatformIdx && <div>{platform.element}</div>}
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
