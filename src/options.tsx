import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function Options() {
  return <div>This is the options page.</div>;
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
