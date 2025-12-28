import aarp from "./AARP/contentScript";

const hosts: {
  rootHost: string;
  contentScript: () => void;
}[] = [aarp];

const currentHost = window.location.hostname;
hosts.some((host) => {
  const hit = currentHost.includes(host.rootHost);
  if (hit) host.contentScript();
  return hit;
});
