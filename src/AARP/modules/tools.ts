export const ORIGIN = "https://www.aarp.org";
export const LOGIN_URL = "https://secure.aarp.org/applications/user/login";

export function isAarpTab(tabUrl: string | undefined): boolean {
  return (tabUrl && /aarp.org$/.test(new URL(tabUrl).hostname)) || false;
}
