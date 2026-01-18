import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import useOptions, { OptionsProvider } from "./hooks/useOptions";
import setTheme from "./modules/setTheme";
import { openExtensionOptions } from "./modules/definitions";
import { MdKeyboardArrowDown, MdOutlineSettings } from "react-icons/md";

const platforms: { name: string; element: React.ReactElement }[] = [];

function Sidepanel() {
  const { options } = useOptions();
  const [activePlatformIdx, setActivePlatformIdx] = useState<number>(-1);

  setTheme(options.darkMode);

  return (
    <>
      <div className="bar">
        <h1>AutoRewards</h1>
        <div className="button-icon" onClick={() => openExtensionOptions()}>
          <MdOutlineSettings className="large-icon" />
        </div>
      </div>

      <div className="list">
        {platforms.map((platform, idx) => {
          const isOpen = idx === activePlatformIdx;
          return (
            <div key={platform.name}>
              <div
                className="bar dropdown-header"
                onClick={() =>
                  setActivePlatformIdx(activePlatformIdx === idx ? -1 : idx)
                }
              >
                <h2>{platform.name}</h2>
                <MdKeyboardArrowDown
                  className={`medium-icon ${
                    isOpen ? "dropdown-arrow-down" : "dropdown-arrow-right"
                  }`}
                />
              </div>
              {isOpen && (
                <div className="dropdown-content">{platform.element}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
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
