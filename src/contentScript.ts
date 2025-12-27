import aarp from "./AARP/contentScript";

const hosts: {
  rootHost: string;
  contentScript: () => void;
}[] = [aarp];

chrome.tabs.getCurrent().then((currentTab) => {
  if (!currentTab.url) return;
  const currentHost = new URL(currentTab.url).hostname;
  hosts.some((host) => {
    const hit = currentHost.includes(host.rootHost);
    if (hit) host.contentScript();
    return hit;
  });
});
