import * as z from "zod";

export const ORIGIN = "https://www.aarp.org";
export const LOGIN_URL = "https://secure.aarp.org/applications/user/login";
export const REWARDS_URL = `${ORIGIN}/rewards/earn`;

export function isAarpTab(tabUrl: string | undefined): boolean {
  return (tabUrl && /aarp.org$/.test(new URL(tabUrl).hostname)) || false;
}

export async function queryAarpApi<Z extends z.ZodType>(
  url: string,
  payload: any | undefined,
  accessToken: string,
  referer: string,
  schema: Z,
  method: "POST" | "GET" = "POST"
): Promise<z.infer<Z>> {
  const body = payload !== undefined ? JSON.stringify(payload) : undefined;
  const headers: { [key: string]: string } = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    Origin: ORIGIN,
    Referer: referer,
    "User-Agent": navigator.userAgent,
    "X-Loyalty-Backend": "LoyaltyPlus",
  };
  if (body) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = body.length.toString();
  }

  const request = {
    method,
    headers,
    body,
  };
  console.log("about to make api call to", url, "with", request);
  const response = await fetch(url, request);

  const json = await response.json();
  console.log("recieved response", json);
  return schema.parse(json);
}
