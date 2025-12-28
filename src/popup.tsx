import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  return (
    <div>
      <h1>Open side panel</h1>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
