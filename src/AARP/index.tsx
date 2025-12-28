import React, { useEffect, useState } from "react";
import { getUser, isAarpTab, ORIGIN } from "./modules/mechanics";
import { AarpUser } from "./modules/definitions";

function LoadingAnimation() {
  const [nDots, setNDots] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const newNDots = nDots + 1;
      setNDots(newNDots > 3 ? 0 : newNDots);
    }, 500);
    return () => clearInterval(interval);
  });

  return <p>Loading{".".repeat(nDots)}</p>;
}

export function AARP() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [user, setUser] = useState<AarpUser | null>(null);
  const [error, setError] = useState<string>("");

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    (tabs) => {
      const [aarpTab] = tabs.filter((tab) => isAarpTab(tab.url));
      if (aarpTab) setTab(aarpTab);
      // else chrome.tabs.create({ url: ORIGIN }, (aarpTab) => setTab(aarpTab));
    }
  );

  useEffect(() => {
    try {
      tab && getUser(tab).then((aarpUser) => setUser(aarpUser));
      setError("");
    } catch (e) {
      setError(e as string);
    }
  }, [tab]);

  return (
    <React.Fragment>
      {!tab ? (
        <LoadingAnimation />
      ) : user ? (
        <p>Hiya {user.username}. You are logged into AARP!</p>
      ) : (
        <p>You ain't logged in</p>
      )}
      <p>error: {error}</p>
    </React.Fragment>
  );
}

export default {
  name: "AARP",
  element: <AARP />,
};
